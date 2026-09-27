import { baseOf, coinName } from "./symbol";

export interface NewsItem { title: string; url: string; source: string; publishedAt: number }
const cache = new Map<string, { at: number; items: NewsItem[] }>();

function decode(s: string) {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/<[^>]+>/g, "").trim();
}
function parseRss(xml: string, fallbackSource: string): NewsItem[] {
  const items: NewsItem[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const b = m[1];
    const get = (tag: string) => { const r = b.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`)); return r ? decode(r[1]) : ""; };
    const title = get("title"), link = get("link") || (b.match(/<link[^>]*href="([^"]+)"/)?.[1] ?? ""), date = get("pubDate") || get("dc:date");
    const src = get("source") || fallbackSource;
    if (title && link) items.push({ title, url: link, source: src, publishedAt: date ? Date.parse(date) : Date.now() });
  }
  return items;
}

async function fetchText(url: string) {
  const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 CryptoMania/1.0" }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
}

export async function newsFor(symbol: string, maxAgeMs = 10 * 60_000): Promise<NewsItem[]> {
  const base = baseOf(symbol);
  const hit = cache.get(base);
  if (hit && Date.now() - hit.at < maxAgeMs) return hit.items;
  const name = coinName(symbol);
  const q = encodeURIComponent(`${name} ${base} crypto when:7d`);
  const feeds = [
    { url: `https://news.google.com/rss/search?q=${q}&hl=en-GB&gl=GB&ceid=GB:en`, source: "Google News" },
    { url: "https://www.coindesk.com/arc/outboundfeeds/rss/", source: "CoinDesk" },
    { url: "https://cointelegraph.com/rss", source: "Cointelegraph" },
  ];
  const results = await Promise.allSettled(feeds.map(async (f) => parseRss(await fetchText(f.url), f.source)));
  let items: NewsItem[] = [];
  results.forEach((r, i) => {
    if (r.status !== "fulfilled") return;
    const list = i === 0 ? r.value : r.value.filter((it) => new RegExp(`\\b(${base}|${name.split(" ")[0]})\\b`, "i").test(it.title));
    items.push(...list);
  });
  const seen = new Set<string>();
  items = items.filter((it) => { const k = it.title.toLowerCase().slice(0, 60); if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => b.publishedAt - a.publishedAt).slice(0, 25);
  cache.set(base, { at: Date.now(), items });
  return items;
}
