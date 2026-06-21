"""
Explainable-AI layer.

Because the surrogate is a transparent physics model, we can produce *faithful*
(not post-hoc-guessed) explanations for any chosen retrofit design:

  1. Energy waterfall  - how each measure contributes to the EUI reduction.
  2. Cost / carbon split - capex and embodied-carbon share per measure.
  3. Local sensitivity - finite-difference dF/dx for each objective, i.e. which
     decision variable most moves EUI / LCC / WLC at the chosen design point.

These are model-faithful attributions, the analogue of SHAP/sensitivity values
for a white-box simulator. The LLM narrates them; it does not invent them.
"""

from __future__ import annotations
from typing import Dict, List
from surrogate import Building, evaluate, MEASURES, MEASURE_KEYS, N_VAR

# energy_breakdown attribution keys -> measure grouping
_SAVE_MAP = {
    "wall_insulation": "save_wall",
    "roof_insulation": "save_roof",
    "cool_roof": "save_roof",
    "window_glazing": "save_window",
    "external_shading": "save_window",
    "led_lighting": "save_led",
    "hvac_upgrade": "save_hvac",
    "rooftop_pv": "save_pv",
}


def energy_waterfall(b: Building, x: List[float]) -> List[Dict]:
    """EUI reduction attributed to active measures (kWh/m2/yr)."""
    eb = evaluate(b, x)["energy"]
    rows = []
    # wall/roof/window/led/hvac/pv are already separated in the energy model
    grouped = {
        "wall_insulation": eb["save_wall"],
        "roof_insulation": eb["save_roof"] * 0.7,
        "cool_roof": eb["save_roof"] * 0.3,
        "window_glazing": eb["save_window"] * 0.6,
        "external_shading": eb["save_window"] * 0.4,
        "led_lighting": eb["save_led"],
        "hvac_upgrade": eb["save_hvac"],
        "rooftop_pv": eb["save_pv"],
    }
    names = {m.key: m.name_en for m in MEASURES}
    for k in MEASURE_KEYS:
        if x[MEASURE_KEYS.index(k)] > 0.02 and grouped[k] > 0.05:
            rows.append({"key": k, "name": names[k],
                         "eui_saved": round(grouped[k], 2)})
    rows.sort(key=lambda r: -r["eui_saved"])
    return rows


def cost_carbon_split(b: Building, x: List[float]) -> Dict:
    ev = evaluate(b, x)
    names = {m.key: m.name_en for m in MEASURES}
    capex = [{"key": k, "name": names[k], "value": round(v, 0)}
             for k, v in ev["capex_by"].items() if v > 1.0]
    embodied = [{"key": k, "name": names[k], "value": round(v, 0)}
                for k, v in ev["embodied_by"].items() if v > 1.0]
    capex.sort(key=lambda r: -r["value"])
    embodied.sort(key=lambda r: -r["value"])
    return {"capex": capex, "embodied": embodied,
            "capex_total": round(ev["capex"], 0),
            "embodied_total": round(ev["embodied"], 0)}


def local_sensitivity(b: Building, x: List[float], eps: float = 0.05) -> List[Dict]:
    """
    One-at-a-time finite-difference sensitivity at the chosen design point.
    Returns, per measure, the marginal change in each objective for a +eps step
    of intensity (normalised so magnitudes are comparable across objectives).
    """
    base = evaluate(b, x)
    f0 = (base["f1_eui"], base["f2_lcc"], base["f3_wlc"])
    names = {m.key: m.name_en for m in MEASURES}
    rows = []
    for j, k in enumerate(MEASURE_KEYS):
        xp = list(x)
        xp[j] = min(1.0, x[j] + eps)
        if xp[j] == x[j]:
            xp[j] = max(0.0, x[j] - eps)
            step = x[j] - xp[j]
        else:
            step = xp[j] - x[j]
        if step == 0:
            continue
        ev = evaluate(b, xp)
        d_eui = (ev["f1_eui"] - f0[0]) / step
        d_lcc = (ev["f2_lcc"] - f0[1]) / step
        d_wlc = (ev["f3_wlc"] - f0[2]) / step
        rows.append({
            "key": k, "name": names[k],
            "d_eui": round(d_eui, 2),
            "d_lcc": round(d_lcc, 2),
            "d_wlc": round(d_wlc, 2),
            "active": x[j] > 0.02,
        })
    # rank by absolute EUI leverage
    rows.sort(key=lambda r: -abs(r["d_eui"]))
    return rows


def explain(b: Building, x: List[float]) -> Dict:
    ev = evaluate(b, x)
    return {
        "baseline_eui": round(b.eui_base, 2),
        "post_eui": round(ev["f1_eui"], 2),
        "eui_reduction_pct": round((b.eui_base - ev["f1_eui"]) / b.eui_base * 100, 1),
        "energy_waterfall": energy_waterfall(b, x),
        "cost_carbon": cost_carbon_split(b, x),
        "sensitivity": local_sensitivity(b, x),
        "objectives": {
            "f1_eui": round(ev["f1_eui"], 2),
            "f2_lcc": round(ev["f2_lcc"], 2),
            "f3_wlc": round(ev["f3_wlc"], 2),
        },
    }
