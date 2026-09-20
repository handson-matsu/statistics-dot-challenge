// Point IDs remain stable; this order affects only the visual stack levels.
export function moveToTop(order, pointId) {
  return [...order.filter(id => id !== pointId), pointId];
}

export function stackLevels(values, order) {
  const counts = new Map();
  const levels = Array(values.length);
  for (const id of order) {
    const value = values[id];
    levels[id] = counts.get(value) || 0;
    counts.set(value, levels[id] + 1);
  }
  return levels;
}
