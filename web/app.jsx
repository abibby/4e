import { Route, Routes } from "react-router";
import { CompendiumProvider } from "./providers/compendium-provider.jsx";
import { SiteLayout } from "./components/layout/site-layout.jsx";
import { HomePage } from "./pages/home-page.jsx";
import { SearchPage } from "./pages/search-page.jsx";
import { EntryPage } from "./pages/entry-page.jsx";
import { NotFoundPage } from "./pages/not-found-page.jsx";

export function App({ root }) {
  return (
    <CompendiumProvider root={root}>
      <Routes>
        <Route index element={<HomePage />} />
        <Route path="index.html" element={<HomePage />} />
        <Route path="content/*" element={<EntryPage />} />
        <Route element={<SiteLayout />}>
          <Route path="search.html" element={<SearchPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </CompendiumProvider>
  );
}
