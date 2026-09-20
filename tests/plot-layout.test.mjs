import test from 'node:test';
import assert from 'node:assert/strict';
import { plotLayout } from '../plot-layout.mjs';

test('all integer positions and 100 stacked points fit in the plot', () => {
  for (const width of [240, 254, 324, 500, 680]) {
    for (const max of [10, 20, 50]) {
      for (const count of [2, 10, 20, 50, 100]) {
        for (const maxStack of [1, count]) {
          const p = plotLayout(width, 0, max, maxStack, count);
          assert.ok(p.height <= 380);
          assert.ok(p.hitSize >= 32);
          assert.ok(p.dotSize >= 4);
          assert.ok(p.y(maxStack - 1) - p.hitSize / 2 >= 0);
          assert.ok(p.y(0) + p.hitSize / 2 < p.height - 40);
          for (let x = 0; x <= max; x++) {
            assert.ok(p.x(x) - p.hitSize / 2 >= 0);
            assert.ok(p.x(x) + p.hitSize / 2 <= width);
            assert.equal(Math.round((p.x(x) - p.margin) / p.step), x);
          }
          assert.ok(p.labelStep * p.step >= 28);
        }
      }
    }
  }
});

test('small screens and dense data get compact dots and alternative selection', () => {
  const wide = plotLayout(680, 0, 10, 3, 10);
  const narrow = plotLayout(254, 0, 50, 3, 10);
  const stacked = plotLayout(324, 0, 20, 100, 100);
  assert.ok(narrow.dotSize < wide.dotSize);
  assert.ok(narrow.labelStep > wide.labelStep);
  assert.ok(narrow.dense);
  assert.ok(stacked.dense);
  assert.ok(stacked.rowSpacing < wide.rowSpacing);
});

test('wide ranges contract while keeping low-density dots near their previous size', () => {
  for (const width of [254, 324, 680]) {
    const few = plotLayout(width, 0, 50, 3, 20);
    const many = plotLayout(width, 0, 50, 12, 100);
    const piled = plotLayout(width, 0, 50, 100, 100);
    const previousStep = (width - 48) / 50;
    assert.ok(few.step < previousStep * 0.9);
    assert.ok(few.dotSize >= Math.max(4, previousStep * 0.82) * 0.95);
    assert.ok(many.step < few.step);
    assert.ok(piled.step < many.step);
    assert.ok(piled.rowSpacing < many.rowSpacing);
    const narrowRange = plotLayout(width, 0, 10, 100, 100);
    assert.equal(narrowRange.margin, 24);
    assert.ok(narrowRange.step > piled.step);
  }
});

test('0–50 stacks keep small positive gaps at 5, 10 and 20 dots', () => {
  for (const width of [254, 324, 672]) {
    for (const count of [20, 100]) {
      for (const stacked of [5, 10, 20]) {
        const p = plotLayout(width, 0, 50, stacked, count);
        const gap = p.rowSpacing - p.dotSize;
        assert.ok(gap >= 1 - 1e-10 && gap <= 2.5);
        assert.ok(p.rowSpacing < 13);
        assert.equal(p.hitSize, 32);
      }
    }
  }
});
