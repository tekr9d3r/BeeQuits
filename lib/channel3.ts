import type { ProductCard } from "./db/schema";

const FALLBACK_USD_TO_EUR = 0.9;
let rate: { value: number; fetchedAt: number } | null = null;

// Daily ECB reference rate (via Frankfurter, no key). Channel3's catalog prices are in USD.
async function usdToEur(): Promise<number> {
  if (rate && Date.now() - rate.fetchedAt < 12 * 3600_000) return rate.value;
  try {
    const res = await fetch("https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR");
    const value = (await res.json()).rates.EUR as number;
    rate = { value, fetchedAt: Date.now() };
    return value;
  } catch {
    return rate?.value ?? FALLBACK_USD_TO_EUR;
  }
}

type Channel3Product = {
  title: string;
  images?: { url: string }[];
  offers?: { url: string; domain: string; availability: string; price?: { price: number; currency: string } }[];
};

// Searches Channel3's product catalog and returns up to `limit` in-stock offers.
// maxPriceEur is converted to the catalog currency for the price filter.
export async function searchProducts(query: string, maxPriceEur?: number, limit = 4): Promise<ProductCard[]> {
  const fx = await usdToEur();
  const res = await fetch("https://api.trychannel3.com/v1/search", {
    method: "POST",
    headers: { "x-api-key": process.env.CHANNEL3_API_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      limit: 12,
      ...(maxPriceEur && { filters: { price: { max_price: Math.round(maxPriceEur / fx) } } }),
    }),
  });
  if (!res.ok) throw new Error(`Channel3 search ${res.status}: ${await res.text()}`);
  const { products = [] } = (await res.json()) as { products?: Channel3Product[] };

  const cards: ProductCard[] = [];
  for (const p of products) {
    const offer = p.offers?.find((o) => o.availability === "InStock" && o.price);
    if (!offer?.price) continue;
    cards.push({
      title: p.title,
      imageUrl: p.images?.[0]?.url ?? null,
      price: offer.price.price,
      currency: offer.price.currency,
      approxTripCurrency: offer.price.currency === "USD" ? Math.round(offer.price.price * fx * 100) / 100 : null,
      merchant: offer.domain,
      url: offer.url,
    });
    if (cards.length === limit) break;
  }
  return cards;
}
