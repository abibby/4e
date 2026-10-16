import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { Home } from "./pages/home";
import { Entry, loader as entryLoader } from "./pages/entry";
import { Search, loader as searchLoader } from "./pages/search";

let router = createBrowserRouter([
  {
    path: "/",
    Component: Home,
  },
  {
    path: "/search",
    Component: Search,
    loader: searchLoader,
  },
  {
    path: "/c/*",
    Component: Entry,
    loader: entryLoader,
  },
]);

createRoot(document.getElementById("main")!).render(
  <RouterProvider router={router} />,
);
