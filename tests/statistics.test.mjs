import test from 'node:test';
import assert from 'node:assert/strict';
import { statistics, equal, decimal, display, fields, generateProblem } from '../statistics.mjs';

test('quartiles exclude the overall median for odd-sized data', () => {
  const s = statistics([9, 1, 4, 2, 7]);
  assert.deepEqual([s.min, s.q1, s.median, s.q3, s.max], [1, 1.5, 4, 8, 9]);
  const even = statistics([1, 2, 3, 4, 5, 6]);
  assert.deepEqual([even.q1, even.median, even.q3], [2, 3.5, 5]);
  const two = statistics([-3, 4]);
  assert.deepEqual([two.q1, two.median, two.q3], [-3, 0.5, 4]);
});

test('population variance and decimal display remain exact', () => {
  const s = statistics([0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
  assert.equal(display(s, 'mean'), '0.1');
  assert.equal(display(s, 'variance'), '0.09');
  const twenty = statistics([...Array(19).fill(0), 1]);
  assert.equal(display(twenty, 'variance', 'variance'), '0.0475');
  assert.equal(decimal(74000n, 10000n), '7.4');
  assert.equal(decimal(-1n, 8n), '−0.125');
  assert.equal(decimal(1n, 3n), '0.333…');
  assert.equal(decimal(1n, 6n), '0.166…');
  assert.equal(decimal(0n, 20n), '0');
  const large = statistics([...Array(19).fill(999999), 1000000]);
  assert.equal(display(large, 'variance', 'variance'), '0.0475');
  assert.equal(equal(twenty, large, 'variance'), true);
  assert.equal(equal(twenty, large, 'mean'), false);
});

test('all tied modes are reported and do not match a unique target', () => {
  const tied = statistics([2, 2, 3, 3]);
  assert.deepEqual(tied.modes, [2, 3]);
  assert.equal(equal(tied, statistics([2, 2, 2, 3]), 'mode'), false);
  assert.deepEqual(statistics([1, 2, 3]).modes, [1, 2, 3]);
});

test('variance is invariant under translation and zero for constant data', () => {
  const a = statistics([-4, -1, 0, 8]);
  const b = statistics([6, 9, 10, 18]);
  assert.ok(equal(a, b, 'variance'));
  assert.equal(display(statistics(Array(20).fill(-8)), 'variance'), '0');
});

function seededRandom(seed) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}

test('generated problems are solvable, nontrivial, bounded, and uniquely modal', () => {
  for (const mode of Object.keys(fields)) {
    for (const count of mode === 'variance' ? [10, 20] : [2, 3, 5, 10, 21, 100]) {
      for (const [min, max] of [[0, 1], [0, 10], [0, 20], [0, 50], [-5, 5], [0, 200], [999990, 1000000]]) {
        for (let seed = 1; seed <= 8; seed++) {
          const p = generateProblem(mode, count, min, max, seededRandom(seed));
          assert.equal(p.answer.length, count);
          assert.equal(p.initial.length, count);
          assert.ok([...p.initial, ...p.answer].every(x => Number.isInteger(x) && x >= min && x <= max));
          const correct = statistics(p.answer), initial = statistics(p.initial);
          assert.ok(fields[mode].every(([key]) => equal(correct, p.target, key)));
          assert.ok(fields[mode].some(([key]) => !equal(initial, p.target, key)));
          if (mode === 'representative') assert.equal(p.target.modes.length, 1);
          const targetCopy = { ...p.target, modes: [...p.target.modes] };
          p.initial[0] = max;
          assert.deepEqual(p.target, targetCopy);
        }
      }
    }
  }
});

test('invalid configurations are rejected', () => {
  for (const args of [['summary', 1, 0, 10], ['variance', 11, 0, 10], ['representative', 10, 2, 2], ['summary', 5, 0.1, 10], ['spread', 10, 0, 201]]) {
    assert.throws(() => generateProblem(...args));
  }
});

test('even degenerate random streams yield a non-cleared solvable problem', () => {
  for (const mode of Object.keys(fields)) {
    for (const random of [() => 0, () => 0.999999]) {
      const p = generateProblem(mode, mode === 'variance' ? 10 : 2, 0, 1, random);
      assert.ok(fields[mode].some(([key]) => !equal(statistics(p.initial), p.target, key)));
      assert.ok(fields[mode].every(([key]) => equal(statistics(p.answer), p.target, key)));
    }
  }
});


test('normal display truncates at three places without changing exact equality', () => {
  for (const [num, den, expected] of [[5n, 1n, '5'], [11n, 2n, '5.5'], [21n, 4n, '5.25'], [41n, 8n, '5.125'], [77n, 13n, '5.923…'], [1n, 16n, '0.062…'], [50001n, 10000n, '5.000…']]) {
    assert.equal(decimal(num, den), expected);
  }
  assert.equal(decimal(1n, 400n, Infinity), '0.0025');
  assert.equal(decimal(74000n, 10000n, Infinity), '7.4');
  const a = statistics([...Array(96).fill(0), 1]);
  const b = statistics([...Array(98).fill(0), 1]);
  assert.equal(display(a, 'mean'), '0.010…');
  assert.equal(display(b, 'mean'), '0.010…');
  assert.equal(equal(a, b, 'mean'), false);
});
