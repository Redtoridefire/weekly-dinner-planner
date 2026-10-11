import {
  priceBook,
  normalizePrices,
  cheapestPurchase,
  validOffers,
} from "./prices.js";
export const meals = [
  {
    id: "tacos",
    name: "Smoky black bean tacos",
    emoji: "🌮",
    color: "#efe2c2",
    time: 25,
    vegetarian: true,
    description:
      "Warm tortillas, smoky beans, crunchy cabbage, and a squeeze of lime.",
    ingredients: [
      ["Black beans", "cans", 2],
      ["Tortillas", "pieces", 8],
      ["Cabbage", "heads", 0.5],
      ["Limes", "pieces", 2],
      ["Smoked paprika", "tsp", 2],
      ["Olive oil", "tbsp", 1],
    ],
    steps:
      "Drain beans and warm with oil and paprika for 8 minutes. Slice cabbage. Warm tortillas and fill with beans and cabbage; finish with lime.",
  },
  {
    id: "chicken",
    name: "Lemon sheet-pan chicken",
    emoji: "🍗",
    color: "#e4e9d2",
    time: 45,
    vegetarian: false,
    description:
      "Golden chicken, roasted potatoes, and broccoli. One pan, happy people.",
    ingredients: [
      ["Chicken thighs", "g", 700],
      ["Potatoes", "g", 800],
      ["Broccoli", "heads", 1],
      ["Lemons", "pieces", 1],
      ["Olive oil", "tbsp", 2],
      ["Garlic", "cloves", 3],
    ],
    steps:
      "Heat oven to 425°F / 220°C. Cut potatoes small and toss with chicken, oil, garlic, and lemon. Roast 20 minutes, add broccoli, then roast until chicken reaches 165°F / 74°C, about 20 more minutes.",
  },
  {
    id: "pasta",
    name: "Creamy tomato pasta",
    emoji: "🍝",
    color: "#f0dcd0",
    time: 25,
    vegetarian: true,
    description: "A cozy tomato sauce with spinach and a little parmesan.",
    ingredients: [
      ["Pasta", "g", 400],
      ["Crushed tomatoes", "cans", 1],
      ["Spinach", "g", 150],
      ["Cream", "ml", 150],
      ["Parmesan", "g", 60],
      ["Garlic", "cloves", 2],
      ["Olive oil", "tbsp", 1],
    ],
    steps:
      "Boil pasta according to the package. Sauté garlic in oil, add tomatoes and simmer 10 minutes. Stir in cream and spinach, then toss with pasta and parmesan.",
  },
  {
    id: "salmon",
    name: "Teriyaki salmon bowls",
    emoji: "🍚",
    color: "#dce6e8",
    time: 30,
    vegetarian: false,
    description:
      "Flaky salmon over rice, with cucumber and a sweet-savory glaze.",
    ingredients: [
      ["Salmon", "g", 600],
      ["Rice", "g", 300],
      ["Cucumber", "pieces", 1],
      ["Teriyaki sauce", "ml", 100],
      ["Sesame seeds", "tbsp", 1],
    ],
    steps:
      "Cook rice according to the package. Brush salmon with teriyaki sauce and bake at 400°F / 200°C until it reaches 145°F / 63°C, about 12–15 minutes. Serve over rice with sliced cucumber and sesame.",
  },
  {
    id: "curry",
    name: "Coconut chickpea curry",
    emoji: "🍛",
    color: "#eee4bd",
    time: 30,
    vegetarian: true,
    description:
      "Creamy coconut, chickpeas, and spinach. A weeknight comfort favorite.",
    ingredients: [
      ["Chickpeas", "cans", 2],
      ["Coconut milk", "cans", 1],
      ["Spinach", "g", 150],
      ["Rice", "g", 300],
      ["Curry powder", "tbsp", 2],
      ["Onion", "pieces", 1],
      ["Olive oil", "tbsp", 1],
    ],
    steps:
      "Cook rice. Chop onion and sauté in oil until soft. Add curry powder, drained chickpeas, and coconut milk; simmer 15 minutes. Stir in spinach until wilted and serve with rice.",
  },
  {
    id: "burgers",
    name: "Build-your-own burgers",
    emoji: "🍔",
    color: "#e7dbc9",
    time: 30,
    vegetarian: false,
    description:
      "Classic burgers with crisp lettuce, tomatoes, and oven fries.",
    ingredients: [
      ["Ground beef", "g", 600],
      ["Burger buns", "pieces", 4],
      ["Lettuce", "heads", 0.5],
      ["Tomatoes", "pieces", 2],
      ["Potatoes", "g", 800],
      ["Olive oil", "tbsp", 2],
    ],
    steps:
      "Cut potatoes into thin fries, toss with oil and roast at 425°F / 220°C for 25–30 minutes. Form beef into patties and cook to 160°F / 71°C. Serve in buns with lettuce and tomato.",
  },
  {
    id: "stirfry",
    name: "Ginger tofu stir-fry",
    emoji: "🥦",
    color: "#dde7d3",
    time: 25,
    vegetarian: true,
    description: "Crispy tofu, colorful vegetables, and a gingery soy sauce.",
    ingredients: [
      ["Firm tofu", "g", 500],
      ["Broccoli", "heads", 1],
      ["Bell peppers", "pieces", 2],
      ["Rice", "g", 300],
      ["Soy sauce", "ml", 60],
      ["Ginger", "g", 20],
      ["Olive oil", "tbsp", 2],
    ],
    steps:
      "Cook rice. Pat tofu dry, cube and sauté in oil until golden. Add chopped broccoli and peppers; stir-fry until tender. Add grated ginger and soy sauce, heat through, and serve with rice.",
  },
  {
    id: "soup",
    name: "Rustic lentil soup",
    emoji: "🥣",
    color: "#e9ddcf",
    time: 40,
    vegetarian: true,
    description:
      "A big pot of lentils and vegetables, with crusty bread for dipping.",
    ingredients: [
      ["Dry lentils", "g", 300],
      ["Carrots", "pieces", 3],
      ["Onion", "pieces", 1],
      ["Crushed tomatoes", "cans", 1],
      ["Vegetable broth", "ml", 1200],
      ["Bread", "loaves", 1],
      ["Olive oil", "tbsp", 1],
    ],
    steps:
      "Chop onion and carrots; sauté in oil for 5 minutes. Add rinsed lentils, tomatoes and broth. Simmer 30 minutes or until lentils are tender. Serve with bread.",
  },
  {
    id: "keto-eggs",
    name: "Cheesy cabbage & egg skillet",
    emoji: "🍳",
    color: "#e9e4c9",
    time: 20,
    vegetarian: true,
    keto: true,
    description:
      "An economical one-pan dinner of tender cabbage, eggs, and melted cheddar.",
    ingredients: [
      ["Eggs", "pieces", 8],
      ["Cabbage", "heads", 0.5],
      ["Cheddar", "g", 100],
      ["Butter", "g", 30],
    ],
    steps:
      "Thinly slice cabbage and sauté in butter until tender, about 10 minutes. Add beaten eggs and cook until set and the egg dish reaches 160°F / 71°C. Finish with cheddar. Choose cheese made with vegetarian rennet if needed.",
  },
  {
    id: "keto-frittata",
    name: "Broccoli cheddar frittata",
    emoji: "🥚",
    color: "#dfe7cf",
    time: 30,
    vegetarian: true,
    keto: true,
    description: "A filling, low-carb egg bake with broccoli and cheddar.",
    ingredients: [
      ["Eggs", "pieces", 8],
      ["Broccoli", "heads", 1],
      ["Cheddar", "g", 120],
      ["Cream", "ml", 100],
      ["Butter", "g", 20],
    ],
    steps:
      "Heat oven to 400°F / 200°C. Chop broccoli and sauté in butter in an oven-safe pan until tender. Whisk eggs and cream, add to pan, sprinkle with cheddar, and bake 15–20 minutes until the center reaches 160°F / 71°C. Use vegetarian-certified cheese if needed.",
  },
  {
    id: "keto-cabbage",
    name: "Chicken & cabbage skillet",
    emoji: "🥬",
    color: "#e2e8d3",
    time: 25,
    vegetarian: false,
    keto: true,
    description:
      "Budget-friendly chicken thighs and cabbage with garlic and olive oil.",
    ingredients: [
      ["Chicken thighs", "g", 700],
      ["Cabbage", "heads", 0.5],
      ["Garlic", "cloves", 2],
      ["Olive oil", "tbsp", 2],
    ],
    steps:
      "Cut boneless chicken into strips. Sauté in olive oil, then add thinly sliced cabbage and minced garlic. Cook until cabbage is tender and every piece of chicken reaches 165°F / 74°C.",
  },
  {
    id: "keto-zucchini",
    name: "Creamy garlic chicken & zucchini",
    emoji: "🍗",
    color: "#e5dfd1",
    time: 30,
    vegetarian: false,
    keto: true,
    description:
      "Chicken thighs, zucchini, and a creamy garlic sauce, without pasta.",
    ingredients: [
      ["Chicken thighs", "g", 700],
      ["Zucchini", "g", 600],
      ["Cream", "ml", 100],
      ["Garlic", "cloves", 2],
      ["Olive oil", "tbsp", 1],
    ],
    steps:
      "Cut boneless chicken into bite-sized pieces and brown in olive oil. Add sliced zucchini and garlic. Stir in cream and simmer until chicken reaches 165°F / 74°C and zucchini is tender.",
  },
  {
    id: "keto-wraps",
    name: "Cheeseburger lettuce wraps",
    emoji: "🥬",
    color: "#e9ddce",
    time: 25,
    vegetarian: false,
    keto: true,
    description:
      "All the burger flavor in crisp lettuce leaves, without buns or fries.",
    ingredients: [
      ["Ground beef", "g", 600],
      ["Lettuce", "heads", 0.5],
      ["Tomatoes", "pieces", 1],
      ["Cheddar", "g", 80],
      ["Olive oil", "tbsp", 1],
    ],
    steps:
      "Form beef into small patties. Cook in olive oil to 160°F / 71°C, then add cheddar. Wrap in washed lettuce leaves with sliced tomato. Avoid sweetened sauces.",
  },
  {
    id: "keto-salmon",
    name: "Lemon butter salmon & broccoli",
    emoji: "🐟",
    color: "#dde7e8",
    time: 30,
    vegetarian: false,
    keto: true,
    description:
      "A simple salmon supper with buttery broccoli and fresh lemon.",
    ingredients: [
      ["Salmon", "g", 600],
      ["Broccoli", "heads", 1],
      ["Butter", "g", 40],
      ["Lemons", "pieces", 1],
    ],
    steps:
      "Heat oven to 400°F / 200°C. Place salmon and small broccoli florets on a tray, add butter and lemon juice, and roast until salmon reaches 145°F / 63°C, about 15–20 minutes. Cook broccoli longer if needed.",
  },
  {
    id: "keto-tofu",
    name: "Sesame tofu & zucchini skillet",
    emoji: "🥢",
    color: "#e6e8d3",
    time: 25,
    vegetarian: true,
    keto: true,
    description:
      "Crispy firm tofu and zucchini with ginger and unsweetened soy sauce.",
    ingredients: [
      ["Firm tofu", "g", 600],
      ["Zucchini", "g", 600],
      ["Soy sauce", "ml", 30],
      ["Ginger", "g", 10],
      ["Sesame seeds", "tbsp", 1],
      ["Olive oil", "tbsp", 2],
    ],
    steps:
      "Pat tofu dry, cube, and sauté in olive oil until golden. Add sliced zucchini and grated ginger, cooking until tender. Toss with unsweetened soy sauce and sesame seeds. Check tofu and sauce labels for carbohydrate content.",
  },
];
export function eligibleMeals(preferences = {}) {
  return meals.filter(
    (m) =>
      (!preferences.vegetarian || m.vegetarian) &&
      (!preferences.quick || m.time <= 30) &&
      (!preferences.keto || m.keto === true),
  );
}
export function rankMeals(votes, count, preferences = {}) {
  const scores = new Map();
  Object.values(votes)
    .filter(Array.isArray)
    .forEach((ids) =>
      new Set(ids).forEach((id) => scores.set(id, (scores.get(id) || 0) + 1)),
    );
  return eligibleMeals(preferences)
    .sort((a, b) => (scores.get(b.id) || 0) - (scores.get(a.id) || 0))
    .slice(0, count);
}
export function shoppingList(selected, servings) {
  const totals = new Map();
  selected.forEach((meal) =>
    meal.ingredients.forEach(([name, unit, amount]) => {
      const key = `${name}|${unit}`;
      const item = totals.get(key) || { name, unit, amount: 0 };
      item.amount += (amount * servings) / 4;
      totals.set(key, item);
    }),
  );
  return [...totals.values()].sort((a, b) => a.name.localeCompare(b.name));
}
export function weekKey(date = new Date(), timeZone) {
  if (timeZone) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const part = (type) => Number(parts.find((p) => p.type === type).value);
    date = new Date(part("year"), part("month") - 1, part("day"));
  }
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
}
export function normalizeState(input = {}) {
  if (!input || typeof input !== "object") input = {};
  const ids = new Set(meals.map((m) => m.id));
  const votes = Object.create(null);
  if (
    input.votes &&
    typeof input.votes === "object" &&
    !Array.isArray(input.votes)
  )
    for (const [name, value] of Object.entries(input.votes))
      if (Array.isArray(value))
        votes[name] = [...new Set(value.filter((id) => ids.has(id)))];
  const bounded = (n, min, max, fallback) =>
    Number.isInteger(n) && n >= min && n <= max ? n : fallback;
  const lockedIds = Array.isArray(input.locked?.ids)
    ? [...new Set(input.locked.ids.filter((id) => ids.has(id)))]
    : [];
  return {
    votes,
    pantry: Array.isArray(input.pantry)
      ? [
          ...new Set(
            input.pantry.filter(
              (n) => typeof n === "string" && n.length <= 100,
            ),
          ),
        ]
      : [],
    servings: bounded(input.servings, 1, 20, 4),
    dinners: bounded(input.dinners, 1, 7, 5),
    voter: typeof input.voter === "string" ? input.voter.slice(0, 40) : "",
    locked: lockedIds.length ? { ids: lockedIds } : null,
    preferences: {
      vegetarian: input.preferences?.vegetarian === true,
      quick: input.preferences?.quick === true,
      keto: input.preferences?.keto === true,
    },
    strategy: ["votes", "balanced", "cheapest"].includes(input.strategy)
      ? input.strategy
      : "votes",
    budget:
      Number.isFinite(input.budget) &&
      input.budget >= 0 &&
      input.budget <= 10000
        ? Math.round(input.budget * 100) / 100
        : 0,
    prices: normalizePrices(input.prices),
    revision: bounded(input.revision, 0, Number.MAX_SAFE_INTEGER, 0),
  };
}
export function selectedMeals(state) {
  return planResult(state).meals;
}
export function estimateCart(
  selected,
  servings = 4,
  pantry = [],
  prices = {},
  cache = new Map(),
) {
  const items = shoppingList(selected, servings).map((item) => {
    if (!Object.hasOwn(priceBook, item.name))
      throw new Error(`No price estimate for ${item.name}.`);
    const key = `${item.name}|${item.amount}`;
    let quote = cache.get(key);
    if (!quote) {
      const offers = prices[item.name] || priceBook[item.name].offers;
      quote = { ...cheapestPurchase(item.amount, offers), offers };
      cache.set(key, quote);
    }
    return { ...item, ...quote, owned: pantry.includes(item.name) };
  });
  const cents = items.filter((i) => !i.owned).reduce((n, i) => n + i.cents, 0),
    before = items.reduce((n, i) => n + i.cents, 0);
  return {
    items,
    total: cents / 100,
    beforePantry: before / 100,
    pantrySavings: (before - cents) / 100,
  };
}
export function planResult(state) {
  const cache = new Map();
  const ordinary = rankMeals(state.votes, state.dinners, state.preferences);
  const baseline = estimateCart(
    ordinary,
    state.servings,
    state.pantry,
    state.prices,
    cache,
  );
  let selected = ordinary;
  if (state.locked)
    selected = state.locked.ids
      .map((id) => meals.find((m) => m.id === id))
      .filter(Boolean);
  else if (state.strategy !== "votes") {
    const pool = eligibleMeals(state.preferences),
      count = Math.min(state.dinners, pool.length),
      scores = new Map();
    Object.values(state.votes).forEach((ids) =>
      new Set(ids).forEach((id) => scores.set(id, (scores.get(id) || 0) + 1)),
    );
    let best = null;
    function visit(start, combo, score) {
      if (combo.length === count) {
        const cost = estimateCart(
          combo,
          state.servings,
          state.pantry,
          state.prices,
          cache,
        ).total;
        const feasible =
          state.budget === 0 ||
          Math.round(cost * 100) <= Math.round(state.budget * 100);
        const candidate = { meals: [...combo], cost, score, feasible };
        const better =
          !best ||
          (state.strategy === "cheapest"
            ? cost < best.cost || (cost === best.cost && score > best.score)
            : feasible !== best.feasible
              ? feasible
              : feasible
                ? score > best.score ||
                  (score === best.score && cost < best.cost)
                : cost < best.cost ||
                  (cost === best.cost && score > best.score));
        if (better) best = candidate;
        return;
      }
      for (let i = start; i <= pool.length - (count - combo.length); i++) {
        combo.push(pool[i]);
        visit(i + 1, combo, score + (scores.get(pool[i].id) || 0));
        combo.pop();
      }
    }
    visit(0, [], 0);
    selected = (best?.meals || []).sort(
      (a, b) =>
        (scores.get(b.id) || 0) - (scores.get(a.id) || 0) ||
        meals.indexOf(a) - meals.indexOf(b),
    );
  }
  const estimate = estimateCart(
    selected,
    state.servings,
    state.pantry,
    state.prices,
    cache,
  );
  return {
    meals: selected,
    estimate,
    baseline: baseline.total,
    savings: Math.max(
      0,
      Math.round((baseline.total - estimate.total) * 100) / 100,
    ),
    overBudget:
      state.budget > 0 &&
      Math.round(estimate.total * 100) > Math.round(state.budget * 100),
  };
}
export function applyAction(input, action, payload, voter) {
  const state = normalizeState(input);
  if (state.locked && !["pantry", "reopen", "reset"].includes(action))
    throw new Error("Reopen the menu before changing votes or settings.");
  switch (action) {
    case "vote": {
      if (!voter?.trim()) throw new Error("Enter your name before voting.");
      if (!eligibleMeals(state.preferences).some((m) => m.id === payload.id))
        throw new Error("This meal does not match household preferences.");
      const current = state.votes[voter] || [];
      state.votes[voter] = payload.enabled
        ? [...new Set([...current, payload.id])]
        : current.filter((id) => id !== payload.id);
      break;
    }
    case "settings": {
      if (
        !Number.isInteger(payload.servings) ||
        payload.servings < 1 ||
        payload.servings > 20 ||
        !Number.isInteger(payload.dinners) ||
        payload.dinners < 1 ||
        payload.dinners > 7
      )
        throw new Error("Choose 1–20 people and 1–7 dinners.");
      state.servings = payload.servings;
      state.dinners = payload.dinners;
      state.preferences = {
        vegetarian: payload.preferences?.vegetarian === true,
        quick: payload.preferences?.quick === true,
        keto: payload.preferences?.keto === true,
      };
      if (payload.strategy !== undefined) {
        if (!["votes", "balanced", "cheapest"].includes(payload.strategy))
          throw new Error("Choose a valid savings mode.");
        state.strategy = payload.strategy;
      }
      if (payload.budget !== undefined) {
        if (
          !Number.isFinite(payload.budget) ||
          payload.budget < 0 ||
          payload.budget > 10000 ||
          Math.abs(payload.budget * 100 - Math.round(payload.budget * 100)) >
            1e-7
        )
          throw new Error(
            "Use a budget from $0 to $10,000 with at most two decimal places.",
          );
        state.budget = payload.budget;
      }
      break;
    }
    case "prices":
      if (
        !Object.hasOwn(priceBook, payload.name) ||
        !validOffers(payload.offers)
      )
        throw new Error(
          "Enter two valid package offers with positive sizes and prices from $0 to $10,000.",
        );
      state.prices[payload.name] = payload.offers.map((o) => ({
        ...o,
        label: o.label.trim(),
      }));
      break;
    case "finalize":
      state.locked = { ids: selectedMeals(state).map((m) => m.id) };
      if (!state.locked.ids.length)
        throw new Error("No meals match your preferences.");
      break;
    case "reopen":
      state.locked = null;
      break;
    case "pantry":
      if (
        !shoppingList(selectedMeals(state), state.servings).some(
          (i) => i.name === payload.name,
        )
      )
        throw new Error("That ingredient is not on the current list.");
      state.pantry = payload.enabled
        ? [...new Set([...state.pantry, payload.name])]
        : state.pantry.filter((n) => n !== payload.name);
      break;
    case "reset":
      state.votes = Object.create(null);
      state.pantry = [];
      state.locked = null;
      break;
    default:
      throw new Error("Unknown planner action.");
  }
  state.revision++;
  return state;
}
export function listText(state, week) {
  const planned = planResult(state),
    items = planned.estimate.items.filter((i) => !i.owned);
  return `Dinner Table — ${week}${state.locked ? "" : " (draft menu)"}\n${items
    .map(
      (i) =>
        `${i.name}: ${Number(i.amount.toFixed(2))} ${i.unit}\n  Buy ${i.counts
          .map((n, j) =>
            n
              ? `${n} x ${i.offers[j].label} (${i.offers[j].size} ${i.unit})`
              : "",
          )
          .filter(Boolean)
          .join(" + ")} — estimated $${i.cost.toFixed(2)}`,
    )
    .join(
      "\n",
    )}\nEstimated grocery subtotal: $${planned.estimate.total.toFixed(2)} USD. Store prices, availability, taxes, and fees may differ. ${planned.overBudget ? "Above your budget target." : ""}`;
}
