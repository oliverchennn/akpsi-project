export const round = (value) => Math.round(value * 100) / 100;
export const clamp = (value, min, max) =>
  Math.min(
    max,
    Math.max(min, Number.isFinite(Number(value)) ? Number(value) : min),
  );
export const net = (item) => round(Math.max(item.gross - item.tare, 0));
export const isLow = (item) => net(item) <= item.threshold;
export const stateLabel = (item) =>
  net(item) === 0 ? "Empty" : isLow(item) ? "Low stock" : "In stock";
export const AFTERNOON_SECONDS = 15;
export const AFTERNOON_DURATIONS = [15, 30, 45, 60, 90, 120];
const freshSimulation = (duration = AFTERNOON_SECONDS) => ({ running: false, started: false, elapsed: 0, duration, plan: [] });
const isOpen = (request) => ["pending", "approved"].includes(request.status);
export function initialState() {
  return {
    autoReorder: false,
    simulation: freshSimulation(),
    sequence: 0,
    requests: [],
    activity: [
      {
        id: 0,
        type: "start",
        title: "Your virtual store is ready",
        detail: "Four sample bins. Turn a dial to change the gross weight.",
        time: Date.now(),
      },
    ],
    items: [
      {
        id: "coffee",
        name: "Coffee beans",
        category: "Whole bean · Bulk goods",
        tare: 0.5,
        capacity: 10,
        threshold: 2,
        monthly: 40,
        gross: 7.7,
      },
      {
        id: "rice",
        name: "Jasmine rice",
        category: "Dry grain · Bulk goods",
        tare: 0.8,
        capacity: 15,
        threshold: 3,
        monthly: 75,
        gross: 12.2,
      },
      {
        id: "oats",
        name: "Rolled oats",
        category: "Whole grain · Bulk goods",
        tare: 0.4,
        capacity: 8,
        threshold: 1.5,
        monthly: 30,
        gross: 4.4,
      },
      {
        id: "sugar",
        name: "Cane sugar",
        category: "Baking · Bulk goods",
        tare: 0.6,
        capacity: 12,
        threshold: 2.5,
        monthly: 50,
        gross: 9.0,
      },
    ],
  };
}
function log(state, type, title, detail) {
  state.activity.unshift({
    id: ++state.sequence,
    type,
    title,
    detail,
    time: Date.now(),
  });
  state.activity = state.activity.slice(0, 40);
}
function ensureRequest(state, item) {
  if (!state.autoReorder || !isLow(item) ||
      state.requests.some((r) => r.itemId === item.id && isOpen(r))) return;
  state.requests.unshift({
    id: ++state.sequence,
    itemId: item.id,
    name: item.name,
    amount: round(item.capacity - net(item)),
    status: "pending",
  });
  log(state, "request", "Approval needed", `${item.name} is low. Review its simulated top-up request.`);
}
export function setAutoReorder(state, enabled) {
  state.autoReorder = Boolean(enabled);
  if (state.autoReorder) state.items.forEach((item) => ensureRequest(state, item));
}
export function approveRequest(state, requestId) {
  const request = state.requests.find((r) => r.id === Number(requestId));
  if (!request || request.status !== "pending") return false;
  const item = state.items.find((i) => i.id === request.itemId);
  if (!item) return false;
  request.amount = round(Math.max(0, item.capacity - net(item)));
  request.status = "approved";
  log(state, "approved", "Demo request approved", `${item.name} · ${request.amount.toFixed(2)} kg approved. Simulate delivery when ready.`);
  return true;
}
export function deliverRequest(state, requestId) {
  const request = state.requests.find((r) => r.id === Number(requestId));
  if (!request || request.status !== "approved") return false;
  const item = state.items.find((i) => i.id === request.itemId);
  if (!item) return false;
  const delivered = round(Math.min(request.amount, item.capacity - net(item)));
  request.status = "fulfilled";
  updateItem(state, item.id, { gross: item.tare + net(item) + delivered }, "delivery");
  log(state, "refill", "Demo delivery received", `${item.name} · ${delivered.toFixed(2)} kg added. ${net(item).toFixed(2)} kg now in the bin.`);
  return true;
}
export function startAfternoon(state) {
  const sim = state.simulation;
  if (sim.running) return;
  const newRun = !sim.started || sim.elapsed >= sim.duration;
  if (newRun) {
    sim.started = true;
    sim.elapsed = 0;
    sim.plan = state.items.map((item) => ({ id: item.id, amount: net(item), used: 0 }));
    setAutoReorder(state, true);
  }
  sim.running = true;
  log(state, "simulation", newRun ? "Busy afternoon started" : "Busy afternoon resumed", `Starting stock is consumed over ${sim.duration} seconds. All activity is simulated.`);
}
export function pauseAfternoon(state) {
  if (!state.simulation.running) return;
  state.simulation.running = false;
  log(state, "simulation", "Busy afternoon paused", "Stock consumption is paused. Resume when ready.");
}
export function resetSimulation(state) {
  state.simulation = freshSimulation(state.simulation.duration);
}
export function setAfternoonDuration(state, seconds) {
  const duration = Number(seconds);
  if (!AFTERNOON_DURATIONS.includes(duration)) return false;
  const sim = state.simulation;
  sim.elapsed = (sim.elapsed / sim.duration) * duration;
  sim.duration = duration;
  return true;
}
export function advanceAfternoon(state, seconds = 0.25) {
  const sim = state.simulation;
  if (!sim.running || !Number.isFinite(seconds) || seconds <= 0) return;
  sim.elapsed = Math.min(sim.duration, sim.elapsed + seconds);
  sim.plan.forEach((entry) => {
    const item = state.items.find((i) => i.id === entry.id);
    const used = round(entry.amount * sim.elapsed / sim.duration);
    const consumption = round(used - entry.used);
    entry.used = used;
    if (item && net(item) > 0 && consumption > 0) {
      updateItem(state, item.id, { gross: Math.max(item.tare, round(item.gross - consumption)) });
    }
  });
  if (sim.elapsed >= sim.duration) {
    sim.running = false;
    log(state, "simulation", "Busy afternoon complete", `${sim.duration}-second simulation finished. Approve requests, then simulate their deliveries.`);
  }
}
export function updateItem(state, id, patch, reason = "weight") {
  const item = state.items.find((i) => i.id === id);
  if (!item) return;
  const wasLow = isLow(item);
  const before = JSON.stringify(item);
  Object.assign(item, patch);
  item.name = String(item.name).trim().slice(0, 40) || "Unnamed item";
  item.capacity = round(clamp(item.capacity, 1, 100));
  item.tare = round(clamp(item.tare, 0, 20));
  item.threshold = round(clamp(item.threshold, 0, item.capacity - 0.1));
  item.monthly = round(clamp(item.monthly, 0, 1000));
  item.gross = round(clamp(item.gross, 0, item.capacity + item.tare));
  const low = isLow(item);
  if (!wasLow && low) {
    log(
      state,
      "alert",
      `${item.name} is running low`,
      `${net(item).toFixed(2)} kg remaining · threshold ${item.threshold.toFixed(2)} kg`,
    );
  } else if (wasLow && !low && !["refill", "delivery"].includes(reason)) {
    log(
      state,
      "recovered",
      `${item.name} is above its threshold`,
      `${net(item).toFixed(2)} kg remaining. Low-stock state cleared.`,
    );
  }
  ensureRequest(state, item);
  state.requests.filter((r) => r.itemId === id && r.status === "pending")
    .forEach((r) => {
      r.amount = round(Math.max(0, item.capacity - net(item)));
      r.name = item.name;
    });
  if (
    reason === "refill" &&
    (before !== JSON.stringify(item) ||
      state.requests.some((r) => r.itemId === id && isOpen(r)))
  ) {
    state.requests
      .filter((r) => r.itemId === id && isOpen(r))
      .forEach((r) => {
        r.status = "fulfilled";
      });
    log(
      state,
      "refill",
      `${item.name} refilled`,
      `Simulated refill to ${item.capacity.toFixed(2)} kg. Low-stock state cleared.`,
    );
  }
  if (reason === "settings" && before !== JSON.stringify(item))
    log(
      state,
      "settings",
      `${item.name} settings saved`,
      "Inventory recalculated with the saved tare and threshold.",
    );
}
export function refill(state, id) {
  const item = state.items.find((i) => i.id === id);
  updateItem(state, id, { gross: round(item.capacity + item.tare) }, "refill");
}
export function preset(state, name) {
  const levels = name === "busy" ? [0.12, 0.67, 0.13, 0.6] : [1, 1, 1, 1];
  state.items.forEach((item, index) =>
    updateItem(
      state,
      item.id,
      { gross: round(item.tare + item.capacity * levels[index]) },
      name === "stocked" ? "refill" : "weight",
    ),
  );
}
