import { plotLayout } from './plot-layout.mjs';
import { moveToTop, stackLevels } from './stack-order.mjs';
import { statistics, fields, equal, display, generateProblem } from './statistics.mjs';

const $ = id => document.getElementById(id);
let mode = 'representative';
let problem, values, config, selected = null, moves = 0, dragging = null;
let normalCount = 10;
const margin = 24;
let geometry, positions = [];
let displayOrder = [];
let clearWasShown = false;
const explanations = {
  representative: '<h3>「真ん中」にも、いろいろある。</h3><p><b>平均値</b>は、合計をデータ数で割った値。<b>中央値</b>は、小さい順に並べた真ん中の値（偶数個なら中央2つの平均）。<b>最頻値</b>は、最も多く登場する値です。</p><p>目標の最頻値は必ず1つです。現在の最頻値が複数ある場合は、すべて表示します。小数は第3位まで表示し、続きがある場合は「…」を付けます。同じ表示でも正確な値が異なる場合があります。一致判定は省略前の正確な値で行います。</p>',
  summary: '<h3>5つの値で、全体の形をつかもう。</h3><p>最小値・第1四分位数・中央値・第3四分位数・最大値を合わせて<b>5数要約</b>と呼びます。箱ひげ図はこの5つの値を表します。ひげの端は最小値と最大値です。</p>',
  spread: '<h3>データは、どのくらい広がっている？</h3><p><b>範囲 = 最大値 − 最小値</b><br><b>四分位範囲（IQR）= Q3 − Q1</b></p><p>範囲は全体の広がり、四分位範囲は中央付近の広がりを表します。すべての点を同じだけずらすと、どうなるでしょう？</p>',
  variance: '<h3>平均からの距離を、数にしよう。</h3><p><b>分散 = (1/n) Σ(xᵢ − 平均値)²</b><br>平均からの差を2乗し、その平均を求めます。n − 1 で割る不偏分散ではありません。平均値と分散は途中で丸めず、有限小数を正確に表示・判定します。</p><p>標準偏差は分散の正の平方根です。このゲームでは参考値として表示し、クリア条件には使用しません。小数第4位までの近似値に「約」を付けます。</p>',
};
const quartileDefinition = '<p class="definition"><b>このアプリの四分位数の定義</b><br>データを小さい順に並べ、中央値を第2四分位数とします。データを前半と後半に分け、それぞれの中央値を第1四分位数、第3四分位数とします。データの個数が奇数の場合、全体の中央値は前半・後半には含めません。</p>';

function newProblem() {
  const count = Number(mode === 'variance' ? document.querySelector('[data-count][aria-pressed="true"]').dataset.count : $('count').value);
  const min = 0, max = Number(document.querySelector('[data-range][aria-pressed="true"]').dataset.range);
  if (!$('settings').reportValidity()) return false;
  try {
    const generated = generateProblem(mode, count, min, max);
    // Only the immutable derived targets and initial layout are kept in game state.
    problem = { target: generated.target, initial: [...generated.initial] };
  } catch {
    $('settings-error').textContent = '点は2〜100個の整数にしてください。平均・分散モードは10個または20個です。';
    return false;
  }
  $('settings-error').textContent = '';
  config = { count, min, max };
  if (mode !== 'variance') normalCount = count;
  values = [...problem.initial];
  displayOrder = values.map((_, index) => index);
  selected = null; moves = 0; dragging = null;
  $('count-badge').textContent = `${count}個のデータ`;
  $('mode-explanation').innerHTML = explanations[mode] + (['summary', 'spread'].includes(mode) ? quartileDefinition : '');
  $('stats').innerHTML = fields[mode].map(([key, label]) => `<div class="stat-row" id="stat-${key}"><span class="stat-label">${label}</span><strong class="target-value">${display(problem.target, key, mode)}</strong><strong class="current-value"></strong><span class="match" aria-label="未達成">−</span></div>`).join('');
  buildPlot(); render();
  $('plot-scroll').scrollLeft = 0;
  $('plot-scroll').scrollTop = $('plot-scroll').scrollHeight;
  return true;
}

function plotWidth() { return $('plot-scroll').clientWidth; }
function xPosition(value) { return geometry.x(value); }

function buildPlot() {
  $('dots').innerHTML = '';
  values.forEach((value, index) => {
    const dot = document.createElement('button');
    dot.className = 'dot'; dot.dataset.index = index;
    dot.type = 'button';
    dot.addEventListener('focus', () => { selected = index; renderSelection(); });
    dot.addEventListener('click', event => {
      // Keyboard / assistive clicks have no pointer coordinates.
      if (event.detail === 0) { selected = index; renderSelection(); }
    });
    dot.addEventListener('keydown', event => {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        selected = index;
        setValue(index, event.key === 'Home' ? config.min : event.key === 'End' ? config.max : values[index] + (event.key === 'ArrowLeft' ? -1 : 1));
      }
    });
    $('dots').append(dot);
  });
}

function drawAxis() {
  const width = plotWidth();
  $('plot').style.width = `${width}px`;
  $('boxplot').style.width = `${width}px`;
  let ticks = '', grid = '';
  for (let x = config.min; x <= config.max; x++) {
    const labeled = (x - config.min) % geometry.labelStep === 0 || x === config.max;
    ticks += `<span class="tick ${labeled ? 'major' : 'minor'}" style="left:${xPosition(x)}px">${labeled ? `<span>${x}</span>` : ''}</span>`;
    if (labeled) grid += `<span class="grid-line" style="left:${xPosition(x)}px"></span>`;
  }
  $('axis').innerHTML = ticks;
  $('grid').innerHTML = grid;
}

function setValue(index, value, countMove = true) {
  const next = Math.max(config.min, Math.min(config.max, value));
  if (values[index] === next) return;
  values[index] = next;
  displayOrder = moveToTop(displayOrder, index);
  if (countMove) moves++;
  render();
}

function renderSelection() {
  [...$('dots').children].forEach((dot, index) => {
    dot.classList.toggle('selected', selected === index);
    dot.classList.toggle('dragging', dragging?.index === index);
    dot.setAttribute('aria-pressed', String(selected === index));
  });
  $('selected-value').textContent = selected === null ? '点を選択' : `点 ${selected + 1}：${values[selected]}`;
  $('left').disabled = selected === null || values[selected] <= config.min;
  $('right').disabled = selected === null || values[selected] >= config.max;
  $('selection-hint').textContent = selected === null ? '点を選ぶと、下のボタンでも動かせます' : `選択中の点 ${selected + 1}：値 ${values[selected]}`;
}

function render() {
  const counts = new Map();
  values.forEach(x => counts.set(x, (counts.get(x) || 0) + 1));
  geometry = plotLayout(plotWidth(), config.min, config.max, Math.max(...counts.values()), values.length);
  $('plot').style.height = `${geometry.height}px`;
  $('plot').style.setProperty('--dot-size', `${geometry.dotSize}px`);
  $('plot').style.setProperty('--hit-size', `${geometry.hitSize}px`);
  $('plot').style.setProperty('--axis-inset', `${geometry.margin}px`);
  drawAxis();
  positions = [];
  const levels = stackLevels(values, displayOrder);
  [...$('dots').children].forEach((dot, index) => {
    const value = values[index];
    const level = levels[index];
    const position = { x: xPosition(value), y: geometry.y(level) };
    positions.push(position);
    dot.style.left = `${position.x}px`;
    dot.style.top = `${position.y}px`;
    dot.setAttribute('aria-label', `点${index + 1}、値${value}。左右矢印キーで移動`);
    dot.title = `点${index + 1}：${value}`;
    dot.classList.toggle('moved', value !== problem.initial[index]);
  });
  const current = statistics(values);
  let matches = 0;
  for (const [key] of fields[mode]) {
    const match = equal(current, problem.target, key);
    if (match) matches++;
    const row = $(`stat-${key}`);
    row.classList.toggle('matched', match);
    row.querySelector('.current-value').textContent = display(current, key, mode);
    row.querySelector('.match').textContent = match ? '✓' : '−';
    row.querySelector('.match').setAttribute('aria-label', match ? '達成' : '未達成');
  }
  const total = fields[mode].length;
  $('progress-label').textContent = `${matches} / ${total}`;
  $('progress-bar').style.width = `${100 * matches / total}%`;
  const clear = matches === total;
  $('status').classList.toggle('clear', clear);
  const statusText = clear ? '✦ CLEAR! すべての目標を達成！' : matches > 0 ? `いい調子！ あと${total - matches}項目でクリア` : 'まずは気になる点を動かしてみよう';
  if ($('status').textContent !== statusText) $('status').textContent = statusText;
  $('move-count').textContent = `${moves}回移動`;
  $('reference').hidden = !['variance', 'spread'].includes(mode);
  $('reference').textContent = mode === 'variance' ? `参考  標準偏差：約${Math.sqrt(Number(current.varianceNumerator) / Number(current.n ** 2n)).toFixed(4)}` : `参考  最小値 ${current.min}  ·  Q1 ${current.q1}  ·  Q3 ${current.q3}  ·  最大値 ${current.max}`;
  $('boxplot').hidden = !['summary', 'spread'].includes(mode);
  if (!$('boxplot').hidden) drawBoxplot(current);
  renderSelection();
  updateClearPresentation(clear, current);
}

function closeClearDialog() {
  if ($('clear-dialog').open) $('clear-dialog').close();
}

function updateClearPresentation(clear, current) {
  document.querySelector('.target-card').classList.toggle('all-matched', clear);
  if (!clear) {
    clearWasShown = false;
    closeClearDialog();
    return;
  }
  // Finish a captured drag before opening a modal, so pointerup is never lost.
  if (dragging || clearWasShown) return;
  clearWasShown = true;
  $('clear-stats').innerHTML = fields[mode].map(([key, label]) =>
    `<li><span>${label}</span><strong>${display(current, key, mode)}</strong><span class="clear-check">✓ 一致</span></li>`).join('');
  $('clear-moves').textContent = `${values.length}個のデータ · ${moves}回の移動で達成`;
  $('confetti').innerHTML = Array.from({ length: 24 }, (_, i) =>
    `<i style="--x:${5 + (i * 37 % 90)}%;--drift:${(i * 29 % 100) - 50}px;--delay:${i % 6 * 0.06}s;--turn:${(i % 2 ? 1 : -1) * (120 + i * 19)}deg;--paper:${['#4e9e83', '#d8b96d', '#91c7b6', '#b7cbd4'][i % 4]}"></i>`).join('');
  $('clear-dialog').showModal();
}

function resetProblem() {
  values = [...problem.initial]; moves = 0; selected = null; dragging = null;
  displayOrder = values.map((_, index) => index);
  render();
}

$('clear-close').addEventListener('click', closeClearDialog);
$('clear-again').addEventListener('click', () => { closeClearDialog(); resetProblem(); });
$('clear-new').addEventListener('click', () => { closeClearDialog(); newProblem(); });
$('clear-dialog').addEventListener('close', () => { $('confetti').replaceChildren(); });

function drawBoxplot(s) {
  const x = xPosition;
  $('boxplot').innerHTML = `<svg width="${plotWidth()}" height="94" role="img" aria-label="現在の箱ひげ図：最小値${s.min}、Q1 ${s.q1}、中央値${s.median}、Q3 ${s.q3}、最大値${s.max}"><text x="${margin}" y="15" class="box-caption">現在の箱ひげ図</text><line x1="${x(s.min)}" x2="${x(s.max)}" y1="48" y2="48"/><rect x="${x(s.q1)}" y="33" width="${Math.max(1, x(s.q3) - x(s.q1))}" height="30"/><line x1="${x(s.median)}" x2="${x(s.median)}" y1="33" y2="63" class="median-line"/><line x1="${x(s.min)}" x2="${x(s.min)}" y1="38" y2="58"/><line x1="${x(s.max)}" x2="${x(s.max)}" y1="38" y2="58"/><text x="${margin}" y="86" class="box-caption box-values" textLength="${Math.min(280, plotWidth() - margin * 2)}" lengthAdjust="spacingAndGlyphs">最小 ${s.min}　 Q1 ${s.q1}　 中央 ${s.median}　 Q3 ${s.q3}　 最大 ${s.max}</text></svg>`;
}

// The 32px hit areas may overlap in a dense plot. Resolve the nearest visible
// center, rather than letting DOM stacking order steal the pointer event.
$('plot').addEventListener('pointerdown', event => {
  if (event.button !== 0 || dragging) return;
  const rect = $('plot').getBoundingClientRect();
  const x = event.clientX - rect.left, y = event.clientY - rect.top;
  let nearest = -1, distance = event.pointerType === 'touch' ? 28 : 22;
  positions.forEach((point, index) => {
    const candidate = Math.hypot(point.x - x, point.y - y);
    if (candidate < distance) { nearest = index; distance = candidate; }
  });
  if (nearest < 0) return;
  event.preventDefault();
  selected = nearest;
  dragging = { index: nearest, pointerId: event.pointerId, start: values[nearest], startX: event.clientX, step: geometry.step };
  $('plot').setPointerCapture(event.pointerId);
  $('dots').children[nearest].focus({ preventScroll: true });
  renderSelection();
});
$('plot').addEventListener('pointermove', event => {
  if (!dragging || event.pointerId !== dragging.pointerId) return;
  const next = dragging.start + Math.round((event.clientX - dragging.startX) / dragging.step);
  setValue(dragging.index, next, false);
});
function finishDrag(event) {
  if (!dragging || event.pointerId !== dragging.pointerId) return;
  if (dragging.start !== values[dragging.index]) moves++;
  dragging = null;
  render();
}
['pointerup', 'pointercancel', 'lostpointercapture'].forEach(name => $('plot').addEventListener(name, finishDrag));

document.querySelectorAll('[data-range]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-range]').forEach(option => option.setAttribute('aria-pressed', String(option === button)));
}));
document.querySelectorAll('[data-count]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-count]').forEach(option => option.setAttribute('aria-pressed', String(option === button)));
}));
$('settings').addEventListener('submit', event => { event.preventDefault(); newProblem(); });
document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
  const previous = mode;
  const next = button.dataset.mode;
  if (previous === next) return;
  if (!$('settings').reportValidity()) return;
  if (previous !== 'variance') normalCount = Number($('count').value);
  mode = next;
  $('normal-count-setting').hidden = mode === 'variance';
  $('count').disabled = mode === 'variance';
  $('variance-count').hidden = mode !== 'variance';
  $('count').value = normalCount;
  if (!newProblem()) {
    mode = previous;
    $('normal-count-setting').hidden = mode === 'variance';
    $('count').disabled = mode === 'variance';
    $('variance-count').hidden = mode !== 'variance';
    return;
  }
  document.querySelectorAll('[data-mode]').forEach(tab => tab.setAttribute('aria-pressed', String(tab === button)));
}));
$('reset').addEventListener('click', resetProblem);
$('left').addEventListener('click', () => { if (selected !== null) setValue(selected, values[selected] - 1); });
$('right').addEventListener('click', () => { if (selected !== null) setValue(selected, values[selected] + 1); });
$('help-link').addEventListener('click', () => { document.querySelector('details').open = true; $('help').scrollIntoView({ behavior: 'smooth' }); });
new ResizeObserver(() => { if (config) render(); }).observe($('plot-scroll'));
newProblem();

// Record one visit per page load without waiting for the response or retrying.
try {
  fetch('https://script.google.com/macros/s/AKfycbxssCIHsD-N97SHxNC_GN0ihYeC0qy-lb-EY0KmSs6Gnztaph1sITMerLVEnNWOGkYc/exec?app=statistics-dot-challenge', {
    method: 'GET',
    mode: 'no-cors',
    cache: 'no-store',
    credentials: 'omit',
    keepalive: true,
  }).catch(() => {});
} catch {
  // Access logging must never interrupt the game.
}
