export const round = value => Math.round(value * 100) / 100;
export const clamp = (value, min, max) => Math.min(max, Math.max(min, Number.isFinite(Number(value)) ? Number(value) : min));
export const net = item => round(Math.max(item.gross - item.tare, 0));
export const isLow = item => net(item) <= item.threshold;
export const stateLabel = item => net(item) === 0 ? 'Empty' : isLow(item) ? 'Low stock' : 'In stock';
export function initialState() {
  return {
    autoReorder: false, sequence: 0, requests: [],
    activity: [{ id: 0, type: 'start', title: 'Your virtual store is ready', detail: 'Four sample bins. Turn a dial to change the gross weight.', time: Date.now() }],
    items: [
      { id: 'coffee', name: 'Coffee beans', category: 'Whole bean · Bulk goods', tare: .5, capacity: 10, threshold: 2, monthly: 40, gross: 7.7 },
      { id: 'rice', name: 'Jasmine rice', category: 'Dry grain · Bulk goods', tare: .8, capacity: 15, threshold: 3, monthly: 75, gross: 12.2 },
      { id: 'oats', name: 'Rolled oats', category: 'Whole grain · Bulk goods', tare: .4, capacity: 8, threshold: 1.5, monthly: 30, gross: 4.4 },
      { id: 'sugar', name: 'Cane sugar', category: 'Baking · Bulk goods', tare: .6, capacity: 12, threshold: 2.5, monthly: 50, gross: 9.0 }
    ]
  };
}
function log(state, type, title, detail) {
  state.activity.unshift({ id: ++state.sequence, type, title, detail, time: Date.now() });
  state.activity = state.activity.slice(0, 40);
}
export function updateItem(state, id, patch, reason = 'weight') {
  const item = state.items.find(i => i.id === id);
  if (!item) return;
  const wasLow = isLow(item);
  const before = JSON.stringify(item);
  Object.assign(item, patch);
  item.name = String(item.name).trim().slice(0, 40) || 'Unnamed item';
  item.capacity = round(clamp(item.capacity, 1, 100));
  item.tare = round(clamp(item.tare, 0, 20));
  item.threshold = round(clamp(item.threshold, 0, item.capacity - .1));
  item.monthly = round(clamp(item.monthly, 0, 1000));
  item.gross = round(clamp(item.gross, 0, item.capacity + item.tare));
  const low = isLow(item);
  if (!wasLow && low) {
    log(state, 'alert', `${item.name} is running low`, `${net(item).toFixed(2)} kg remaining · threshold ${item.threshold.toFixed(2)} kg`);
    if (state.autoReorder && !state.requests.some(r => r.itemId === id && r.status === 'pending')) {
      state.requests.unshift({ id: ++state.sequence, itemId: id, name: item.name, amount: round(item.capacity - net(item)), status: 'pending' });
      log(state, 'request', 'Demo request created', `${item.name} · simulated top-up of ${round(item.capacity - net(item))} kg. Nothing was ordered.`);
    }
  } else if (wasLow && !low && reason !== 'refill') {
    log(state, 'recovered', `${item.name} is above its threshold`, `${net(item).toFixed(2)} kg remaining. Low-stock state cleared.`);
  }
  if (reason === 'refill' && (before !== JSON.stringify(item) || state.requests.some(r => r.itemId === id && r.status === 'pending'))) {
    state.requests.filter(r => r.itemId === id && r.status === 'pending').forEach(r => { r.status = 'fulfilled'; });
    log(state, 'refill', `${item.name} refilled`, `Simulated refill to ${item.capacity.toFixed(2)} kg. Low-stock state cleared.`);
  }
  if (reason === 'settings' && before !== JSON.stringify(item)) log(state, 'settings', `${item.name} settings saved`, 'Inventory recalculated with the saved tare and threshold.');
}
export function refill(state, id) {
  const item = state.items.find(i => i.id === id);
  updateItem(state, id, { gross: round(item.capacity + item.tare) }, 'refill');
}
export function preset(state, name) {
  const levels = name === 'busy' ? [.12, .67, .13, .6] : [1, 1, 1, 1];
  state.items.forEach((item, index) => updateItem(state, item.id, { gross: round(item.tare + item.capacity * levels[index]) }, name === 'stocked' ? 'refill' : 'weight'));
}
