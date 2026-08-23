/**
 * Where the browser fetches precomputed city data from. Defaults to the R2
 * bucket (data.unwatched.net); override with VITE_DATA_URL (e.g. "/data") to
 * use locally-served files during offline development.
 */
export const DATA_BASE = (import.meta.env.VITE_DATA_URL || "https://data.unwatched.net").replace(/\/$/, "");

export const dataUrl = (path: string) => `${DATA_BASE}/${path}`;
