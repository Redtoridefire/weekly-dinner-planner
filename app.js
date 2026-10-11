import {
  meals,
  eligibleMeals,
  weekKey,
  normalizeState,
  selectedMeals,
  shoppingList,
  applyAction,
  listText,
  planResult,
  estimateCart,
} from "./model.js";
import { priceBook } from "./prices.js";
import { Cloud } from "./cloud.js";
const $ = (id) => document.getElementById(id);
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const quantity = (item) => `${Number(item.amount.toFixed(2))} ${item.unit}`;
const money = (value) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    value,
  );
let priceRenderKey = "";
let state = normalizeState(),
  week = weekKey(),
  cloud = null,
  session = null,
  homes = [],
  home = null,
  owner = true,
  busy = true,
  lastSync = 0,
  memberCount = 0,
  pendingAuth;
const localKey = () => `dinner-table:${week}`;
const error = (message) => {
  $("error-text").textContent = message;
  $("error").hidden = false;
};
const announce = (message) => {
  $("status").textContent = message;
};
function readLocal() {
  week = weekKey();
  try {
    const raw = localStorage.getItem(localKey()),
      saved = raw ? JSON.parse(raw) : {};
    const defaults = JSON.parse(
      localStorage.getItem("dinner-table:planning") || "{}",
    );
    state = normalizeState(raw ? saved : defaults);
    if (!raw || !saved?.preferences) {
      const prefs = JSON.parse(
        localStorage.getItem("dinner-table:preferences") || "{}",
      );
      state.preferences = {
        vegetarian: prefs.vegetarian === true,
        quick: prefs.quick === true,
        keto: prefs.keto === true,
      };
    }
  } catch {
    state = normalizeState();
    error(
      "Saved browser data could not be read. Your planner can still be used; export a backup before closing this page.",
    );
  }
  owner = true;
}
function saveLocal() {
  try {
    localStorage.setItem(localKey(), JSON.stringify(state));
    localStorage.setItem(
      "dinner-table:planning",
      JSON.stringify({
        servings: state.servings,
        dinners: state.dinners,
        strategy: state.strategy,
        budget: state.budget,
        prices: state.prices,
      }),
    );
    localStorage.setItem(
      "dinner-table:preferences",
      JSON.stringify(state.preferences),
    );
    return true;
  } catch {
    error(
      "Browser storage is unavailable or full. Your changes are kept only while this page is open. Download a backup to keep them.",
    );
    return false;
  }
}
function focusToken() {
  const el = document.activeElement;
  return {
    id: el?.id,
    meal: el?.dataset?.meal,
    ingredient: el?.dataset?.ingredient,
  };
}
function restoreFocus(token) {
  let el = token.id
    ? $(token.id)
    : token.meal
      ? document.querySelector(`[data-meal="${CSS.escape(token.meal)}"]`)
      : token.ingredient
        ? document.querySelector(
            `[data-ingredient="${CSS.escape(token.ingredient)}"]`,
          )
        : null;
  if (el && !el.disabled && !el.closest("[hidden]"))
    el.focus({ preventScroll: true });
}
function render() {
  const focus = focusToken();
  const locked = Boolean(state.locked);
  const canManage = owner && !busy;
  const planned = planResult(state),
    selected = planned.meals,
    shopping = planned.estimate.items;
  $("planner").setAttribute("aria-busy", String(busy));
  // Keep the requested settings visible while their shared write is pending.
  // The completed response (or failure recovery) restores canonical values.
  if (!busy) {
    $("servings").value = state.servings;
    $("dinners").value = state.dinners;
    $("vegetarian-only").checked = state.preferences.vegetarian;
    $("quick-only").checked = state.preferences.quick;
    $("keto-only").checked = state.preferences.keto;
    $("strategy").value = state.strategy;
    $("budget").value = state.budget;
  }
  [
    "servings",
    "dinners",
    "vegetarian-only",
    "quick-only",
    "keto-only",
    "strategy",
    "budget",
  ].forEach((id) => ($(id).disabled = locked || !canManage));
  $("voter-label").hidden = Boolean(home);
  $("voter").value = state.voter;
  $("finalize").textContent = locked ? "Reopen voting" : "Finalize menu";
  $("finalize").disabled = !canManage || !selected.length;
  $("reset").disabled = !canManage;
  $("week-label").textContent =
    `WEEK OF ${new Date(`${week}T12:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric" })}${home ? ` · ${home.timezone}` : ""}`;
  $("connection-state").textContent = busy
    ? "Working…"
    : home
      ? navigator.onLine
        ? "Shared household"
        : "Offline"
      : cloud
        ? "Local trial"
        : "Local mode";
  $("connection-description").textContent = home
    ? `${home.name} · ${memberCount} ${memberCount === 1 ? "member" : "members"} · ${owner ? "You manage this household." : "The household owner manages menu settings."}`
    : cloud
      ? "Sign in and create or join a household to share votes across devices. Until then, you can try the local planner below."
      : "Your planner works in this browser. Connect shared household voting to bring everyone’s phones to the same table.";
  $("mode-note").textContent = home
    ? `${session.user.email} · Changes sync across your household. Updates are checked every 15 seconds while this page is visible.`
    : "Local mode · Names, votes, and pantry choices are saved only in this browser. Different devices do not share this data.";
  const shortage =
    selected.length < state.dinners
      ? ` Only ${selected.length} meals match your preferences for ${state.dinners} requested dinners.`
      : "";
  $("plan-state").textContent = locked
    ? "Menu finalized. Voting and meal settings are paused. Reopen voting to make changes."
    : `Draft menu · Votes, preferences, prices, and pantry choices can change your plan.${shortage}`;
  $("shopping-state").textContent = locked
    ? "Finalized menu · Your shopping list is ready to review."
    : "Draft shopping list · Finalize your menu in Dinner plan before shopping.";
  $("budget-summary").innerHTML =
    `<strong>Estimated groceries: ${money(planned.estimate.total)}</strong><span>Full packages for ${selected.length} dinners · ${state.servings} people · ${money(planned.estimate.pantrySavings)} of purchases avoided using pantry items.</span>${planned.savings > 0 && state.strategy !== "votes" && !locked ? `<span>${money(planned.savings)} less than the votes-first menu, using the same estimated prices.</span>` : ""}${planned.overBudget ? `<span class="budget-warning">${money(planned.estimate.total - state.budget)} above your ${money(state.budget)} target.${state.strategy === "votes" ? " Try Votes within budget or Lowest grocery estimate." : locked ? " Reopen your menu to compare alternatives." : " No eligible menu fits this target; adjust dinners, servings, pantry items, or your prices."}</span>` : state.budget > 0 ? `<span>Within your ${money(state.budget)} target.</span>` : ""}<small>Estimated item subtotal only. Store prices and checkout fees can change the total.</small>`;
  const voter = home ? session.user.id : state.voter.trim().toLowerCase();
  const ownVotes = state.votes[voter] || [];
  const filter = $("filter").value;
  $("meals").innerHTML =
    eligibleMeals(state.preferences)
      .filter(
        (m) =>
          filter === "all" ||
          (filter === "vegetarian" && m.vegetarian) ||
          (filter === "quick" && m.time <= 30) ||
          (filter === "keto" && m.keto),
      )
      .map((m) => {
        const voted = ownVotes.includes(m.id);
        const count = Object.values(state.votes).filter((v) =>
          v.includes(m.id),
        ).length;
        const mealEstimate = estimateCart(
          [m],
          state.servings,
          state.pantry,
          state.prices,
        ).total;
        return `<article class="card"><div class="dish" style="--dish:${m.color}" aria-hidden="true">${m.emoji}</div><div class="card-content"><span class="tag">${m.vegetarian ? "Vegetarian" : "Household favorite"}${m.keto ? " · Keto-style" : ""}</span><h3>${m.name}</h3><p>${m.description}</p><div class="meta">${m.time} min · Serves ${state.servings}</div><div class="meal-price">Est. groceries ${money(mealEstimate)}<small>Packages needed for this dinner; shared ingredients count once in the weekly total.</small></div><div class="vote-row"><span>${count} ${count === 1 ? "vote" : "votes"}</span><button class="vote-button ${voted ? "selected" : ""}" data-meal="${m.id}" aria-pressed="${voted}" aria-label="${voted ? "Remove vote for" : "Vote for"} ${m.name}" ${locked || busy ? "disabled" : ""}>${voted ? "✓ Voted" : "+ Vote"}</button></div></div></article>`;
      })
      .join("") ||
    "<p>No meals match this view. Try another display filter.</p>";
  const hasVotes = Object.values(state.votes).some((v) => v.length);
  $("plan-list").innerHTML =
    `${!hasVotes && !locked ? "<p>No votes yet — this is a suggested plan. Cast votes to shape it.</p>" : ""}` +
    selected
      .map(
        (m, i) =>
          `<article class="plan-row"><span class="emoji" aria-hidden="true">${m.emoji}</span><div><span class="tag">Dinner ${i + 1}</span><h3>${m.name}</h3><p>${m.time} minutes · ${state.servings} people</p><details><summary>How to make ${m.name.toLowerCase()}</summary><p>${m.steps}</p><p>Ingredients: ${m.ingredients.map(([name, unit, amount]) => `${quantity({ amount: (amount * state.servings) / 4, unit })} ${name.toLowerCase()}`).join(", ")}. Season to taste and check labels for allergens.</p></details></div></article>`,
      )
      .join("");
  $("shopping").innerHTML = shopping
    .map(
      (item) =>
        `<div class="shopping-item"><label class="ingredient ${item.owned ? "checked" : ""}"><input type="checkbox" data-ingredient="${escape(item.name)}" ${item.owned ? "checked" : ""} ${busy ? "disabled" : ""}><span>${item.name}</span><b>${quantity(item)}</b></label><p class="package-choice">${
          item.owned
            ? "Already owned · estimated purchase avoided"
            : item.counts
                .map((n, i) =>
                  n
                    ? `${n} × ${escape(item.offers[i].label)} (${item.offers[i].size} ${item.unit})`
                    : "",
                )
                .filter(Boolean)
                .join(" + ")
        } · ${money(item.cost)}${item.owned ? " avoided" : " estimated"}</p></div>`,
    )
    .join("");
  $("grocery").hidden = !home;
  $("grocery").disabled = busy || !locked || shopping.every((i) => i.owned);
  renderPrices(locked || !owner);
  $("import").disabled = Boolean(home) || busy;
  $("invite").hidden = !home || !owner;
  $("manage-members").hidden = !home;
  [
    "invite",
    "manage-members",
    "refresh",
    "sign-out",
    "show-create",
    "show-join",
    "copy",
    "download",
    "export",
    "household-select",
  ].forEach((id) => ($(id).disabled = busy));
  document
    .querySelectorAll(
      "#sign-in-form button,#create-form button,#join-form button",
    )
    .forEach((b) => (b.disabled = busy));
  if (!$("copy-fallback-label").hidden)
    $("copy-fallback").value = listText(state, week);
  restoreFocus(focus);
}
function renderPrices(readOnly) {
  const query = $("price-search").value.trim().toLowerCase();
  const key = JSON.stringify([state.prices, query]);
  if (key !== priceRenderKey) {
    const opened = new Set(
      [...document.querySelectorAll("#price-forms details[open]")].map(
        (el) => el.dataset.priceName,
      ),
    );
    $("price-forms").innerHTML =
      Object.entries(priceBook)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, entry], index) => {
          if (!name.toLowerCase().includes(query)) return "";
          const offers = state.prices[name] || entry.offers;
          return `<details class="price-entry" data-price-name="${escape(name)}" ${opened.has(name) ? "open" : ""}><summary>${escape(name)} <small>${state.prices[name] ? "Your prices" : "Illustrative estimates"}</small></summary><form data-price-name="${escape(name)}">${offers.map((o, i) => `<fieldset><legend>Package ${i + 1}</legend><label for="price-${index}-${i}-label">Package label</label><input id="price-${index}-${i}-label" name="label-${i}" value="${escape(o.label)}" required maxlength="40"><label for="price-${index}-${i}-size">Package size (${escape(entry.unit)})</label><input id="price-${index}-${i}-size" name="size-${i}" type="number" min="1" max="100000" step="any" value="${o.size}" required><label for="price-${index}-${i}-cost">Package price (USD)</label><input id="price-${index}-${i}-cost" name="price-${i}" type="number" min="0" max="10000" step="0.01" value="${o.price}" required></fieldset>`).join("")}<button type="submit">Save ${escape(name.toLowerCase())} prices</button></form></details>`;
        })
        .join("") || "<p>No ingredients match your search.</p>";
    priceRenderKey = key;
  }
  document
    .querySelectorAll("#price-forms input,#price-forms button")
    .forEach((el) => (el.disabled = readOnly || busy));
}
async function confirmChange(message) {
  $("confirm-description").textContent = message;
  const dialog = $("confirm-dialog");
  dialog.returnValue = "";
  dialog.showModal();
  return new Promise((resolve) =>
    dialog.addEventListener(
      "close",
      () => resolve(dialog.returnValue === "confirm"),
      { once: true },
    ),
  );
}
function flushAuth() {
  if (busy || pendingAuth === undefined) return;
  const next = pendingAuth;
  pendingAuth = undefined;
  if (next?.user.id !== session?.user.id) task(() => authChanged(next));
}
async function task(work) {
  if (busy) return;
  const focus = focusToken();
  busy = true;
  $("error").hidden = true;
  render();
  try {
    await work();
  } catch (e) {
    error(e.message || "Something went wrong. Please try again.");
  } finally {
    busy = false;
    render();
    restoreFocus(focus);
    queueMicrotask(flushAuth);
  }
}
function acceptSnapshot(snapshot) {
  if (!snapshot || !/^\d{4}-\d{2}-\d{2}$/.test(snapshot.week))
    throw new Error(
      "The household response was incomplete. Check that the database migration was applied.",
    );
  if (snapshot.schemaVersion !== 2)
    throw new Error(
      "Shared savings and keto planning need the latest database migration. Apply 202610110002_savings_keto.sql from the setup guide, then refresh.",
    );
  week = snapshot.week;
  state = normalizeState(snapshot.state);
  owner = snapshot.owner === true;
  memberCount = snapshot.memberCount;
  lastSync = Date.now();
}
function invalidateGrocery() {
  $("grocery-link").href = "https://www.instacart.com/";
  $("grocery-link").textContent = "Open Instacart (new tab) ↗";
}
async function confirmCurrent(message) {
  const version = `${home?.id || "local"}:${week}:${state.revision}`;
  if (!(await confirmChange(message))) return false;
  if (version !== `${home?.id || "local"}:${week}:${state.revision}`) {
    error(
      "The planner changed while you were deciding. Review it and try again.",
    );
    return false;
  }
  return true;
}
async function act(action, payload = {}) {
  await task(async () => {
    if (home) {
      try {
        acceptSnapshot(
          await cloud.mutate(home.id, week, state.revision, action, payload),
        );
      } catch (e) {
        try {
          acceptSnapshot(await cloud.snapshot(home.id));
        } catch {}
        throw e;
      }
    } else {
      if (weekKey() !== week) {
        readLocal();
        throw new Error(
          "A new week has started. Please make your changes again in this week’s planner.",
        );
      }
      state = applyAction(
        state,
        action,
        payload,
        state.voter.trim().toLowerCase(),
      );
      if (!saveLocal()) return;
    }
    invalidateGrocery();
    announce(
      action === "finalize"
        ? "Menu finalized. Your shopping list is ready."
        : action === "reopen"
          ? "Voting reopened."
          : home
            ? "Saved to your household."
            : "Saved in this browser.",
    );
  });
}
function setView(view, focus = false) {
  document.querySelectorAll(".tab").forEach((b) => {
    const active = b.dataset.view === view;
    b.classList.toggle("active", active);
    b.setAttribute("aria-selected", String(active));
    b.tabIndex = active ? 0 : -1;
  });
  ["vote", "plan", "shop"].forEach((id) => ($(id).hidden = id !== view));
  if (focus) $(`tab-${view}`).focus();
}
$("dismiss-error").addEventListener("click", () => {
  $("error").hidden = true;
});
$("meals").addEventListener("click", (e) => {
  const b = e.target.closest("[data-meal]");
  if (!b) return;
  const voter = home ? session.user.id : state.voter.trim().toLowerCase();
  if (!voter) {
    error("Enter your name before voting.");
    $("voter").focus();
    return;
  }
  act("vote", {
    id: b.dataset.meal,
    enabled: !(state.votes[voter] || []).includes(b.dataset.meal),
  });
});
$("voter").addEventListener("input", () => {
  if (home) return;
  state.voter = $("voter").value;
  saveLocal();
  render();
});
function settings() {
  const servings = Number($("servings").value),
    dinners = Number($("dinners").value),
    budget = Number($("budget").value);
  if (!Number.isInteger(servings) || servings < 1 || servings > 20) {
    error("Choose a whole number from 1 to 20 for people.");
    render();
    $("servings").focus();
    return;
  }
  act("settings", {
    servings,
    dinners,
    preferences: {
      vegetarian: $("vegetarian-only").checked,
      quick: $("quick-only").checked,
      keto: $("keto-only").checked,
    },
    strategy: $("strategy").value,
    budget,
  });
}
[
  "servings",
  "dinners",
  "vegetarian-only",
  "quick-only",
  "keto-only",
  "strategy",
  "budget",
].forEach((id) => $(id).addEventListener("change", settings));
$("price-search").addEventListener("input", () =>
  renderPrices(Boolean(state.locked) || !owner),
);
$("price-forms").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.target.closest("form[data-price-name]");
  if (!form || busy) return;
  const values = new FormData(form);
  const offers = [0, 1].map((i) => ({
    label: values.get(`label-${i}`),
    size: Number(values.get(`size-${i}`)),
    price: Number(values.get(`price-${i}`)),
  }));
  act("prices", { name: form.dataset.priceName, offers });
});
$("filter").addEventListener("change", render);
$("finalize").addEventListener("click", async () => {
  const action = state.locked ? "reopen" : "finalize";
  if (
    state.locked &&
    !(await confirmCurrent(
      "Reopen voting? Your menu and shopping list can change again.",
    ))
  )
    return;
  act(action);
});
$("reset").addEventListener("click", async () => {
  if (
    await confirmCurrent(
      "Clear this week’s votes, finalized menu, and pantry selections? Household preferences will be kept.",
    )
  )
    act("reset");
});
document.querySelectorAll(".tab").forEach((b) => {
  b.addEventListener("click", () => setView(b.dataset.view));
  b.addEventListener("keydown", (e) => {
    const tabs = [...document.querySelectorAll(".tab")];
    let index = tabs.indexOf(b);
    if (e.key === "ArrowRight") index = (index + 1) % tabs.length;
    else if (e.key === "ArrowLeft")
      index = (index + tabs.length - 1) % tabs.length;
    else if (e.key === "Home") index = 0;
    else if (e.key === "End") index = tabs.length - 1;
    else return;
    e.preventDefault();
    setView(tabs[index].dataset.view, true);
  });
});
$("shopping").addEventListener("change", (e) => {
  if (e.target.dataset.ingredient)
    act("pantry", {
      name: e.target.dataset.ingredient,
      enabled: e.target.checked,
    });
});
async function copyText(text, input) {
  try {
    await navigator.clipboard.writeText(text);
    announce("Copied to clipboard.");
  } catch {
    if (input) {
      input.focus();
      input.select();
      announce("Select and copy the highlighted invitation code.");
    } else {
      $("copy-fallback-label").hidden = false;
      $("copy-fallback").value = text;
      $("copy-fallback").focus();
      $("copy-fallback").select();
      announce(
        "Clipboard unavailable. Select and copy the shopping list below.",
      );
    }
  }
}
$("copy").addEventListener("click", () => copyText(listText(state, week)));
function download(contents, name, type) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$("download").addEventListener("click", () =>
  download(listText(state, week), `dinner-shopping-${week}.txt`, "text/plain"),
);
$("export").addEventListener("click", () => {
  download(
    JSON.stringify(
      { version: 1, week, mode: home ? "shared" : "local", state },
      null,
      2,
    ),
    `dinner-backup-${week}.json`,
    "application/json",
  );
  announce(
    "Backup downloaded. It contains household votes, but no sign-in credentials. Keep it private.",
  );
});
$("import").addEventListener("change", async () => {
  const file = $("import").files[0];
  if (!file) return;
  try {
    if (home) throw new Error("Backups can only be restored in local mode.");
    if (file.size > 1000000)
      throw new Error("Choose a planner backup smaller than 1 MB.");
    const backup = JSON.parse(await file.text());
    if (
      backup.version !== 1 ||
      !backup.state ||
      typeof backup.state !== "object" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(backup.week)
    )
      throw new Error("This is not a supported Dinner Table backup.");
    if (
      !(await confirmChange(
        `Replace the current local week with this backup from ${backup.week}? Export your current planner first if you want to keep it.`,
      ))
    )
      return;
    state = normalizeState(backup.state);
    saveLocal();
    invalidateGrocery();
    render();
    announce("Backup restored to the current local week.");
  } catch (e) {
    error(e.message || "Unable to read this backup.");
  } finally {
    $("import").value = "";
  }
});
$("print-plan").addEventListener("click", () => window.print());
async function loadHomes(preferred) {
  homes = await cloud.households();
  $("household-select").innerHTML = homes
    .map((h) => `<option value="${escape(h.id)}">${escape(h.name)}</option>`)
    .join("");
  $("household-select-label").hidden = !homes.length;
  let stored;
  try {
    stored = localStorage.getItem("dinner-table:home");
  } catch {}
  const nextHome =
    homes.find((h) => h.id === (preferred || stored)) || homes[0] || null;
  if (nextHome) {
    const snapshot = await cloud.snapshot(nextHome.id);
    acceptSnapshot(snapshot);
    home = nextHome;
    $("household-select").value = home.id;
    try {
      localStorage.setItem("dinner-table:home", home.id);
    } catch {}
  } else {
    home = null;
    readLocal();
  }
  $("invitation").hidden = true;
  $("members").hidden = true;
  invalidateGrocery();
}
async function authChanged(next) {
  session = next;
  $("signed-in").hidden = !session;
  $("sign-in-form").hidden = Boolean(session) || !cloud;
  if (session) {
    $("account-email").textContent = session.user.email;
    await loadHomes();
  } else {
    home = null;
    homes = [];
    readLocal();
  }
  render();
}
$("sign-in-form").addEventListener("submit", (e) => {
  e.preventDefault();
  task(async () => {
    await cloud.signIn($("email").value.trim());
    announce(
      "Check your email for the sign-in link. Open it on this device to continue.",
    );
  });
});
$("sign-out").addEventListener("click", () =>
  task(async () => {
    await cloud.signOut();
    await authChanged(null);
    announce("Signed out. Your local planner is available again.");
  }),
);
$("show-create").addEventListener("click", () => {
  $("create-form").hidden = !$("create-form").hidden;
  $("join-form").hidden = true;
  if (!$("create-form").hidden) $("home-name").focus();
});
$("show-join").addEventListener("click", () => {
  $("join-form").hidden = !$("join-form").hidden;
  $("create-form").hidden = true;
  if (!$("join-form").hidden) $("invite-code").focus();
});
$("create-form").addEventListener("submit", (e) => {
  e.preventDefault();
  task(async () => {
    const id = await cloud.create(
      $("home-name").value.trim(),
      $("home-timezone").value,
    );
    await loadHomes(id);
    $("create-form").reset();
    $("create-form").hidden = true;
    announce("Household created. Invite your people to start voting.");
  });
});
$("join-form").addEventListener("submit", (e) => {
  e.preventDefault();
  task(async () => {
    const id = await cloud.join($("invite-code").value.trim());
    await loadHomes(id);
    $("join-form").reset();
    $("join-form").hidden = true;
    announce("You joined the household.");
  });
});
$("household-select").addEventListener("change", () =>
  task(async () => {
    await loadHomes($("household-select").value);
    announce("Household loaded.");
  }),
);
$("invite").addEventListener("click", async () => {
  if (
    !(await confirmChange(
      "Create a new invitation code? Any previous invitation code will stop working. Existing members keep access.",
    ))
  )
    return;
  task(async () => {
    $("new-invite").value = await cloud.invite(home.id);
    $("invitation").hidden = false;
    announce(
      "Invitation code created. Share it privately with your household.",
    );
  });
});
$("copy-invite").addEventListener("click", () =>
  copyText($("new-invite").value, $("new-invite")),
);
$("refresh").addEventListener("click", () =>
  task(async () => {
    await loadHomes(home?.id);
    announce("Household refreshed.");
  }),
);
$("grocery").addEventListener("click", () =>
  task(async () => {
    const result = await cloud.grocery(home.id, week, state.revision);
    const latest = await cloud.snapshot(home.id);
    if (latest.week !== week || latest.state.revision !== state.revision) {
      acceptSnapshot(latest);
      invalidateGrocery();
      throw new Error(
        "Your household changed while the grocery link was created. Review the updated list and try again.",
      );
    }
    const url = new URL(result.url);
    if (
      url.protocol !== "https:" ||
      !/(^|\.)instacart\.(com|tools)$/.test(url.hostname)
    )
      throw new Error(
        "The grocery service returned an unexpected link. Use Copy shopping list instead.",
      );
    $("grocery-link").href = url.href;
    $("grocery-link").textContent = "Review groceries in Instacart (new tab) ↗";
    announce(
      "Your shopping link is ready. Open it to review products and checkout in Instacart.",
    );
  }),
);
$("manage-members").addEventListener("click", () =>
  task(async () => {
    const members = await cloud.rpc("dinner_members_list", {
      household_id: home.id,
    });
    $("members").hidden = false;
    $("members").innerHTML =
      "<h3>Household members</h3>" +
      members
        .map(
          (m) =>
            `<div class="member-row"><span>${escape(m.name)}${m.owner ? " (owner)" : ""}${m.id === session.user.id ? " (you)" : ""}</span>${!m.owner && (owner || m.id === session.user.id) ? `<button data-remove-member="${escape(m.id)}">${m.id === session.user.id ? "Leave household" : "Remove member"}</button>` : ""}</div>`,
        )
        .join("") +
      (owner
        ? '<button id="delete-household" class="danger">Delete household</button>'
        : "");
  }),
);
$("members").addEventListener("click", async (e) => {
  const button = e.target.closest("[data-remove-member],#delete-household");
  if (!button) return;
  const deleting = button.id === "delete-household";
  const leaving = button.dataset.removeMember === session.user.id;
  if (
    !(await confirmChange(
      deleting
        ? "Permanently delete this household, all votes, menus, and invitations? Export a backup first if you want to keep them."
        : leaving
          ? "Leave this household? You will need a new invitation to rejoin."
          : "Remove this member’s household access? Existing votes will also be removed.",
    ))
  )
    return;
  task(async () => {
    await cloud.rpc(
      deleting ? "dinner_delete_household" : "dinner_remove_member",
      deleting
        ? { household_id: home.id }
        : { household_id: home.id, member_id: button.dataset.removeMember },
    );
    await loadHomes(home.id);
    announce(
      deleting
        ? "Household deleted."
        : leaving
          ? "You left the household."
          : "Member removed.",
    );
  });
});
async function refreshIfNeeded() {
  if (
    busy ||
    document.hidden ||
    document.activeElement?.closest("#price-editor")
  )
    return;
  if (!home) {
    if (weekKey() !== week) {
      readLocal();
      invalidateGrocery();
      render();
      announce("A new week is ready.");
    }
    return;
  }
  if (!navigator.onLine) {
    render();
    return;
  }
  if (Date.now() - lastSync < 15000) return;
  const requestedHome = home.id;
  try {
    const snapshot = await cloud.snapshot(requestedHome);
    if (busy || home?.id !== requestedHome) return;
    if (
      snapshot.week > week ||
      (snapshot.week === week && snapshot.state.revision > state.revision)
    ) {
      acceptSnapshot(snapshot);
      invalidateGrocery();
      render();
      announce("Household updates received.");
    } else lastSync = Date.now();
  } catch {
    lastSync = Date.now();
    error(
      "Could not refresh your household. Check your connection, then use Refresh household. Unsaved actions are not queued.",
    );
  }
}
window.addEventListener("online", () => {
  announce("Back online. Refreshing your household.");
  lastSync = 0;
  refreshIfNeeded();
});
window.addEventListener("offline", () => {
  error(
    "You are offline. Shared changes need a connection; your local planner still works.",
  );
  render();
});
document.addEventListener("visibilitychange", refreshIfNeeded);
window.addEventListener("storage", (e) => {
  if (
    !home &&
    [localKey(), "dinner-table:preferences", "dinner-table:planning"].includes(
      e.key,
    )
  ) {
    readLocal();
    render();
    announce("Local planner updated in another tab.");
  }
});
setInterval(refreshIfNeeded, 15000);
async function init() {
  readLocal();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const zones =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : [
          "America/New_York",
          "America/Chicago",
          "America/Denver",
          "America/Los_Angeles",
          "Europe/London",
          "Etc/UTC",
        ];
  if (!zones.includes(timezone)) zones.push(timezone);
  $("home-timezone").innerHTML = zones
    .sort()
    .map(
      (z) =>
        `<option ${z === timezone ? "selected" : ""}>${escape(z)}</option>`,
    )
    .join("");
  render();
  try {
    const response = await fetch("./config.json", {
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw new Error(
        "Unable to load configuration. The local planner is available; check the deployment files.",
      );
    const config = await response.json();
    if (Boolean(config.supabaseUrl) !== Boolean(config.supabaseKey))
      throw new Error(
        "Shared voting configuration is incomplete. Set both the public Supabase URL and publishable key.",
      );
    if (config.supabaseUrl) {
      cloud = new Cloud(config);
      await authChanged(await cloud.session());
      cloud.client.auth.onAuthStateChange((event, next) => {
        if (
          ["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED"].includes(event) &&
          next?.user.id !== session?.user.id
        ) {
          pendingAuth = next;
          setTimeout(flushAuth, 0);
        } else if (next) session = next;
      });
    }
  } catch (e) {
    error(
      e.message ||
        "Shared voting could not start. The local planner is available.",
    );
    if (cloud && !session) {
      $("sign-in-form").hidden = false;
      $("signed-in").hidden = true;
    }
  } finally {
    busy = false;
    render();
    flushAuth();
  }
}
init();
