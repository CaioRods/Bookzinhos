const TITLES = [
  [100, 'Lenda literária'], [90, 'Guardião das histórias'], [80, 'Mestre das páginas'],
  [70, 'Bibliófilo'], [60, 'Conhecedor'], [50, 'Leitor dedicado'], [40, 'Leitor'],
  [30, 'Curte leitura'], [20, 'Explorador de histórias'], [10, 'Aprendiz'], [1, 'Iniciante'],
];

function round25(value) { return Math.round(value / 25) * 25; }

function xpForLevel(level) {
  const safe = Math.max(1, Math.min(100, Math.trunc(Number(level) || 1)));
  if (safe <= 12) return round25(90 * Math.pow(safe - 1, 1.55));
  const at12 = xpForLevel(12);
  if (safe <= 30) return round25(at12 + 420 * Math.pow(safe - 12, 1.9));
  const at30 = xpForLevel(30);
  return round25(at30 + 2400 * Math.pow(safe - 30, 2.25));
}

function levelForXp(xp) {
  const total = Math.max(0, Number(xp) || 0);
  let level = 1;
  for (let candidate = 2; candidate <= 100 && total >= xpForLevel(candidate); candidate += 1) level = candidate;
  return level;
}

function readerTitle(level) {
  const safe = Math.max(1, Math.min(100, Number(level) || 1));
  return TITLES.find(([minimum]) => safe >= minimum)[1];
}

module.exports = { xpForLevel, levelForXp, readerTitle };
