#!/usr/bin/env python3
"""Import tables into Typesense, then atomically switch the search alias."""
import argparse
import json
import os
import re
import time
import uuid
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen
from searchdata import ROOT, catalog, document, load_tables, schema


class Client:
    def __init__(self, endpoint, key):
        parsed = urlparse(endpoint)
        if parsed.scheme not in {"https", "http"} or not parsed.netloc:
            raise ValueError("TYPESENSE_URL must be an HTTP(S) endpoint")
        self.endpoint, self.key = endpoint.rstrip("/"), key

    def request(self, method, path, data=None, raw=False):
        body = data.encode() if isinstance(data, str) else json.dumps(data).encode() if data is not None else None
        request = Request(self.endpoint + path, data=body, method=method, headers={
            "X-TYPESENSE-API-KEY": self.key,
            "Content-Type": "text/plain" if isinstance(data, str) else "application/json"})
        try:
            with urlopen(request, timeout=120) as response:
                text = response.read().decode()
                return text if raw else json.loads(text)
        except HTTPError as error:
            # Do not echo request headers or potentially sensitive server responses.
            raise RuntimeError(f"Typesense {method} {path.split('?')[0]} failed (HTTP {error.code})") from error


def import_rows(client, rows, alias, batch_size=100):
    if not re.fullmatch(r"[a-zA-Z0-9_-]+", alias):
        raise ValueError("Collection alias must contain only letters, digits, _ or -")
    name = f"{alias}_{int(time.time())}_{uuid.uuid4().hex[:8]}"
    client.request("POST", "/collections", schema(name, catalog(rows)))
    print(f"Created {name}")
    for start in range(0, len(rows), batch_size):
        batch = rows[start:start + batch_size]
        body = "\n".join(json.dumps(document(row), ensure_ascii=False) for row in batch)
        result = client.request("POST", f"/collections/{name}/documents/import?action=create", body, raw=True)
        statuses = [json.loads(line) for line in result.splitlines() if line]
        if len(statuses) != len(batch) or any(not status.get("success") for status in statuses):
            failures = [row["file"] for row, status in zip(batch, statuses) if not status.get("success")]
            raise RuntimeError(f"Import failed in {name}: {', '.join(failures[:5])}. Alias unchanged; inspect this staging collection.")
    actual = client.request("GET", f"/collections/{name}")["num_documents"]
    if actual != len(rows):
        raise RuntimeError(f"Expected {len(rows)} documents, got {actual}; alias unchanged")
    client.request("PUT", "/aliases/" + quote(alias, safe=""), {"collection_name": name})
    print(f"Indexed {actual:,} entries; {alias} now points to {name}")
    return name


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tables", type=Path, default=ROOT / "tables")
    parser.add_argument("--config", type=Path, default=ROOT / "dist/assets/config.json", help="Public browser configuration to write")
    parser.add_argument("--index-only", action="store_true", help="Import the index without creating a search key or writing browser configuration")
    args = parser.parse_args()
    endpoint = os.getenv("TYPESENSE_URL", "")
    admin = os.getenv("TYPESENSE_ADMIN_KEY", "")
    if not endpoint or not admin:
        parser.error("Set TYPESENSE_URL and TYPESENSE_ADMIN_KEY")
    alias = os.getenv("TYPESENSE_COLLECTION", "compendium")
    try:
        if os.getenv("TYPESENSE_SEARCH_KEY") == admin:
            raise ValueError("Search key must differ from the admin key")
        client = Client(endpoint, admin)
        rows = load_tables(args.tables)
        import_rows(client, rows, alias)
        if args.index_only:
            print("Previous collections are retained for rollback; remove them manually after verification.")
            return
        search_key = os.getenv("TYPESENSE_SEARCH_KEY")
        if not search_key:
            search_key = client.request("POST", "/keys", {
                "description": "4e static site search only", "actions": ["documents:search"],
                "collections": [alias]})["value"]
        if search_key == admin:
            raise ValueError("Search key must differ from the admin key")
        args.config.parent.mkdir(parents=True, exist_ok=True)
        args.config.write_text(json.dumps({"endpoint": os.getenv("TYPESENSE_PUBLIC_URL", endpoint).rstrip("/"),
                                           "searchKey": search_key, "collection": alias}), encoding="utf-8")
        print(f"Public search configuration written to {args.config}")
        print("Previous collections are retained for rollback; remove them manually after verification.")
    except (OSError, ValueError, RuntimeError) as error:
        parser.exit(1, f"error: {error}\n")


if __name__ == "__main__":
    main()
