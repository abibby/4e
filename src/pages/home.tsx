export function Home() {
    return <div>
        <h1>4e Compendium</h1>
        <form action="/search">
            <input name="q" type="text" /><button>Search</button>
        </form>
    </div>
}