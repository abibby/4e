import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { Home } from "./pages/home";
import { Layout, RouteError, InitialLoading } from "./components/layout";
import "./styles.css";

const router = createBrowserRouter([
  {
    Component: Layout,
    ErrorBoundary: RouteError,
    HydrateFallback: InitialLoading,
    children: [
      { path: "/", Component: Home },
      {
        path: "/search",
        lazy: async () => {
          const { Search, loader } = await import("./pages/search");
          return { Component: Search, loader };
        },
      },
      {
        path: "/c/*",
        lazy: async () => {
          const { Entry, loader } = await import("./pages/entry");
          return { Component: Entry, loader };
        },
      },
    ],
  },
]);

createRoot(document.getElementById("main")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
