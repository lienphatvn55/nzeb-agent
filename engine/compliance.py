"""
Deterministic compliance engine.

Checks a retrofit design against:
  * QCVN 09:2017/BXD - Vietnam National Technical Regulation on Energy Efficiency
    of Buildings (prescriptive envelope / lighting / HVAC requirements).
  * LEED v5 BD+C - Energy & Atmosphere (operational-carbon / energy-performance
    driven point estimate).

This is a *rule engine*, not an LLM guess: every check returns a structured
verdict with the measured value, the threshold, the gap, and the clause it maps
to. The LLM harness consumes these verdicts; it never decides pass/fail itself.

NOTE: thresholds are engineering proxies aligned to the public structure of each
standard. They are transparent and override-able, not a substitute for a
certified energy-model submission.
"""

from __future__ import annotations
from typing import Dict, List
from surrogate import Building, ARCHETYPES, energy_breakdown

# ---- QCVN 09:2017 prescriptive thresholds --------------------------------- #
QCVN_MIN_AREA = 2500.0           # m2 - scope of mandatory application
QCVN_WALL_U_MAX = 1.50           # W/m2K  (opaque wall transmittance proxy / OTTV)
QCVN_ROOF_U_MAX = 1.00           # W/m2K  (roof transmittance proxy / RTTV)
QCVN_SHGC_MAX = 0.40             # window solar heat gain coefficient (WWR<=0.4)
QCVN_COP_MIN = 2.90              # minimum chiller/HVAC COP
QCVN_LPD_MAX = {                 # lighting power density [W/m2]
    "office": 11.0, "residential": 8.0, "commercial": 14.0, "mixed": 12.0,
}

# Baseline (pre-retrofit) envelope assumptions for an aged HCMC building
ROOF_U_BASE = 1.80
SHGC_BASE = 0.62
LPD_BASE = {"office": 16.0, "residential": 12.0, "commercial": 20.0, "mixed": 16.0}


def effective_properties(b: Building, x: List[float]) -> Dict[str, float]:
    """Post-retrofit envelope / system properties derived from measure intensity."""
    xi = {k: max(0.0, min(1.0, v)) for k, v in zip(
        ["wall_insulation", "roof_insulation", "cool_roof", "window_glazing",
         "external_shading", "hvac_upgrade", "led_lighting", "rooftop_pv"], x)}

    u_wall = b.u_wall - xi["wall_insulation"] * 0.70 * (b.u_wall - 0.40)
    u_roof = ROOF_U_BASE - xi["roof_insulation"] * 0.75 * (ROOF_U_BASE - 0.30)
    shgc = SHGC_BASE - (0.45 * xi["window_glazing"] + 0.40 * xi["external_shading"]) * SHGC_BASE
    lpd0 = LPD_BASE.get(b.btype, LPD_BASE["mixed"])
    lpd = lpd0 - xi["led_lighting"] * 0.55 * lpd0
    cop = energy_breakdown(b, x)["cop_new"]
    return {"u_wall": u_wall, "u_roof": u_roof, "shgc": shgc, "lpd": lpd, "cop": cop}


def _check(name: str, clause: str, value: float, limit: float, unit: str,
           direction: str) -> Dict:
    """direction '<=' means value must be <= limit; '>=' means >= limit."""
    if direction == "<=":
        passed = value <= limit + 1e-9
        gap = value - limit
    else:
        passed = value >= limit - 1e-9
        gap = limit - value
    return {
        "name": name, "clause": clause, "value": round(value, 3),
        "limit": limit, "unit": unit, "direction": direction,
        "pass": bool(passed), "gap": round(gap, 3),
    }


def check_qcvn(b: Building, x: List[float], eui_post: float) -> Dict:
    p = effective_properties(b, x)
    checks = [
        _check("Wall thermal transmittance", "QCVN 09:2017 §2.1 (OTTV)",
               p["u_wall"], QCVN_WALL_U_MAX, "W/m2K", "<="),
        _check("Roof thermal transmittance", "QCVN 09:2017 §2.1 (RTTV)",
               p["u_roof"], QCVN_ROOF_U_MAX, "W/m2K", "<="),
        _check("Window SHGC", "QCVN 09:2017 §2.1.3",
               p["shgc"], QCVN_SHGC_MAX, "-", "<="),
        _check("HVAC minimum COP", "QCVN 09:2017 §2.2",
               p["cop"], QCVN_COP_MIN, "-", ">="),
        _check("Lighting power density", "QCVN 09:2017 §2.3",
               p["lpd"], QCVN_LPD_MAX.get(b.btype, QCVN_LPD_MAX["mixed"]),
               "W/m2", "<="),
    ]
    in_scope = b.area >= QCVN_MIN_AREA
    n_pass = sum(c["pass"] for c in checks)
    overall = all(c["pass"] for c in checks)
    return {
        "standard": "QCVN 09:2017/BXD",
        "in_scope": in_scope,
        "scope_note": (f"Floor area {b.area:.0f} m2 "
                       f"{'≥' if in_scope else '<'} {QCVN_MIN_AREA:.0f} m2 "
                       f"mandatory-application threshold"),
        "checks": checks,
        "passed": overall,
        "n_pass": n_pass,
        "n_total": len(checks),
    }


def check_leed_v5(b: Building, x: List[float], eui_post: float) -> Dict:
    """
    LEED v5 BD+C - Energy & Atmosphere estimate.
    v5 is decarbonisation-led: points scale with operational-carbon / energy
    reduction versus the measured baseline, plus renewables & electrification.
    """
    eui_base = b.eui_base
    improvement = max(0.0, (eui_base - eui_post) / eui_base)  # fraction 0..1

    xi = {k: max(0.0, min(1.0, v)) for k, v in zip(
        ["wall_insulation", "roof_insulation", "cool_roof", "window_glazing",
         "external_shading", "hvac_upgrade", "led_lighting", "rooftop_pv"], x)}
    eb = energy_breakdown(b, x)
    pv_fraction = eb["pv_offset"] / max(eb["gross_eui"], 1e-6)

    credits = []

    # EA Prerequisite: Minimum Energy Performance (>=5% improvement)
    prereq = improvement >= 0.05
    credits.append({"name": "Prerequisite: Minimum Energy Efficiency",
                    "type": "prerequisite", "met": prereq,
                    "detail": f"{improvement*100:.0f}% EUI improvement (≥5% required)"})

    # EA Credit: Optimize Energy Performance (decarbonisation) - up to 18 pts
    opt_pts = min(18, int(round(improvement / 0.50 * 18)))  # 50% improvement -> max
    credits.append({"name": "Optimize Energy Performance / Operational Carbon",
                    "type": "credit", "points": opt_pts, "max": 18,
                    "detail": f"{improvement*100:.0f}% reduction vs baseline EUI"})

    # EA Credit: Renewable Energy - up to 5 pts
    ren_pts = min(5, int(round(pv_fraction / 0.20 * 5)))  # 20% on-site -> max
    credits.append({"name": "Renewable Energy (on-site PV)",
                    "type": "credit", "points": ren_pts, "max": 5,
                    "detail": f"{pv_fraction*100:.0f}% of demand met by rooftop PV"})

    # EA Credit: Electrification / Grid Harmonization - up to 3 pts
    elec_pts = 3 if (xi["hvac_upgrade"] > 0.5 and pv_fraction > 0.05) else (
        2 if xi["hvac_upgrade"] > 0.3 else 0)
    credits.append({"name": "Electrification & Grid Harmonization",
                    "type": "credit", "points": elec_pts, "max": 3,
                    "detail": "Electrified high-COP HVAC + PV demand flexibility"})

    # EA Credit: Enhanced Commissioning + Metering - up to 4 pts (assumed scope)
    cx_pts = 4
    credits.append({"name": "Enhanced Commissioning + Advanced Metering",
                    "type": "credit", "points": cx_pts, "max": 4,
                    "detail": "IoT sub-metering + M&V assumed in retrofit scope"})

    ea_points = sum(c.get("points", 0) for c in credits)
    ea_max = 30
    # Heuristic mapping of EA strength -> likely overall certification tier
    if not prereq:
        tier = "Not certifiable (prerequisite unmet)"
    elif ea_points >= 24:
        tier = "Gold likely"
    elif ea_points >= 16:
        tier = "Silver likely"
    elif ea_points >= 8:
        tier = "Certified likely"
    else:
        tier = "Below Certified"

    return {
        "standard": "LEED v5 BD+C — Energy & Atmosphere",
        "prerequisite_met": prereq,
        "ea_points": ea_points,
        "ea_max": ea_max,
        "improvement_pct": round(improvement * 100, 1),
        "pv_fraction_pct": round(pv_fraction * 100, 1),
        "credits": credits,
        "likely_tier": tier,
    }


def assess(b: Building, x: List[float], eui_post: float) -> Dict:
    return {
        "qcvn": check_qcvn(b, x, eui_post),
        "leed": check_leed_v5(b, x, eui_post),
        "effective_properties": effective_properties(b, x),
    }
