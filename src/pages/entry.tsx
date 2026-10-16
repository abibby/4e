import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData, useLocation } from "react-router";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/c\//, "/content/");
  const response = await fetch(path, { signal: request.signal });
  if (!response.ok)
    throw new Response("Entry not found", { status: response.status });
  const html = await response.text();
  // Static hosts may return the application shell for a missing content file.
  if (/<(?:!doctype|html)\b/i.test(html))
    throw new Response("Entry not found", { status: 404 });
  return {
    html: html
      .replaceAll('src="images', 'src="/images')
      .replaceAll('"http://www.wizards.com/dnd/images', '"/images'),
  };
}

export function Entry() {
  const { html } = useLoaderData<typeof loader>();
  const { state } = useLocation();
  const returnTo =
    typeof state?.returnTo === "string" &&
    /^\/search(?:\?|$)/.test(state.returnTo)
      ? state.returnTo
      : "/search";
  return (
    <div className="entry-page">
      <div className="entry-toolbar">
        <Link className="text-link" to={returnTo}>
          ← Back to search
        </Link>
        <button className="button secondary" onClick={() => window.print()}>
          Print entry
        </button>
      </div>
      <article id="detail" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
