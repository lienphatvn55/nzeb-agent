"""
NSGA-III multi-objective optimisation of deep-energy retrofit designs.

Decision vector x in [0,1]^8  -> intensity of each retrofit measure.
Objectives (all minimised):
    f1 = EUI  [kWh/m2/yr]
    f2 = LCC  [USD/m2]   (25-yr NPV: capex + discounted energy)
    f3 = WLC  [kgCO2e/m2](embodied + 25-yr operational carbon)
Constraint:
    g  = total capex - budget <= 0

NSGA-III is chosen over NSGA-II because we have 3 objectives and want a
well-spread Pareto front via Das-Dennis reference directions.
"""

from __future__ import annotations
from typing import Dict, List
import numpy as np

from pymoo.core.problem import Problem
from pymoo.algorithms.moo.nsga3 import NSGA3
from pymoo.util.ref_dirs import get_reference_directions
from pymoo.optimize import minimize

from surrogate import Building, evaluate, MEASURE_KEYS, MEASURES, N_VAR


class RetrofitProblem(Problem):
    def __init__(self, b: Building):
        self.b = b
        super().__init__(
            n_var=N_VAR, n_obj=3, n_ieq_constr=1,
            xl=np.zeros(N_VAR), xu=np.ones(N_VAR),
        )

    def _evaluate(self, X, out, *args, **kwargs):
        F = np.zeros((X.shape[0], 3))
        G = np.zeros((X.shape[0], 1))
        for i, x in enumerate(X):
            ev = evaluate(self.b, list(x))
            F[i, 0] = ev["f1_eui"]
            F[i, 1] = ev["f2_lcc"]
            F[i, 2] = ev["f3_wlc"]
            G[i, 0] = ev["capex"] - self.b.budget
        out["F"] = F
        out["G"] = G


def _knee_index(F: np.ndarray) -> int:
    """Pick a balanced compromise solution via min-max normalised distance."""
    fmin = F.min(axis=0)
    fmax = F.max(axis=0)
    span = np.where(fmax - fmin < 1e-9, 1.0, fmax - fmin)
    norm = (F - fmin) / span
    # distance to the ideal (origin after normalisation)
    dist = np.linalg.norm(norm, axis=1)
    return int(np.argmin(dist))


def run_nsga3(b: Building, pop_size: int = 92, n_gen: int = 60,
              seed: int = 1) -> Dict:
    ref_dirs = get_reference_directions("das-dennis", 3, n_partitions=12)
    algorithm = NSGA3(pop_size=pop_size, ref_dirs=ref_dirs)
    problem = RetrofitProblem(b)
    res = minimize(problem, algorithm, ("n_gen", n_gen), seed=seed, verbose=False)

    X = np.atleast_2d(res.X)
    F = np.atleast_2d(res.F)

    # Build a clean, serialisable Pareto set with full decomposition
    solutions = []
    for x, f in zip(X, F):
        ev = evaluate(b, list(x))
        solutions.append({
            "x": {k: round(float(v), 3) for k, v in zip(MEASURE_KEYS, x)},
            "f1_eui": round(float(f[0]), 2),
            "f2_lcc": round(float(f[1]), 2),
            "f3_wlc": round(float(f[2]), 2),
            "capex": round(ev["capex"], 0),
            "energy": {k: round(v, 2) for k, v in ev["energy"].items()},
        })

    knee = _knee_index(F)

    # Reference extremes for context
    idx_min_eui = int(np.argmin(F[:, 0]))
    idx_min_lcc = int(np.argmin(F[:, 1]))
    idx_min_wlc = int(np.argmin(F[:, 2]))

    return {
        "n_solutions": len(solutions),
        "solutions": solutions,
        "recommended_index": knee,
        "extremes": {
            "min_eui": idx_min_eui,
            "min_lcc": idx_min_lcc,
            "min_wlc": idx_min_wlc,
        },
        "measures": [{"key": m.key, "name": m.name_en} for m in MEASURES],
        "objective_labels": {
            "f1_eui": "EUI (kWh/m²/yr)",
            "f2_lcc": "LCC (USD/m²)",
            "f3_wlc": "WLC (kgCO₂e/m²)",
        },
        "algorithm": {
            "name": "NSGA-III",
            "pop_size": pop_size,
            "generations": n_gen,
            "ref_dirs": "Das-Dennis (p=12, 91 directions)",
        },
    }
