// Auswertung der Trade-Abstimmung: gewichteter Vorzeichentest (Methode nach Lisi).
// Skala -3..+3, negativ = Team A hat den besseren Deal, positiv = Team B, 0 = bewusst fair.
// Enthaltung = stimmberechtigt, aber (noch) nicht abgestimmt.

export const TRADE_PARAMS = {
  w: 0.5,          // Gewicht einer Enthaltung relativ zu "fair"
  zClear: 1.96,    // alpha ~ 0,05: klares Urteil
  zTendency: 1.28, // alpha ~ 0,20: Tendenz
};

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function erf(x) { // Abramowitz-Stegun 7.1.26, Genauigkeit ~1e-7
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}

export function evaluateTrade(values, abstentions, p = TRADE_PARAMS) {
  const plus = values.filter(v => v > 0);
  const minus = values.filter(v => v < 0);
  const fair = values.filter(v => v === 0).length;
  const nEff = plus.length + minus.length + fair + p.w * abstentions;
  const diff = plus.length - minus.length;
  let z = nEff > 0 ? Math.max(0, Math.abs(diff) - 1) / Math.sqrt(nEff) : 0;
  if (diff < 0) z = -z;
  const pValue = 1 - erf(Math.abs(z) / Math.SQRT2);
  const abs = Math.abs(z);
  const level = abs >= p.zClear ? "clear" : abs >= p.zTendency ? "tendency" : "none";
  const side = level === "none" ? null : z > 0 ? "B" : "A";
  const majority = side === "B" ? plus : side === "A" ? minus : [];
  const distribution = {};
  for (let v = -3; v <= 3; v++) distribution[v] = values.filter(x => x === v).length;
  return {
    level, side,
    strength: majority.length ? Math.abs(median(majority)) : null,   // 1..3
    z: Math.round(z * 100) / 100, p: Math.round(pValue * 1000) / 1000,
    n_eff: nEff, votes: values.length, abstentions,
    plus: plus.length, minus: minus.length, fair,
    distribution,
  };
}

// Allgemeine Umfragen
export function evaluatePoll(poll, votes, ballots, eligible) {
  const choices = votes.map(v => JSON.parse(v.choice));
  if (poll.kind === "yesno") {
    const yes = choices.filter(c => c === "yes").length;
    const no = choices.filter(c => c === "no").length;
    const abstain = choices.filter(c => c === "abstain").length;
    const quorumMet = !poll.quorum || ballots >= poll.quorum;
    const base = yes + no;
    let passed;
    if (poll.threshold === "two_thirds") passed = base > 0 && yes * 3 >= base * 2;
    else if (poll.threshold === "unanimous") passed = yes > 0 && no === 0;
    else passed = yes > no;
    return { kind: "yesno", yes, no, abstain, ballots, eligible, quorum_met: quorumMet,
             outcome: !quorumMet ? "no_quorum" : passed ? "accepted" : "rejected" };
  }
  const opts = JSON.parse(poll.options || "[]");
  const counts = opts.map(() => 0);
  for (const c of choices) for (const i of (Array.isArray(c) ? c : [c])) if (counts[i] !== undefined) counts[i]++;
  const max = Math.max(0, ...counts);
  const winners = max > 0 ? counts.map((n, i) => n === max ? i : -1).filter(i => i >= 0) : [];
  return { kind: poll.kind, counts, ballots, eligible, winners };
}
