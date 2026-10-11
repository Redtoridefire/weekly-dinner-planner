import { validOffers } from "./supabase/functions/_shared/pricing.js";
export {
  validOffers,
  cheapestPurchase,
} from "./supabase/functions/_shared/pricing.js";
// Illustrative USD package prices, not retailer quotes. Owners can replace both
// offers with the package sizes and prices available at their own store.
const rows = [
  ["Black beans", "cans", 1, 0.95, 4, 3.5],
  ["Tortillas", "pieces", 10, 2.2, 20, 3.8],
  ["Cabbage", "heads", 1, 2.2, 2, 4],
  ["Limes", "pieces", 1, 0.5, 6, 2.5],
  ["Smoked paprika", "tsp", 20, 2, 40, 3.5],
  ["Olive oil", "tbsp", 32, 5, 64, 9],
  ["Chicken thighs", "g", 454, 3, 1362, 8],
  ["Potatoes", "g", 907, 2.5, 2268, 4],
  ["Broccoli", "heads", 1, 1.75, 3, 4.8],
  ["Lemons", "pieces", 1, 0.6, 6, 3],
  ["Garlic", "cloves", 10, 0.6, 30, 1.5],
  ["Pasta", "g", 454, 1.1, 907, 2],
  ["Crushed tomatoes", "cans", 1, 1.6, 3, 4.5],
  ["Spinach", "g", 227, 2, 454, 3.5],
  ["Cream", "ml", 473, 3, 946, 5],
  ["Parmesan", "g", 227, 3.5, 454, 6],
  ["Salmon", "g", 454, 10, 907, 18],
  ["Rice", "g", 907, 2, 2268, 4],
  ["Cucumber", "pieces", 1, 0.8, 3, 2],
  ["Teriyaki sauce", "ml", 300, 2, 600, 3.5],
  ["Sesame seeds", "tbsp", 16, 2, 32, 3.5],
  ["Chickpeas", "cans", 1, 0.95, 4, 3.5],
  ["Coconut milk", "cans", 1, 1.8, 3, 5],
  ["Curry powder", "tbsp", 16, 2, 32, 3.5],
  ["Onion", "pieces", 1, 0.6, 6, 2.5],
  ["Ground beef", "g", 454, 4.5, 1362, 12],
  ["Burger buns", "pieces", 8, 2, 16, 3.5],
  ["Lettuce", "heads", 1, 1.5, 3, 4],
  ["Tomatoes", "pieces", 1, 0.7, 6, 3.5],
  ["Firm tofu", "g", 397, 1.8, 794, 3.3],
  ["Bell peppers", "pieces", 1, 0.8, 3, 2],
  ["Soy sauce", "ml", 450, 2, 900, 3.5],
  ["Ginger", "g", 100, 0.8, 300, 2],
  ["Dry lentils", "g", 454, 1.4, 907, 2.5],
  ["Carrots", "pieces", 6, 1, 12, 1.8],
  ["Vegetable broth", "ml", 946, 1.5, 1892, 2.8],
  ["Bread", "loaves", 1, 1.5, 2, 2.7],
  ["Eggs", "pieces", 12, 3, 18, 4.2],
  ["Butter", "g", 454, 3.5, 907, 6],
  ["Cheddar", "g", 227, 2, 454, 3.5],
  ["Zucchini", "g", 454, 1.6, 1362, 4.25],
];
export const priceBook = Object.fromEntries(
  rows.map(([name, unit, size, price, bigSize, bigPrice]) => [
    name,
    {
      unit,
      offers: [
        { label: "Standard package", size, price },
        { label: "Value package", size: bigSize, price: bigPrice },
      ],
    },
  ]),
);
export function normalizePrices(prices) {
  const result = Object.create(null);
  if (prices && typeof prices === "object" && !Array.isArray(prices))
    for (const [name, offers] of Object.entries(prices))
      if (Object.hasOwn(priceBook, name) && validOffers(offers))
        result[name] = offers.map((o) => ({
          label: o.label.trim(),
          size: o.size,
          price: o.price,
        }));
  return result;
}
