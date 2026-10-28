export {};

// Step 0 spike: does Channel3 return EUR prices / EU merchants for ski gear?
//   node --env-file=.env scripts/spike/channel3.mts "ski helmet" 100

const [query = "ski helmet", maxPrice] = process.argv.slice(2);
const res = await fetch("https://api.trychannel3.com/v1/search", {
  method: "POST",
  headers: { "x-api-key": process.env.CHANNEL3_API_KEY!, "Content-Type": "application/json" },
  body: JSON.stringify({ query, limit: 5, ...(maxPrice && { filters: { price: { max_price: Number(maxPrice) } } }) }),
});
const json = await res.json();
if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(json)}`);
for (const p of json.products ?? []) {
  console.log(`\n${p.title}`);
  for (const o of p.offers ?? []) console.log(`  ${o.price?.price} ${o.price?.currency}  ${o.domain}  ${o.availability}`);
}
