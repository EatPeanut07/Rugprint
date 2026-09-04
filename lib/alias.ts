const CONFUSABLES: Record<string,string> = {
  "0":"o","1":"l","3":"e","4":"a","5":"s","7":"t","8":"b",
  "@":"a","$":"s","!":"i","|":"l"
};

export function normaliseAlias(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .split("")
    .map(ch => CONFUSABLES[ch] ?? ch)
    .join("")
    .replace(/[._\-\s]/g, "")
    .replace(/\d+$/g, "");
}

export function levenshtein(a: string, b: string) {
  const x = normaliseAlias(a);
  const y = normaliseAlias(b);
  if (!x.length) return y.length;
  if (!y.length) return x.length;
  const prev = Array.from({ length: y.length + 1 }, (_, i) => i);
  for (let i = 1; i <= x.length; i++) {
    const cur = [i];
    for (let j = 1; j <= y.length; j++) {
      cur[j] = Math.min(
        cur[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1)
      );
    }
    prev.splice(0, prev.length, ...cur);
  }
  return prev[y.length];
}

export function aliasSimilarity(a: string, b: string) {
  const x = normaliseAlias(a);
  const y = normaliseAlias(b);
  if (!x || !y) return 0;
  if (x === y) return 100;
  const max = Math.max(x.length, y.length);
  const edit = levenshtein(x, y);
  let score = Math.max(0, Math.round((1 - edit / max) * 100));
  if (x.startsWith(y) || y.startsWith(x)) score = Math.max(score, 88);
  if (Math.abs(x.length - y.length) <= 1 && edit <= 1) score = Math.max(score, 94);
  return Math.min(100, score);
}
