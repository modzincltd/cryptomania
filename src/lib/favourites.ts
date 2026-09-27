import { getSetting, setSetting } from "./settings";
export function getFavourites(): string[] { return getSetting<string[]>("favourites", []); }
export function toggleFavourite(symbol: string): string[] {
  const s = symbol.toUpperCase();
  const cur = getFavourites();
  const next = cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s];
  setSetting("favourites", next);
  return next;
}
