import test from 'node:test';
import assert from 'node:assert/strict';
import { moveToTop, stackLevels } from '../stack-order.mjs';
import { statistics } from '../statistics.mjs';

test('a low-ID point joins above five or ten existing points in every range', () => {
  for (const max of [10, 20, 50]) for (const size of [5, 10]) {
    const values = [max, ...Array(size).fill(5)];
    let order = values.map((_, i) => i);
    values[0] = 5;
    order = moveToTop(order, 0);
    assert.deepEqual(stackLevels(values, order), [size, ...Array.from({length: size}, (_, i) => i)]);
  }
});

test('arrivals preserve resident order; leaving and rejoining places the point on top', () => {
  const values = [5, 5, 5, 6];
  let order = [0, 1, 2, 3];
  values[3] = 5; order = moveToTop(order, 3);
  values[1] = 6; order = moveToTop(order, 1);
  assert.deepEqual(stackLevels(values, order), [0, 0, 1, 2]);
  values[1] = 5; order = moveToTop(order, 1);
  assert.deepEqual(stackLevels(values, order), [0, 3, 1, 2]);
  const snapshot = [...values], stats = statistics(values);
  stackLevels(values, order);
  assert.deepEqual(values, snapshot);
  assert.deepEqual(statistics(values), stats);
  assert.deepEqual(stackLevels(values, [0, 1, 2, 3]), [0, 1, 2, 3]);
});
