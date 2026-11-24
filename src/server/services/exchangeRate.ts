// USD/IDR rate for the dashboard (information only — all amounts are stored in IDR).
// Primary: Bank Indonesia "Kurs Transaksi BI" web service. Fallback: open.er-api.com.
import type { ExchangeRateInfo } from "@/shared/types";

const BI_URL = "https://www.bi.go.id/biwebservice/wskursbi.asmx/getSubKursLokal3";
// BI's firewall resets requests without a browser-like User-Agent.
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const CACHE_MS = 6 * 60 * 60 * 1000;

let cache: { at: number; value: ExchangeRateInfo } | null = null;

const ymd = (d: Date) => d.toISOString().slice(0, 10);

async function fromBankIndonesia(): Promise<ExchangeRateInfo> {
  const end = new Date();
  const start = new Date(end.getTime() - 14 * 86_400_000); // covers weekends & holidays
  const url = `${BI_URL}?${new URLSearchParams({ mts: "USD", startdate: ymd(start), enddate: ymd(end) })}`;
  const res = await fetch(url, { headers: { "User-Agent": BROWSER_UA }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`BI responded ${res.status}`);
  const xml = await res.text();
  const rows = [...xml.matchAll(/<Table [^>]*>([\s\S]*?)<\/Table>/g)].map((m) => {
    const field = (name: string) => m[1].match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1] ?? "";
    return {
      unit: Number(field("nil_subkurslokal")) || 1,
      buy: Number(field("beli_subkurslokal")),
      sell: Number(field("jual_subkurslokal")),
      date: field("tgl_subkurslokal"),
    };
  });
  const latest = rows.filter((r) => r.buy > 0 && r.sell > 0).sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!latest) throw new Error("BI returned no USD rows");
  return {
    rate: (latest.buy + latest.sell) / 2 / latest.unit,
    buy: latest.buy / latest.unit,
    sell: latest.sell / latest.unit,
    date: latest.date.slice(0, 10),
    source: "Bank Indonesia — Kurs Transaksi BI (middle rate)",
    official: true,
  };
}

async function fromFallback(): Promise<ExchangeRateInfo> {
  const res = await fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Fallback responded ${res.status}`);
  const data = (await res.json()) as { rates?: Record<string, number>; time_last_update_unix?: number };
  const rate = data.rates?.IDR;
  if (!rate) throw new Error("Fallback has no IDR rate");
  return {
    rate,
    buy: null,
    sell: null,
    date: new Date((data.time_last_update_unix ?? Date.now() / 1000) * 1000).toISOString().slice(0, 10),
    source: "open.er-api.com (Bank Indonesia unavailable)",
    official: false,
  };
}

export async function getUsdIdrRate(): Promise<ExchangeRateInfo | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  for (const load of [fromBankIndonesia, fromFallback]) {
    try {
      const value = await load();
      cache = { at: Date.now(), value };
      return value;
    } catch (err) {
      console.warn("Exchange rate source failed:", err instanceof Error ? err.message : err);
    }
  }
  return cache?.value ?? null; // stale beats nothing
}
