"""Wait up to one minute for the local Typesense container to start."""
import os
import time
from urllib.error import URLError
from urllib.request import urlopen

for attempt in range(60):
    try:
        with urlopen(os.environ["TYPESENSE_URL"] + "/health", timeout=2) as response:
            if response.status == 200:
                break
    except (URLError, TimeoutError):
        pass
    time.sleep(1)
else:
    raise SystemExit("Typesense did not become healthy within one minute")
