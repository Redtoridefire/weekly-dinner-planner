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
];
export function eligibleMeals(preferences = {}) {
  return meals.filter(
    (m) =>
      (!preferences.vegetarian || m.vegetarian) &&
      (!preferences.quick || m.time <= 30),
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
    },
    revision: bounded(input.revision, 0, Number.MAX_SAFE_INTEGER, 0),
  };
}
export function selectedMeals(state) {
  return state.locked
    ? state.locked.ids
        .map((id) => meals.find((m) => m.id === id))
        .filter(Boolean)
    : rankMeals(state.votes, state.dinners, state.preferences);
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
      };
      break;
    }
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
  const items = shoppingList(selectedMeals(state), state.servings).filter(
    (i) => !state.pantry.includes(i.name),
  );
  return `Dinner Table — ${week}${state.locked ? "" : " (draft menu)"}\n${items.map((i) => `${i.name}: ${Number(i.amount.toFixed(2))} ${i.unit}`).join("\n")}`;
}
