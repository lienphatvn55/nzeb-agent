"""
Surrogate physics-based energy / cost / carbon model for deep-energy retrofit
of buildings in Ho Chi Minh City (tropical hot-humid, cooling-dominated, ASHRAE 1A).

Design goals
------------
* Deterministic and fully *explainable*: every objective decomposes into named
  contributions so the XAI layer can attribute results to physical features and
  to each retrofit measure.
* Anchored to the building's *measured* current EUI (input `eui_base`) so the
  baseline is grounded in reality rather than a generic archetype.

Three objectives are exposed for NSGA-III multi-objective optimisation:
    f1 = EUI  : operational energy use intensity        [kWh/m2/yr]   (minimise)
    f2 = LCC  : life-cycle cost (NPV over study period)  [USD/m2]      (minimise)
    f3 = WLC  : whole-life carbon (embodied + operational)[kgCO2e/m2]  (minimise)
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, List

# --------------------------------------------------------------------------- #
# Climate & economic constants (Ho Chi Minh City)                             #
# --------------------------------------------------------------------------- #
STUDY_PERIOD_YEARS = 25          # analysis horizon
DISCOUNT_RATE = 0.06             # real discount rate
ENERGY_PRICE = 0.105             # USD / kWh (VN commercial tariff, blended)
ENERGY_ESCALATION = 0.03         # annual real energy price escalation
GRID_EF_BASE = 0.68              # kgCO2e / kWh (Vietnam grid, ~2023)
# Grid decarbonisation toward Net-Zero 2050: linear decline of emission factor.
GRID_EF_2050 = 0.05
BASE_YEAR = 2025
NET_ZERO_YEAR = 2050

PV_YIELD_HCMC = 1400.0           # kWh / kWp / yr (rooftop, HCMC irradiance)

# --------------------------------------------------------------------------- #
# Building-type archetypes: end-use share of the *measured* baseline EUI       #
# (cooling / lighting / equipment-plug / fans+pumps). DHW negligible in HCMC.  #
# --------------------------------------------------------------------------- #
ARCHETYPES: Dict[str, Dict[str, float]] = {
    "office":      {"cooling": 0.52, "lighting": 0.18, "equipment": 0.20, "fans": 0.10},
    "residential": {"cooling": 0.55, "lighting": 0.12, "equipment": 0.28, "fans": 0.05},
    "commercial":  {"cooling": 0.48, "lighting": 0.25, "equipment": 0.18, "fans": 0.09},
    "mixed":       {"cooling": 0.51, "lighting": 0.19, "equipment": 0.21, "fans": 0.09},
}

# Fraction of *cooling* energy driven by the building envelope (conduction +
# solar through opaque + fenestration). The remainder is internal & ventilation
# loads that envelope measures cannot remove.
ENVELOPE_DRIVEN_FRACTION_OF_COOLING = 0.42
# Of the envelope-driven cooling, how it splits across paths:
ENV_SPLIT = {"wall": 0.30, "roof": 0.28, "window_cond": 0.14, "solar_gain": 0.28}


@dataclass
class Building:
    btype: str
    year_built: int
    area: float            # gross floor area  [m2]
    floors: int
    eui_base: float        # measured current EUI [kWh/m2/yr]
    u_wall: float          # current wall U-value [W/m2K]
    budget: float          # retrofit capex ceiling [USD]

    # Derived geometric estimates (transparent, override-able)
    def roof_area(self) -> float:
        return self.area / max(self.floors, 1)

    def facade_area(self) -> float:
        # Estimate facade area from footprint assuming ~square plan, 3.5 m floors.
        footprint = self.area / max(self.floors, 1)
        side = footprint ** 0.5
        return 4.0 * side * 3.5 * self.floors

    def window_area(self, wwr: float = 0.40) -> float:
        return self.facade_area() * wwr


# --------------------------------------------------------------------------- #
# Retrofit measures: the NSGA-III decision vector. Each intensity x_i in [0,1] #
# is the fraction of the maximum upgrade applied for that measure.             #
# --------------------------------------------------------------------------- #
@dataclass
class Measure:
    key: str
    name_en: str
    # cost model: cost = unit_cost * quantity(building)  *  intensity
    unit_cost: float                 # USD per unit
    embodied: float                  # kgCO2e per unit
    quantity: str                    # which building quantity scales it

MEASURES: List[Measure] = [
    Measure("wall_insulation", "Wall insulation (EPS/mineral wool)", 26.0, 14.0, "facade"),
    Measure("roof_insulation", "Roof insulation",                    22.0, 12.0, "roof"),
    Measure("cool_roof",       "Cool / reflective roof coating",      8.0,  3.0, "roof"),
    Measure("window_glazing",  "Low-e double glazing",              125.0, 45.0, "window"),
    Measure("external_shading","External shading / louvres",         62.0, 18.0, "window"),
    Measure("hvac_upgrade",    "High-COP HVAC (VRF / inverter)",      78.0, 22.0, "floor"),
    Measure("led_lighting",    "LED relighting + controls",          13.0,  4.0, "floor"),
    Measure("rooftop_pv",      "Rooftop solar PV",                   900.0,1150.0,"pv_kwp"),
]
MEASURE_KEYS = [m.key for m in MEASURES]
N_VAR = len(MEASURES)


def _quantity(b: Building, q: str) -> float:
    if q == "facade":
        return b.facade_area()
    if q == "roof":
        return b.roof_area()
    if q == "window":
        return b.window_area()
    if q == "floor":
        return b.area
    if q == "pv_kwp":
        # Usable rooftop ~70% of footprint, ~0.18 kWp/m2 module density.
        return b.roof_area() * 0.70 * 0.18
    return 0.0


def measure_capex(b: Building, x: List[float]) -> Dict[str, float]:
    """Per-measure capex (USD), scaled by intensity."""
    out = {}
    for m, xi in zip(MEASURES, x):
        out[m.key] = m.unit_cost * _quantity(b, m.quantity) * max(0.0, min(1.0, xi))
    return out


def measure_embodied(b: Building, x: List[float]) -> Dict[str, float]:
    out = {}
    for m, xi in zip(MEASURES, x):
        out[m.key] = m.embodied * _quantity(b, m.quantity) * max(0.0, min(1.0, xi))
    return out


# --------------------------------------------------------------------------- #
# Operational energy model                                                    #
# --------------------------------------------------------------------------- #
def energy_breakdown(b: Building, x: List[float]) -> Dict[str, float]:
    """
    Returns the post-retrofit annual energy by end use plus PV generation and
    the per-measure energy savings (for XAI). All values are kWh/m2/yr.
    """
    arch = ARCHETYPES.get(b.btype, ARCHETYPES["mixed"])
    cooling = b.eui_base * arch["cooling"]
    lighting = b.eui_base * arch["lighting"]
    equipment = b.eui_base * arch["equipment"]
    fans = b.eui_base * arch["fans"]

    xi = {m.key: max(0.0, min(1.0, v)) for m, v in zip(MEASURES, x)}

    # --- Envelope measures cut the envelope-driven part of cooling ---------- #
    env_cooling = cooling * ENVELOPE_DRIVEN_FRACTION_OF_COOLING
    # effectiveness: fraction of each path removable at full intensity
    wall_cut = env_cooling * ENV_SPLIT["wall"] * (0.70 * xi["wall_insulation"])
    roof_cut = env_cooling * ENV_SPLIT["roof"] * (
        0.65 * xi["roof_insulation"] + 0.25 * xi["cool_roof"]
    )
    wcond_cut = env_cooling * ENV_SPLIT["window_cond"] * (0.60 * xi["window_glazing"])
    solar_cut = env_cooling * ENV_SPLIT["solar_gain"] * (
        0.55 * xi["window_glazing"] + 0.65 * xi["external_shading"]
    )
    envelope_savings = wall_cut + roof_cut + wcond_cut + solar_cut

    # --- LED cuts lighting and also trims internal-gain cooling ------------- #
    led_lighting_cut = lighting * 0.55 * xi["led_lighting"]
    led_cooling_cut = led_lighting_cut * 0.25  # recovered as reduced cooling load

    cooling_after_loads = cooling - envelope_savings - led_cooling_cut

    # --- HVAC COP upgrade scales *remaining* cooling energy ----------------- #
    cop_base, cop_max = 2.8, 4.6
    cop_new = cop_base + (cop_max - cop_base) * xi["hvac_upgrade"]
    hvac_factor = cop_base / cop_new
    cooling_final = cooling_after_loads * hvac_factor
    hvac_savings = cooling_after_loads * (1.0 - hvac_factor)

    lighting_final = lighting - led_lighting_cut

    # --- Rooftop PV generation (offsets gross EUI) -------------------------- #
    pv_kwp = _quantity(b, "pv_kwp") * xi["rooftop_pv"]
    pv_gen_kwh = pv_kwp * PV_YIELD_HCMC
    pv_eui = pv_gen_kwh / b.area  # kWh/m2/yr offset

    gross_eui = cooling_final + lighting_final + equipment + fans
    net_eui = max(0.0, gross_eui - pv_eui)

    return {
        "cooling": cooling_final,
        "lighting": lighting_final,
        "equipment": equipment,
        "fans": fans,
        "gross_eui": gross_eui,
        "pv_offset": pv_eui,
        "net_eui": net_eui,
        # per-measure energy attribution (kWh/m2/yr saved) -> for XAI
        "save_wall": wall_cut,
        "save_roof": roof_cut,
        "save_window": wcond_cut + solar_cut,
        "save_shading": 0.0,  # folded into save_window split below
        "save_led": led_lighting_cut + led_cooling_cut,
        "save_hvac": hvac_savings,
        "save_pv": pv_eui,
        "cop_new": cop_new,
    }


def _grid_ef(year_offset: int) -> float:
    """Linearly declining grid emission factor toward Net-Zero 2050."""
    yr = BASE_YEAR + year_offset
    if yr >= NET_ZERO_YEAR:
        return GRID_EF_2050
    frac = (yr - BASE_YEAR) / (NET_ZERO_YEAR - BASE_YEAR)
    return GRID_EF_BASE + (GRID_EF_2050 - GRID_EF_BASE) * frac


def evaluate(b: Building, x: List[float]) -> Dict[str, float]:
    """
    Full evaluation of one retrofit design -> the three objectives plus the
    decomposition needed for XAI and compliance.
    """
    eb = energy_breakdown(b, x)
    net_eui = eb["net_eui"]

    capex_by = measure_capex(b, x)
    embodied_by = measure_embodied(b, x)
    capex = sum(capex_by.values())
    embodied = sum(embodied_by.values())

    # ---- f2: Life-cycle cost (NPV per m2) --------------------------------- #
    annual_energy_kwh = net_eui * b.area
    npv_energy = 0.0
    op_carbon_total = 0.0
    for yr in range(STUDY_PERIOD_YEARS):
        price = ENERGY_PRICE * ((1 + ENERGY_ESCALATION) ** yr)
        disc = (1 + DISCOUNT_RATE) ** yr
        npv_energy += (annual_energy_kwh * price) / disc
        op_carbon_total += annual_energy_kwh * _grid_ef(yr)

    lcc_total = capex + npv_energy
    lcc_per_m2 = lcc_total / b.area

    # ---- f3: Whole-life carbon (per m2) ----------------------------------- #
    wlc_total = embodied + op_carbon_total
    wlc_per_m2 = wlc_total / b.area

    return {
        "f1_eui": net_eui,
        "f2_lcc": lcc_per_m2,
        "f3_wlc": wlc_per_m2,
        "capex": capex,
        "capex_by": capex_by,
        "embodied": embodied,
        "embodied_by": embodied_by,
        "npv_energy": npv_energy,
        "op_carbon_total": op_carbon_total,
        "annual_energy_kwh": annual_energy_kwh,
        "energy": eb,
    }
