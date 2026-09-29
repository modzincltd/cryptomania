import { getSetting, setSetting } from "./settings";
export function getFavourites() { return getSetting<string[]>("favourites", []); }
export async function toggleFavourite(symbol: string) {
  const s = symbol.toUpperCase(); const cur = await getFavourites();
  const next = cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s];
  await setSetting("favourites", next); return next;
}
