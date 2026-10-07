import test from "node:test";
import assert from "node:assert/strict";
import {
  initialState,
  net,
  isLow,
  updateItem,
  refill,
  preset,
  setAutoReorder,
  approveRequest,
  deliverRequest,
  startAfternoon,
  pauseAfternoon,
  advanceAfternoon,
  resetSimulation,
  setAfternoonDuration,
  AFTERNOON_DURATIONS,
} from "../src/inventory.js";
const alerts = (state) =>
  state.activity.filter((a) => a.type === "alert").length;
test("subtracts saved tare, clamps net to zero, bounds gross to tare + capacity", () => {
  const s = initialState();
  updateItem(s, "coffee", { gross: 0.2 });
  assert.equal(net(s.items[0]), 0);
  updateItem(s, "coffee", { gross: -50 });
  assert.equal(s.items[0].gross, 0);
  updateItem(s, "coffee", { gross: 999 });
  assert.equal(s.items[0].gross, 10.5);
  assert.equal(net(s.items[0]), 10);
  updateItem(s, "coffee", { gross: 3.5, tare: 1 });
  assert.equal(net(s.items[0]), 2.5);
});
test("one inclusive alert per low crossing, including empty", () => {
  const s = initialState();
  updateItem(s, "coffee", { gross: 2.5 });
  assert.equal(alerts(s), 1);
  assert.equal(isLow(s.items[0]), true);
  updateItem(s, "coffee", { gross: 1 });
  updateItem(s, "coffee", { gross: 0 });
  assert.equal(alerts(s), 1);
  updateItem(s, "coffee", { gross: 3 });
  updateItem(s, "coffee", { gross: 2.5 });
  assert.equal(alerts(s), 2);
});
test("threshold and tare edits immediately re-evaluate low stock", () => {
  const s = initialState();
  updateItem(s, "coffee", { threshold: 8 }, "settings");
  assert.equal(alerts(s), 1);
  updateItem(s, "coffee", { threshold: 2 }, "settings");
  assert.equal(isLow(s.items[0]), false);
  updateItem(s, "coffee", { tare: 6 }, "settings");
  assert.equal(alerts(s), 2);
});
test("auto requests are demo-only, deduplicated, and fulfilled by refill", () => {
  const s = initialState();
  s.autoReorder = true;
  updateItem(s, "coffee", { gross: 2 });
  updateItem(s, "coffee", { gross: 1 });
  assert.equal(s.requests.length, 1);
  assert.equal(s.requests[0].amount, 9.5);
  updateItem(s, "coffee", { gross: 5 });
  updateItem(s, "coffee", { gross: 2 });
  assert.equal(s.requests.length, 1);
  refill(s, "coffee");
  assert.equal(isLow(s.items[0]), false);
  assert.equal(s.requests[0].status, "fulfilled");
  const activity = s.activity.length;
  refill(s, "coffee");
  assert.equal(s.activity.length, activity);
  updateItem(s, "coffee", { gross: 2 });
  assert.equal(s.requests.length, 2);
});
test("enabling auto-reorder creates requests for bins already low, once", () => {
  const s = initialState();
  preset(s, "busy");
  assert.equal(s.requests.length, 0);
  setAutoReorder(s, true);
  assert.equal(s.requests.length, 2);
  setAutoReorder(s, true);
  assert.equal(s.requests.length, 2);
});
test("presets and repeated clicks are stable, then refill all clears low bins", () => {
  const s = initialState();
  s.autoReorder = true;
  preset(s, "busy");
  assert.equal(s.items.filter(isLow).length, 2);
  assert.equal(alerts(s), 2);
  assert.equal(s.requests.length, 2);
  preset(s, "busy");
  assert.equal(alerts(s), 2);
  assert.equal(s.requests.length, 2);
  preset(s, "stocked");
  assert.equal(s.items.filter(isLow).length, 0);
  assert.equal(s.requests.filter((r) => r.status === "pending").length, 0);
});
test("all four items update independently and monthly stock is only a reference", () => {
  const s = initialState(),
    original = structuredClone(s.items);
  s.items.forEach((item, index) => {
    updateItem(s, item.id, { gross: index + 1 });
    assert.equal(item.gross, index + 1);
  });
  updateItem(s, "rice", { monthly: 999 });
  assert.equal(s.items[1].gross, 2);
  assert.equal(original[2].gross, 4.4);
});
test("configuration remains finite and full capacity can always clear low stock", () => {
  const s = initialState();
  updateItem(s, "coffee", {
    capacity: 0,
    threshold: 900,
    tare: -5,
    monthly: Infinity,
    gross: NaN,
  });
  const item = s.items[0];
  assert.equal(item.capacity, 1);
  assert.equal(item.threshold, 0.9);
  assert.equal(item.tare, 0);
  assert.equal(item.monthly, 0);
  refill(s, item.id);
  assert.equal(isLow(item), false);
});

test("live afternoon consumes starting stock gradually and finishes at 15 seconds", () => {
  const s = initialState();
  const starts = s.items.map(net);
  startAfternoon(s);
  assert.equal(s.autoReorder, true);
  assert.deepEqual(s.items.map(net), starts);
  advanceAfternoon(s, 0.25);
  s.items.forEach((item, i) => assert.ok(net(item) > 0 && net(item) < starts[i]));
  for (let i = 1; i < 30; i++) advanceAfternoon(s);
  assert.deepEqual(s.items.map(net), starts.map((n) => n / 2));
  assert.equal(s.requests.length, 0);
  for (let i = 30; i < 60; i++) advanceAfternoon(s);
  assert.equal(s.simulation.elapsed, 15);
  assert.equal(s.simulation.running, false);
  assert.deepEqual(s.items.map(net), [0, 0, 0, 0]);
  assert.equal(s.requests.length, 4);
  assert.equal(alerts(s), 4);
  const ended = structuredClone(s);
  advanceAfternoon(s);
  assert.deepEqual(s, ended);
});

test("pause, resume, repeated start and reset do not restart or double consumption", () => {
  const s = initialState();
  startAfternoon(s);
  advanceAfternoon(s, 5);
  const afterFive = s.items.map(net);
  startAfternoon(s);
  assert.equal(s.simulation.elapsed, 5);
  pauseAfternoon(s);
  advanceAfternoon(s, 5);
  assert.deepEqual(s.items.map(net), afterFive);
  startAfternoon(s);
  advanceAfternoon(s, 5);
  assert.equal(s.simulation.elapsed, 10);
  resetSimulation(s);
  const resetWeights = s.items.map(net);
  advanceAfternoon(s, 5);
  assert.deepEqual(s.items.map(net), resetWeights);
  assert.equal(s.simulation.started, false);
});

test("approval holds quantity without refilling; delivery adds it once", () => {
  const s = initialState();
  setAutoReorder(s, true);
  updateItem(s, "coffee", { gross: 2 });
  const r = s.requests[0];
  assert.equal(deliverRequest(s, r.id), false);
  assert.equal(approveRequest(s, r.id), true);
  assert.equal(r.status, "approved");
  assert.equal(r.amount, 8.5);
  assert.equal(net(s.items[0]), 1.5);
  assert.equal(approveRequest(s, r.id), false);
  updateItem(s, "coffee", { gross: 5 });
  updateItem(s, "coffee", { gross: 1 });
  assert.equal(s.requests.length, 1);
  assert.equal(r.amount, 8.5);
  assert.equal(deliverRequest(s, r.id), true);
  assert.equal(r.status, "fulfilled");
  assert.equal(net(s.items[0]), 9);
  assert.equal(deliverRequest(s, r.id), false);
  assert.equal(net(s.items[0]), 9);
});

test("delivery respects changed capacity and invalid requests have no effect", () => {
  const s = initialState();
  assert.equal(approveRequest(s, -1), false);
  assert.equal(deliverRequest(s, -1), false);
  setAutoReorder(s, true);
  updateItem(s, "coffee", { gross: 1 });
  const r = s.requests[0];
  approveRequest(s, r.id);
  updateItem(s, "coffee", { capacity: 5 });
  deliverRequest(s, r.id);
  assert.equal(net(s.items[0]), 5);
});

test("live consumption keeps deliveries and cannot increase an empty bin", () => {
  const s = initialState();
  updateItem(s, "rice", { gross: 0 });
  startAfternoon(s);
  advanceAfternoon(s, 12);
  assert.equal(s.items[1].gross, 0);
  const r = s.requests.find((r) => r.itemId === "coffee");
  approveRequest(s, r.id);
  deliverRequest(s, r.id);
  assert.equal(net(s.items[0]), 10);
  advanceAfternoon(s, 3);
  assert.equal(net(s.items[0]), 8.56);
  assert.equal(r.status, "fulfilled");
});

test("manual refill closes pending and approved requests without leaving duplicates", () => {
  const s = initialState();
  startAfternoon(s);
  advanceAfternoon(s, 15);
  approveRequest(s, s.requests[0].id);
  resetSimulation(s);
  preset(s, "stocked");
  assert.ok(s.requests.every((r) => r.status === "fulfilled"));
  startAfternoon(s);
  advanceAfternoon(s, 15);
  assert.equal(s.requests.filter((r) => r.status === "pending").length, 4);
});

test("each selectable duration consumes starting stock over the chosen time", () => {
  for (const duration of AFTERNOON_DURATIONS) {
    const s = initialState();
    assert.equal(setAfternoonDuration(s, duration), true);
    startAfternoon(s);
    advanceAfternoon(s, duration / 2);
    assert.equal(net(s.items[0]), 3.6);
    assert.equal(s.simulation.running, true);
    advanceAfternoon(s, duration / 2);
    assert.deepEqual(s.items.map(net), [0, 0, 0, 0]);
    assert.equal(s.simulation.running, false);
    assert.equal(s.simulation.elapsed, duration);
  }
});

test("changing pace preserves consumed stock and progress, including while paused", () => {
  const s = initialState();
  startAfternoon(s);
  advanceAfternoon(s, 7.5);
  const halfStock = s.items.map(net);
  setAfternoonDuration(s, 60);
  assert.equal(s.simulation.elapsed, 30);
  assert.deepEqual(s.items.map(net), halfStock);
  pauseAfternoon(s);
  setAfternoonDuration(s, 30);
  assert.equal(s.simulation.elapsed, 15);
  assert.deepEqual(s.items.map(net), halfStock);
  startAfternoon(s);
  advanceAfternoon(s, 15);
  assert.deepEqual(s.items.map(net), [0, 0, 0, 0]);
  resetSimulation(s);
  assert.equal(s.simulation.duration, 30);
  assert.equal(setAfternoonDuration(s, 0), false);
  assert.equal(setAfternoonDuration(s, NaN), false);
  assert.equal(s.simulation.duration, 30);
});
