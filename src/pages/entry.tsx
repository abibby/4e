import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

export async function loader({ request }: LoaderFunctionArgs) {
    const url = new URL(request.url)
    let html: string
    if (import.meta.env.SSR) {
        // load the file from the disk directly
        html = ""
    } else {
        const p = url.pathname.replace(/^\/c\//, "/content/");
        const response = await fetch(p, { signal: request.signal })
        if (!response.ok) throw new Response("Entry not found", { status: response.status })
        html = await response.text()
    }

    return {
        html: html.replaceAll('src="images', 'src="/images').replaceAll('"http://www.wizards.com/dnd/images', '"/images')
    }
}

export function Entry() {
    const a = useLoaderData()
    return <div>
        <div>
            <a href="/">home</a>
        </div>
        <article id="detail" dangerouslySetInnerHTML={{__html: a.html}}></article>
    </div>
}
