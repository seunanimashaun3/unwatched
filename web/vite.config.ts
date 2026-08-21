import { copyFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// GitHub Pages (and most static hosts) serve 404.html for unknown deep links.
// Our app is a client-side-routed SPA, so make 404.html === index.html: a deep
// link like /atlanta-ga then boots the app and the router resolves the path.
function spaFallback(): Plugin {
  return {
    name: "spa-404-fallback",
    apply: "build",
    closeBundle() {
      const dir = fileURLToPath(new URL("./dist", import.meta.url));
      copyFileSync(`${dir}/index.html`, `${dir}/404.html`);
    },
  };
}

// When deploying to GitHub Pages under https://<user>.github.io/<repo>/,
// assets must be served from /<repo>/. Set BASE_PATH=/unwatched/ in CI.
// Locally and on hosts that serve from root, it stays "/".
export default defineConfig({
  base: process.env.BASE_PATH || "/",
  plugins: [react(), tailwindcss(), spaFallback()],
  worker: { format: "es" },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
