// All comparisons use exact integer numerators. Numbers are only used for
// coordinates and the explicitly approximate standard deviation.
export function median(sorted) {
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}

export function statistics(data) {
  const sorted = [...data].sort((a, b) => a - b);
  const n = BigInt(data.length);
  const sum = data.reduce((s, x) => s + BigInt(x), 0n);
  const squareSum = data.reduce((s, x) => s + BigInt(x) ** 2n, 0n);
  const middle = Math.floor(data.length / 2);
  const frequencies = new Map();
  for (const x of data) frequencies.set(x, (frequencies.get(x) || 0) + 1);
  const maximumFrequency = Math.max(...frequencies.values());
  const modes = [...frequencies].filter(([, count]) => count === maximumFrequency).map(([x]) => x).sort((a, b) => a - b);
  const q1 = median(sorted.slice(0, middle));
  const q3 = median(sorted.slice(Math.ceil(data.length / 2)));
  return {
    n, sum, varianceNumerator: n * squareSum - sum * sum,
    median: median(sorted), modes,
    min: sorted[0], max: sorted.at(-1), q1, q3,
    range: sorted.at(-1) - sorted[0], iqr: q3 - q1,
  };
}

export const fields = {
  representative: [['mean', '平均値'], ['median', '中央値'], ['mode', '最頻値']],
  summary: [['min', '最小値'], ['q1', '第1四分位数 Q1'], ['median', '中央値 Q2'], ['q3', '第3四分位数 Q3'], ['max', '最大値']],
  spread: [['range', '範囲'], ['iqr', '四分位範囲 IQR']],
  variance: [['mean', '平均値'], ['variance', '分散']],
};

export function equal(a, b, key) {
  if (key === 'mean') return a.sum * b.n === b.sum * a.n;
  if (key === 'variance') return a.varianceNumerator * b.n ** 2n === b.varianceNumerator * a.n ** 2n;
  if (key === 'mode') return a.modes.length === b.modes.length && a.modes.every((x, i) => x === b.modes[i]);
  return a[key] === b[key];
}

// Display only: truncate after maxDigits and mark any nonzero remainder.
// Exact comparison above never uses this text. Infinity is for finite decimals.
export function decimal(numerator, denominator, maxDigits = 3) {
  const sign = numerator < 0n ? '−' : '';
  let num = numerator < 0n ? -numerator : numerator;
  const whole = num / denominator;
  let remainder = num % denominator;
  if (!remainder) return sign + whole;
  let digits = '';
  while (remainder && digits.length < maxDigits) {
    remainder *= 10n;
    digits += remainder / denominator;
    remainder %= denominator;
  }
  return `${sign}${whole}.${digits}${remainder ? '…' : ''}`;
}

export function display(s, key, mode = 'representative') {
  if (key === 'mean') return decimal(s.sum, s.n, mode === 'variance' ? Infinity : 3);
  if (key === 'variance') return decimal(s.varianceNumerator, s.n ** 2n, mode === 'variance' ? Infinity : 3);
  if (key === 'mode') return s.modes.length === 1 ? String(s.modes[0]) : `複数：${s.modes.join('・')}`;
  return String(s[key]);
}

export function generateProblem(mode, count, min, max, random = Math.random) {
  if (!fields[mode] || !Number.isInteger(count) || count < 2 || count > 100 || !Number.isInteger(min) || !Number.isInteger(max) || min >= max || max - min > 200 || Math.abs(min) > 1000000 || Math.abs(max) > 1000000 || (mode === 'variance' && ![10, 20].includes(count))) throw new Error('設定の範囲を確認してください。');
  const integer = () => min + Math.floor(random() * (max - min + 1));
  const data = () => Array.from({ length: count }, integer);
  let answer = data();
  if (mode === 'representative') {
    // Raising an existing modal frequency breaks ties in at most n−1 edits.
    const chosen = answer[Math.floor(random() * count)];
    for (let i = 0; statistics(answer).modes.length !== 1 && i < count; i++) {
      if (answer[i] !== chosen) answer[i] = chosen;
    }
  }
  const target = statistics(answer);
  const keys = fields[mode].map(([key]) => key);
  const sortedAnswer = [...answer].sort((a, b) => a - b);
  let best;
  let bestScore = -Infinity;
  const answerCounts = new Map();
  answer.forEach(x => answerCounts.set(x, (answerCounts.get(x) || 0) + 1));
  for (let attempt = 0; attempt < 240; attempt++) {
    // Include concentrated and endpoint configurations for narrow ranges.
    const candidate = attempt < 2 ? Array(count).fill(attempt === 0 ? min : max)
      : attempt === 2 ? Array.from({ length: count }, (_, i) => i < Math.floor(count / 2) ? min : max)
      : attempt % 4 === 0 ? Array.from({ length: count }, () => random() < 0.5 ? min : max) : data();
    const current = statistics(candidate);
    const matches = keys.filter(key => equal(current, target, key)).length;
    if (matches === keys.length) continue;
    const remaining = new Map(answerCounts);
    let overlap = 0;
    for (const x of candidate) if (remaining.get(x) > 0) { overlap++; remaining.set(x, remaining.get(x) - 1); }
    const distance = [...candidate].sort((a, b) => a - b).reduce((s, x, i) => s + Math.abs(x - sortedAnswer[i]), 0) / (count * (max - min));
    // Prioritize nonmatching objectives, then different data and large movement.
    const diversity = new Set(candidate).size / Math.min(count, max - min + 1);
    const score = (keys.length - matches) * 10 + Math.min((count - overlap) / count, 0.5) + Math.min(distance, 0.25) + diversity;
    if (score > bestScore) { best = candidate; bestScore = score; }
  }
  if (!best) throw new Error('問題を生成できませんでした。設定を変更してください。');
  return { target, initial: best, answer };
}
