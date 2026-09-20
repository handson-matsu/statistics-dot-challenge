// Shared geometry for dots, integer snapping, ticks and the box plot.
export function plotLayout(width, min, max, maxStack, count) {
  const span = max - min;
  const rangePressure = Math.min(1, Math.max(0, (span - 10) / 40));
  const countPressure = Math.min(1, Math.max(0, (count - 20) / 80));
  const stackPressure = Math.min(1, Math.max(0, (maxStack - 5) / 95));
  const available = width - 48;
  // Keep wide ranges centered and a little tighter; density contributes
  // continuously instead of switching between three fixed plot sizes.
  const compression = rangePressure * (0.13 + 0.035 * countPressure + 0.035 * stackPressure);
  const axisWidth = available * (1 - compression);
  const margin = (width - axisWidth) / 2;
  const step = axisWidth / span;
  const height = Math.min(380, Math.max(246, maxStack * 28 + 80));
  const baseRowSpacing = Math.min(30 - 7 * countPressure - 8 * stackPressure, (height - 88) / Math.max(1, maxStack - 1));
  // Preserve the familiar dot size at low density even as the axis contracts.
  const dotSize = Math.max(4, Math.min(24 - 6 * countPressure, available / span * 0.82, step * 0.97, baseRowSpacing * 0.82));
  // Tighten only the 0–50 stack AFTER sizing the dots, so neither their size
  // nor the horizontal geometry changes. Keep a small density-aware gap.
  const stackGap = Math.max(1, Math.min(2.5, dotSize * 0.16 / (1 + 0.3 * countPressure + 0.3 * stackPressure)));
  const rowSpacing = span === 50 ? Math.min(baseRowSpacing, dotSize + stackGap) : baseRowSpacing;
  const labelStep = [1, 2, 5, 10, 20, 50].find(interval => interval * step >= 28) || 50;
  return { width, height, margin, step, rowSpacing, dotSize, hitSize: 32, labelStep,
    dense: dotSize < 12 || rowSpacing < 14 || step < 14,
    x: value => margin + (value - min) * step,
    y: level => height - 62 - level * rowSpacing,
  };
}
