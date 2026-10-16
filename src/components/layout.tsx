import { useEffect } from "react";
import {
  Link,
  NavLink,
  Outlet,
  isRouteErrorResponse,
  useLocation,
  useRouteError,
} from "react-router";
import { EmptyState, Icon } from "./ui";

export function Layout() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = `${pathname === "/" ? "Explore" : pathname === "/search" ? "Search" : "Entry"} · 4e Compendium`;
  }, [pathname]);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#page-content">
        Skip to content
      </a>
      {pathname !== "/" && (
        <header className="site-header">
          <div className="header-inner">
            <Link to="/" className="brand">
              <span className="brand-mark">
                <Icon name="book" />
              </span>
              <span>
                4e <strong>Compendium</strong>
              </span>
            </Link>
            <nav aria-label="Main navigation">
              <NavLink to="/" end>
                Explore
              </NavLink>
              <NavLink to="/search">Search</NavLink>
            </nav>
            <span className="edition-label">
              DUNGEONS & DRAGONS · 4TH EDITION
            </span>
          </div>
        </header>
      )}
      <main id="page-content" className="page-container">
        <Outlet />
      </main>
      <footer className="site-footer">
        <span>4e Compendium</span>
        <span>A reference for your next adventure.</span>
      </footer>
    </div>
  );
}

export function RouteError() {
  const error = useRouteError();
  const missing = isRouteErrorResponse(error) && error.status === 404;
  return (
    <main className="page-container">
      <EmptyState
        title={missing ? "Entry not found" : "Something went wrong"}
        error
      >
        <p>
          {missing
            ? "This entry may have moved. Search the compendium to find it."
            : "The page could not be loaded. Please try again."}
        </p>
        <Link className="button primary" to="/search">
          Search the compendium
        </Link>
      </EmptyState>
    </main>
  );
}

export function InitialLoading() {
  return (
    <main className="page-container">
      <div className="empty-state" role="status">
        <Icon name="book" />
        <h1>Opening the compendium…</h1>
      </div>
    </main>
  );
}
