// Shared package optimizer for the browser and grocery handoff.
export function validOffers(offers) {
  return (
    Array.isArray(offers) &&
    offers.length === 2 &&
    offers.every(
      (o) =>
        o &&
        typeof o.label === "string" &&
        o.label.trim().length > 0 &&
        o.label.length <= 40 &&
        Number.isFinite(o.size) &&
        o.size >= 1 &&
        o.size <= 100000 &&
        Number.isFinite(o.price) &&
        o.price >= 0 &&
        o.price <= 10000 &&
        Math.abs(o.price * 100 - Math.round(o.price * 100)) < 1e-7,
    )
  );
}
export function cheapestPurchase(amount, offers) {
  if (!Number.isFinite(amount) || amount < 0 || !validOffers(offers))
    throw new Error("Invalid ingredient quantity or package offers.");
  const sorted = offers
    .map((offer, index) => ({
      ...offer,
      index,
      cents: Math.round(offer.price * 100),
    }))
    .sort((a, b) => a.size - b.size);
  const [small, large] = sorted;
  let best = null;
  for (let big = 0; big <= Math.ceil(amount / large.size); big++) {
    const little = Math.max(
      0,
      Math.ceil((amount - big * large.size) / small.size - 1e-10),
    );
    const cents = big * large.cents + little * small.cents,
      quantity = big * large.size + little * small.size;
    if (
      !best ||
      cents < best.cents ||
      (cents === best.cents && quantity < best.quantity)
    ) {
      const counts = [0, 0];
      counts[small.index] = little;
      counts[large.index] = big;
      best = { cents, quantity, counts };
    }
  }
  return { ...best, cost: best.cents / 100 };
}
