import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider, useParams } from "react-router-dom";
import Home from "@/pages/Home";
import City from "@/pages/City";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./index.css";

// key City on the slug so switching cities remounts the map cleanly
function CityRoute() {
  const { slug } = useParams();
  return <City key={slug} />;
}

// strip trailing slash from BASE_URL for the router basename ("/" stays "/")
const basename = (import.meta.env.BASE_URL || "/").replace(/\/$/, "") || "/";

const router = createBrowserRouter(
  [
    { path: "/", element: <Home /> },
    { path: "/:slug", element: <CityRoute /> },
  ],
  { basename },
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  </React.StrictMode>,
);
