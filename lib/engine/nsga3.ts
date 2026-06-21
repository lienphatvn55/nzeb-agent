/**
 * NSGA-III (Deb & Jain, 2014) — TypeScript port of the pymoo run in
 * engine/optimize.py. Faithful structure: Das-Dennis reference directions,
 * constraint-domination non-dominated sorting, SBX crossover + polynomial
 * mutation, and reference-point-based environmental selection (normalisation →
 * association → niching).
 *
 * Problem: minimise [f1=EUI, f2=LCC, f3=WLC] over x in [0,1]^8 with the single
 * inequality constraint g = capex - budget <= 0.
 */
import { Building, evaluate, MEASURE_KEYS, MEASURES, N_VAR } from './surrogate';

interface Ind {
  x: number[];
  f: [number, number, number];
  cv: number; // constraint violation (>=0; 0 means feasible)
  rank: number;
}

// ---- Das-Dennis reference directions (n_obj=3, p=12 -> 91 points) --------- //
function dasDennis(nObj: number, p: number): number[][] {
  const out: number[][] = [];
  const rec = (left: number, total: number, depth: number, acc: number[]) => {
    if (depth === nObj - 1) { out.push([...acc, left / total]); return; }
    for (let i = 0; i <= left; i++) rec(left - i, total, depth + 1, [...acc, i / total]);
  };
  rec(p, p, 0, []);
  return out;
}

// ---- RNG (seeded, deterministic) ------------------------------------------ //
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeInd(b: Building, x: number[]): Ind {
  const ev = evaluate(b, x);
  return {
    x,
    f: [ev.f1_eui, ev.f2_lcc, ev.f3_wlc],
    cv: Math.max(0, ev.capex - b.budget),
    rank: 0,
  };
}

// constraint-domination: feasible beats infeasible; among feasible, Pareto. */
function dominates(a: Ind, b: Ind): boolean {
  if (a.cv === 0 && b.cv > 0) return true;
  if (a.cv > 0 && b.cv === 0) return false;
  if (a.cv > 0 && b.cv > 0) return a.cv < b.cv;
  let betterEq = true, strictly = false;
  for (let i = 0; i < 3; i++) {
    if (a.f[i] > b.f[i]) betterEq = false;
    if (a.f[i] < b.f[i]) strictly = true;
  }
  return betterEq && strictly;
}

function nonDominatedSort(pop: Ind[]): Ind[][] {
  const fronts: Ind[][] = [];
  const S: number[][] = pop.map(() => []);
  const n: number[] = pop.map(() => 0);
  const f0: Ind[] = [];
  for (let i = 0; i < pop.length; i++) {
    for (let j = 0; j < pop.length; j++) {
      if (i === j) continue;
      if (dominates(pop[i], pop[j])) S[i].push(j);
      else if (dominates(pop[j], pop[i])) n[i]++;
    }
    if (n[i] === 0) { pop[i].rank = 0; f0.push(pop[i]); }
  }
  fronts.push(f0);
  let fi = 0;
  while (fronts[fi].length) {
    const next: Ind[] = [];
    for (const p of fronts[fi]) {
      const pi = pop.indexOf(p);
      for (const qi of S[pi]) {
        if (--n[qi] === 0) { pop[qi].rank = fi + 1; next.push(pop[qi]); }
      }
    }
    fi++;
    if (next.length) fronts.push(next); else break;
  }
  return fronts;
}

// ---- SBX crossover + polynomial mutation ---------------------------------- //
function sbx(p1: number[], p2: number[], rnd: () => number, eta = 15): [number[], number[]] {
  const c1 = [...p1], c2 = [...p2];
  for (let i = 0; i < p1.length; i++) {
    if (rnd() > 0.9) continue;
    if (Math.abs(p1[i] - p2[i]) < 1e-12) continue;
    const u = rnd();
    const beta = u <= 0.5 ? Math.pow(2 * u, 1 / (eta + 1)) : Math.pow(1 / (2 * (1 - u)), 1 / (eta + 1));
    let a = 0.5 * ((p1[i] + p2[i]) - beta * Math.abs(p2[i] - p1[i]));
    let b = 0.5 * ((p1[i] + p2[i]) + beta * Math.abs(p2[i] - p1[i]));
    c1[i] = Math.max(0, Math.min(1, a));
    c2[i] = Math.max(0, Math.min(1, b));
  }
  return [c1, c2];
}

function polyMutation(x: number[], rnd: () => number, eta = 20): number[] {
  const out = [...x];
  const pm = 1 / x.length;
  for (let i = 0; i < x.length; i++) {
    if (rnd() > pm) continue;
    const u = rnd();
    const delta = u < 0.5
      ? Math.pow(2 * u, 1 / (eta + 1)) - 1
      : 1 - Math.pow(2 * (1 - u), 1 / (eta + 1));
    out[i] = Math.max(0, Math.min(1, x[i] + delta));
  }
  return out;
}

// ---- NSGA-III environmental selection (normalise → associate → niche) ----- //
function select(combined: Ind[], fronts: Ind[][], popSize: number, refDirs: number[][]): Ind[] {
  const next: Ind[] = [];
  let lastFront: Ind[] = [];
  for (const fr of fronts) {
    if (next.length + fr.length <= popSize) next.push(...fr);
    else { lastFront = fr; break; }
  }
  if (next.length === popSize || lastFront.length === 0) return next.slice(0, popSize);

  const St = [...next, ...lastFront];

  // ideal point
  const ideal = [Infinity, Infinity, Infinity];
  for (const ind of St) for (let i = 0; i < 3; i++) ideal[i] = Math.min(ideal[i], ind.f[i]);
  // translate
  const trans = St.map((ind) => ind.f.map((v, i) => v - ideal[i]));

  // approximate nadir via per-axis max (robust, avoids degenerate ASF solve)
  const nadir = [0, 0, 0];
  for (const t of trans) for (let i = 0; i < 3; i++) nadir[i] = Math.max(nadir[i], t[i]);
  const denom = nadir.map((v) => (v < 1e-9 ? 1e-9 : v));
  const normed = trans.map((t) => t.map((v, i) => v / denom[i]));

  // associate each member of St to nearest reference line
  const assoc: number[] = [];
  const distArr: number[] = [];
  for (let s = 0; s < St.length; s++) {
    let best = 0, bestD = Infinity;
    for (let r = 0; r < refDirs.length; r++) {
      const w = refDirs[r];
      const wn = Math.hypot(...w) || 1e-9;
      // perpendicular distance from point to line through origin with dir w
      const dot = normed[s].reduce((a, v, i) => a + v * w[i], 0) / wn;
      let d2 = 0;
      for (let i = 0; i < 3; i++) { const proj = (dot * w[i]) / wn; d2 += (normed[s][i] - proj) ** 2; }
      const d = Math.sqrt(d2);
      if (d < bestD) { bestD = d; best = r; }
    }
    assoc[s] = best; distArr[s] = bestD;
  }

  // niche counts from the already-selected part (next)
  const nSelected = next.length;
  const niche: number[] = refDirs.map(() => 0);
  for (let s = 0; s < nSelected; s++) niche[assoc[s]]++;

  // candidates = members of the last front (indices into St)
  const lastStart = nSelected;
  const remaining = new Set<number>();
  for (let s = lastStart; s < St.length; s++) remaining.add(s);

  while (next.length < popSize && remaining.size > 0) {
    // reference point with minimum niche count among those with candidates
    let minNiche = Infinity;
    const refsWithCand = new Set<number>();
    for (const s of remaining) refsWithCand.add(assoc[s]);
    for (const r of refsWithCand) minNiche = Math.min(minNiche, niche[r]);
    const chosenRefs = [...refsWithCand].filter((r) => niche[r] === minNiche);
    const refj = chosenRefs[0];

    // candidates associated to refj
    const cands = [...remaining].filter((s) => assoc[s] === refj);
    let pick: number;
    if (niche[refj] === 0) {
      // nearest by perpendicular distance
      pick = cands.reduce((bestS, s) => (distArr[s] < distArr[bestS] ? s : bestS), cands[0]);
    } else {
      pick = cands[0];
    }
    next.push(St[pick]);
    remaining.delete(pick);
    niche[refj]++;
  }
  return next.slice(0, popSize);
}

function tournament(pop: Ind[], rnd: () => number): Ind {
  const a = pop[Math.floor(rnd() * pop.length)];
  const b = pop[Math.floor(rnd() * pop.length)];
  if (dominates(a, b)) return a;
  if (dominates(b, a)) return b;
  return rnd() < 0.5 ? a : b;
}

export interface NsgaResult {
  paretoX: number[][];
  paretoF: [number, number, number][];
  generations: number;
  popSize: number;
  refDirCount: number;
}

export function runNSGA3(b: Building, popSize = 92, nGen = 60, seed = 1): NsgaResult {
  const rnd = mulberry32(seed);
  const refDirs = dasDennis(3, 12);

  // init population (Latin-ish random)
  let pop: Ind[] = [];
  for (let i = 0; i < popSize; i++) {
    const x = Array.from({ length: N_VAR }, () => rnd());
    pop.push(makeInd(b, x));
  }

  for (let g = 0; g < nGen; g++) {
    // offspring
    const offspring: Ind[] = [];
    while (offspring.length < popSize) {
      const p1 = tournament(pop, rnd).x;
      const p2 = tournament(pop, rnd).x;
      const [c1, c2] = sbx(p1, p2, rnd);
      offspring.push(makeInd(b, polyMutation(c1, rnd)));
      if (offspring.length < popSize) offspring.push(makeInd(b, polyMutation(c2, rnd)));
    }
    const combined = [...pop, ...offspring];
    const fronts = nonDominatedSort(combined);
    pop = select(combined, fronts, popSize, refDirs);
  }

  // final non-dominated front
  const fronts = nonDominatedSort(pop);
  const front = fronts[0];
  // de-duplicate near-identical objective vectors
  const seen = new Set<string>();
  const uniq: Ind[] = [];
  for (const ind of front) {
    const key = ind.f.map((v) => v.toFixed(2)).join('|');
    if (!seen.has(key)) { seen.add(key); uniq.push(ind); }
  }
  return {
    paretoX: uniq.map((i) => i.x),
    paretoF: uniq.map((i) => i.f),
    generations: nGen,
    popSize,
    refDirCount: refDirs.length,
  };
}

export { MEASURE_KEYS, MEASURES };
