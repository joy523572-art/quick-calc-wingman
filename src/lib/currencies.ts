/**
 * Worldwide currencies with approximate units-per-1-USD rates bundled for Offline mode.
 * In Online mode live rates replace these and are cached for later offline use.
 */
export const OFFLINE_USD_RATES: Record<string, number> = {
  USD: 1, AED: 3.6725, AFN: 70, ALL: 92, AMD: 388, ANG: 1.79, AOA: 915, ARS: 1200, AUD: 1.52, AWG: 1.79,
  AZN: 1.7, BAM: 1.75, BBD: 2, BDT: 120, BGN: 1.75, BHD: 0.376, BIF: 2950, BMD: 1, BND: 1.33, BOB: 6.91,
  BRL: 5.5, BSD: 1, BTN: 85, BWP: 13.6, BYN: 3.27, BZD: 2, CAD: 1.37, CDF: 2850, CHF: 0.8, CLP: 940,
  CNY: 7.2, COP: 4100, CRC: 505, CUP: 24, CVE: 98.5, CZK: 22.5, DJF: 177.7, DKK: 6.7, DOP: 61, DZD: 133,
  EGP: 49, ERN: 15, ETB: 135, EUR: 0.9, FJD: 2.27, FKP: 0.76, GBP: 0.76, GEL: 2.72, GHS: 12.5, GIP: 0.76,
  GMD: 72, GNF: 8650, GTQ: 7.7, GYD: 209, HKD: 7.8, HNL: 26, HTG: 131, HUF: 355, IDR: 16300, ILS: 3.6,
  INR: 85.5, IQD: 1310, IRR: 42000, ISK: 128, JMD: 158, JOD: 0.709, JPY: 147, KES: 129, KGS: 87.4, KHR: 4010,
  KMF: 441, KPW: 900, KRW: 1380, KWD: 0.306, KYD: 0.833, KZT: 510, LAK: 21600, LBP: 89500, LKR: 300, LRD: 200,
  LSL: 17.8, LYD: 5.4, MAD: 9, MDL: 17, MGA: 4450, MKD: 55, MMK: 2100, MNT: 3580, MOP: 8.05, MRU: 39.8,
  MUR: 45.5, MVR: 15.4, MWK: 1735, MXN: 18.8, MYR: 4.25, MZN: 63.9, NAD: 17.8, NGN: 1540, NIO: 36.8, NOK: 10.1,
  NPR: 137, NZD: 1.66, OMR: 0.385, PAB: 1, PEN: 3.6, PGK: 4.1, PHP: 56.5, PKR: 283, PLN: 3.75, PYG: 7950,
  QAR: 3.64, RON: 4.5, RSD: 105, RUB: 79, RWF: 1430, SAR: 3.75, SBD: 8.4, SCR: 14.5, SDG: 600, SEK: 9.6,
  SGD: 1.29, SHP: 0.76, SLE: 22.7, SOS: 571, SRD: 37, SSP: 4500, STN: 22, SYP: 13000, SZL: 17.8, THB: 32.5,
  TJS: 10, TMT: 3.5, TND: 2.95, TOP: 2.36, TRY: 40, TTD: 6.78, TWD: 30, TZS: 2600, UAH: 41.5, UGX: 3600,
  UYU: 40.5, UZS: 12600, VES: 110, VND: 26100, VUV: 120, WST: 2.75, XAF: 590, XCD: 2.7, XOF: 590, XPF: 107.5,
  YER: 241, ZAR: 17.8, ZMW: 24, ZWL: 26.8,
};

const CACHE_KEY = "nume.currency-rates.v1";

export type RateTable = { base: "USD"; rates: Record<string, number>; updatedAt: string | null; source: "live" | "cached" | "offline" };

const names = (() => {
  try {
    return new Intl.DisplayNames(["en"], { type: "currency" });
  } catch {
    return null;
  }
})();

export const currencyName = (code: string) => names?.of(code) ?? code;

export const CURRENCY_CODES = Object.keys(OFFLINE_USD_RATES).sort();

export function readCachedRates(): RateTable {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { rates: Record<string, number>; updatedAt: string };
      if (parsed?.rates?.USD === 1) return { base: "USD", rates: { ...OFFLINE_USD_RATES, ...parsed.rates }, updatedAt: parsed.updatedAt, source: "cached" };
    }
  } catch {
    /* ignore */
  }
  return { base: "USD", rates: OFFLINE_USD_RATES, updatedAt: null, source: "offline" };
}

export async function fetchLiveRates(signal?: AbortSignal): Promise<RateTable> {
  const res = await fetch("https://open.er-api.com/v6/latest/USD", { signal });
  if (!res.ok) throw new Error("Live rates unavailable");
  const data = (await res.json()) as { result?: string; rates?: Record<string, number> };
  if (data.result !== "success" || !data.rates) throw new Error("Live rates unavailable");
  const updatedAt = new Date().toISOString();
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ rates: data.rates, updatedAt }));
  } catch {
    /* ignore */
  }
  return { base: "USD", rates: { ...OFFLINE_USD_RATES, ...data.rates }, updatedAt, source: "live" };
}

/** Rate to multiply an amount in `from` to get `to`. */
export function crossRate(table: RateTable, from: string, to: string) {
  const f = table.rates[from];
  const t = table.rates[to];
  if (!f || !t) throw new Error("This currency pair is not available.");
  return t / f;
}
