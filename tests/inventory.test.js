import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, net, isLow, updateItem, refill, preset } from '../src/inventory.js';
const alerts = state => state.activity.filter(a => a.type === 'alert').length;
test('subtracts saved tare, clamps net to zero, bounds gross to tare + capacity', () => {
  const s = initialState();
  updateItem(s, 'coffee', { gross: .2 }); assert.equal(net(s.items[0]), 0);
  updateItem(s, 'coffee', { gross: -50 }); assert.equal(s.items[0].gross, 0);
  updateItem(s, 'coffee', { gross: 999 }); assert.equal(s.items[0].gross, 10.5); assert.equal(net(s.items[0]), 10);
  updateItem(s, 'coffee', { gross: 3.5, tare: 1 }); assert.equal(net(s.items[0]), 2.5);
});
test('one inclusive alert per low crossing, including empty', () => {
  const s = initialState();
  updateItem(s, 'coffee', { gross: 2.5 }); assert.equal(alerts(s), 1); assert.equal(isLow(s.items[0]), true);
  updateItem(s, 'coffee', { gross: 1 }); updateItem(s, 'coffee', { gross: 0 }); assert.equal(alerts(s), 1);
  updateItem(s, 'coffee', { gross: 3 }); updateItem(s, 'coffee', { gross: 2.5 }); assert.equal(alerts(s), 2);
});
test('threshold and tare edits immediately re-evaluate low stock', () => {
  const s = initialState();
  updateItem(s, 'coffee', { threshold: 8 }, 'settings'); assert.equal(alerts(s), 1);
  updateItem(s, 'coffee', { threshold: 2 }, 'settings'); assert.equal(isLow(s.items[0]), false);
  updateItem(s, 'coffee', { tare: 6 }, 'settings'); assert.equal(alerts(s), 2);
});
test('auto requests are demo-only, deduplicated, and fulfilled by refill', () => {
  const s = initialState(); s.autoReorder = true;
  updateItem(s, 'coffee', { gross: 2 }); updateItem(s, 'coffee', { gross: 1 });
  assert.equal(s.requests.length, 1); assert.equal(s.requests[0].amount, 8.5);
  updateItem(s, 'coffee', { gross: 5 }); updateItem(s, 'coffee', { gross: 2 }); assert.equal(s.requests.length, 1);
  refill(s, 'coffee'); assert.equal(isLow(s.items[0]), false); assert.equal(s.requests[0].status, 'fulfilled');
  const activity = s.activity.length; refill(s, 'coffee'); assert.equal(s.activity.length, activity);
  updateItem(s, 'coffee', { gross: 2 }); assert.equal(s.requests.length, 2);
});
test('disabled auto-reorder never creates requests; enabling does not backfill', () => {
  const s = initialState(); preset(s, 'busy'); assert.equal(s.requests.length, 0);
  s.autoReorder = true; preset(s, 'busy'); assert.equal(s.requests.length, 0);
});
test('presets and repeated clicks are stable, then refill all clears low bins', () => {
  const s = initialState(); s.autoReorder = true; preset(s, 'busy');
  assert.equal(s.items.filter(isLow).length, 2); assert.equal(alerts(s), 2); assert.equal(s.requests.length, 2);
  preset(s, 'busy'); assert.equal(alerts(s), 2); assert.equal(s.requests.length, 2);
  preset(s, 'stocked'); assert.equal(s.items.filter(isLow).length, 0);
  assert.equal(s.requests.filter(r => r.status === 'pending').length, 0);
});
test('all four items update independently and monthly stock is only a reference', () => {
  const s = initialState(), original = structuredClone(s.items);
  s.items.forEach((item, index) => { updateItem(s, item.id, { gross: index + 1 }); assert.equal(item.gross, index + 1); });
  updateItem(s, 'rice', { monthly: 999 }); assert.equal(s.items[1].gross, 2);
  assert.equal(original[2].gross, 4.4);
});
test('configuration remains finite and full capacity can always clear low stock', () => {
  const s = initialState(); updateItem(s, 'coffee', { capacity: 0, threshold: 900, tare: -5, monthly: Infinity, gross: NaN });
  const item = s.items[0]; assert.equal(item.capacity, 1); assert.equal(item.threshold, .9); assert.equal(item.tare, 0); assert.equal(item.monthly, 0);
  refill(s, item.id); assert.equal(isLow(item), false);
});
