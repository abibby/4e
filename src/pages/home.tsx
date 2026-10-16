import { Form, Link } from "react-router";
import { SearchBox } from "../components/ui";
import { categories } from "../search/filters";

export function Home() {
  return (
    <section className="home-page" aria-labelledby="home-title">
      <h1 id="home-title">4e</h1>
      <p className="home-subtitle">compendium</p>
      <Form action="/search" role="search" className="home-search">
        <SearchBox />
      </Form>
      <nav className="home-categories" aria-label="Browse resources">
        <Link to="/search">All resources</Link>
        {categories.map(([value, label]) => (
          <Link to={`/search?category=${value}`} key={value}>
            {label}
          </Link>
        ))}
      </nav>
    </section>
  );
}
