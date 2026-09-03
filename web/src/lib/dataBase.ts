/**
 * Where the browser fetches precomputed city data from. Served as static JSON
 * from the site itself (web/public/data -> /data). Override with VITE_DATA_URL
 * if you ever need to point at a different host.
 */
export const DATA_BASE = (import.meta.env.VITE_DATA_URL || "/data").replace(/\/$/, "");

export const dataUrl = (path: string) => `${DATA_BASE}/${path}`;
