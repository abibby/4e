import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

export async function loader({ url }: LoaderFunctionArgs) {
  let results: unknown[] = [];
  const query = url.searchParams.get("q");
  if (!import.meta.env.SSR) {
    // TODO: set results from a search query
  }

  return {
    query,
    results,
  };
}

export function Search() {
  const data = useLoaderData();
  return (
    <div>
      <div>
        <a href="/">home</a>
        <form action="/search">
          <input name="q" type="text" defaultValue={data.query} />
          <button>Search</button>
        </form>
      </div>
    </div>
  );
}
