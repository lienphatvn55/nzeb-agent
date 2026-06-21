/**
 * Surrogate physics-based energy / cost / carbon model — TypeScript port of
 * engine/surrogate.py (kept verbatim in numbers). Runs in-process on Vercel.
 *
 * Objectives for NSGA-III:
 *   f1 = EUI  [kWh/m2/yr]   f2 = LCC [USD/m2]   f3 = WLC [kgCO2e/m2]
 */

export const STUDY_PERIOD_YEARS = 25;
export const DISCOUNT_RATE = 0.06;
export const ENERGY_PRICE = 0.105;
export const ENERGY_ESCALATION = 0.03;
export const GRID_EF_BASE = 0.68;
export const GRID_EF_2050 = 0.05;
export const BASE_YEAR = 2025;
export const NET_ZERO_YEAR = 2050;
export const PV_YIELD_HCMC = 1400.0;

export const ARCHETYPES: Record<string, Record<string, number>> = {
  office: { cooling: 0.52, lighting: 0.18, equipment: 0.20, fans: 0.10 },
  residential: { cooling: 0.55, lighting: 0.12, equipment: 0.28, fans: 0.05 },
  commercial: { cooling: 0.48, lighting: 0.25, equipment: 0.18, fans: 0.09 },
  mixed: { cooling: 0.51, lighting: 0.19, equipment: 0.21, fans: 0.09 },
};

const ENVELOPE_DRIVEN_FRACTION_OF_COOLING = 0.42;
const ENV_SPLIT = { wall: 0.30, roof: 0.28, window_cond: 0.14, solar_gain: 0.28 };

export interface Building {
  btype: string;
  year_built: number;
  area: number;
  floors: number;
  eui_base: number;
  u_wall: number;
  budget: number;
}

export interface Measure {
  key: string;
  name_en: string;
  unit_cost: number;
  embodied: number;
  quantity: 'facade' | 'roof' | 'window' | 'floor' | 'pv_kwp';
}

export const MEASURES: Measure[] = [
  { key: 'wall_insulation', name_en: 'Wall insulation (EPS/mineral wool)', unit_cost: 26.0, embodied: 14.0, quantity: 'facade' },
  { key: 'roof_insulation', name_en: 'Roof insulation', unit_cost: 22.0, embodied: 12.0, quantity: 'roof' },
  { key: 'cool_roof', name_en: 'Cool / reflective roof coating', unit_cost: 8.0, embodied: 3.0, quantity: 'roof' },
  { key: 'window_glazing', name_en: 'Low-e double glazing', unit_cost: 125.0, embodied: 45.0, quantity: 'window' },
  { key: 'external_shading', name_en: 'External shading / louvres', unit_cost: 62.0, embodied: 18.0, quantity: 'window' },
  { key: 'hvac_upgrade', name_en: 'High-COP HVAC (VRF / inverter)', unit_cost: 78.0, embodied: 22.0, quantity: 'floor' },
  { key: 'led_lighting', name_en: 'LED relighting + controls', unit_cost: 13.0, embodied: 4.0, quantity: 'floor' },
  { key: 'rooftop_pv', name_en: 'Rooftop solar PV', unit_cost: 900.0, embodied: 1150.0, quantity: 'pv_kwp' },
];
export const MEASURE_KEYS = MEASURES.map((m) => m.key);
export const N_VAR = MEASURES.length;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function roofArea(b: Building) { return b.area / Math.max(b.floors, 1); }
function facadeArea(b: Building) {
  const footprint = b.area / Math.max(b.floors, 1);
  const side = Math.sqrt(footprint);
  return 4.0 * side * 3.5 * b.floors;
}
function windowArea(b: Building, wwr = 0.40) { return facadeArea(b) * wwr; }

function quantity(b: Building, q: Measure['quantity']): number {
  switch (q) {
    case 'facade': return facadeArea(b);
    case 'roof': return roofArea(b);
    case 'window': return windowArea(b);
    case 'floor': return b.area;
    case 'pv_kwp': return roofArea(b) * 0.70 * 0.18;
  }
}

export function measureCapex(b: Building, x: number[]): Record<string, number> {
  const out: Record<string, number> = {};
  MEASURES.forEach((m, i) => { out[m.key] = m.unit_cost * quantity(b, m.quantity) * clamp01(x[i]); });
  return out;
}
export function measureEmbodied(b: Building, x: number[]): Record<string, number> {
  const out: Record<string, number> = {};
  MEASURES.forEach((m, i) => { out[m.key] = m.embodied * quantity(b, m.quantity) * clamp01(x[i]); });
  return out;
}

export interface EnergyBreakdown {
  cooling: number; lighting: number; equipment: number; fans: number;
  gross_eui: number; pv_offset: number; net_eui: number;
  save_wall: number; save_roof: number; save_window: number; save_shading: number;
  save_led: number; save_hvac: number; save_pv: number; cop_new: number;
}

export function energyBreakdown(b: Building, x: number[]): EnergyBreakdown {
  const arch = ARCHETYPES[b.btype] ?? ARCHETYPES.mixed;
  const cooling0 = b.eui_base * arch.cooling;
  const lighting0 = b.eui_base * arch.lighting;
  const equipment = b.eui_base * arch.equipment;
  const fans = b.eui_base * arch.fans;

  const xi: Record<string, number> = {};
  MEASURE_KEYS.forEach((k, i) => { xi[k] = clamp01(x[i]); });

  const envCooling = cooling0 * ENVELOPE_DRIVEN_FRACTION_OF_COOLING;
  const wallCut = envCooling * ENV_SPLIT.wall * (0.70 * xi.wall_insulation);
  const roofCut = envCooling * ENV_SPLIT.roof * (0.65 * xi.roof_insulation + 0.25 * xi.cool_roof);
  const wcondCut = envCooling * ENV_SPLIT.window_cond * (0.60 * xi.window_glazing);
  const solarCut = envCooling * ENV_SPLIT.solar_gain * (0.55 * xi.window_glazing + 0.65 * xi.external_shading);
  const envelopeSavings = wallCut + roofCut + wcondCut + solarCut;

  const ledLightingCut = lighting0 * 0.55 * xi.led_lighting;
  const ledCoolingCut = ledLightingCut * 0.25;

  const coolingAfterLoads = cooling0 - envelopeSavings - ledCoolingCut;

  const copBase = 2.8, copMax = 4.6;
  const copNew = copBase + (copMax - copBase) * xi.hvac_upgrade;
  const hvacFactor = copBase / copNew;
  const coolingFinal = coolingAfterLoads * hvacFactor;
  const hvacSavings = coolingAfterLoads * (1.0 - hvacFactor);

  const lightingFinal = lighting0 - ledLightingCut;

  const pvKwp = quantity(b, 'pv_kwp') * xi.rooftop_pv;
  const pvGenKwh = pvKwp * PV_YIELD_HCMC;
  const pvEui = pvGenKwh / b.area;

  const grossEui = coolingFinal + lightingFinal + equipment + fans;
  const netEui = Math.max(0, grossEui - pvEui);

  return {
    cooling: coolingFinal, lighting: lightingFinal, equipment, fans,
    gross_eui: grossEui, pv_offset: pvEui, net_eui: netEui,
    save_wall: wallCut, save_roof: roofCut, save_window: wcondCut + solarCut,
    save_shading: 0.0, save_led: ledLightingCut + ledCoolingCut,
    save_hvac: hvacSavings, save_pv: pvEui, cop_new: copNew,
  };
}

function gridEf(yearOffset: number): number {
  const yr = BASE_YEAR + yearOffset;
  if (yr >= NET_ZERO_YEAR) return GRID_EF_2050;
  const frac = (yr - BASE_YEAR) / (NET_ZERO_YEAR - BASE_YEAR);
  return GRID_EF_BASE + (GRID_EF_2050 - GRID_EF_BASE) * frac;
}

export interface Evaluation {
  f1_eui: number; f2_lcc: number; f3_wlc: number;
  capex: number; capex_by: Record<string, number>;
  embodied: number; embodied_by: Record<string, number>;
  npv_energy: number; op_carbon_total: number; annual_energy_kwh: number;
  energy: EnergyBreakdown;
}

export function evaluate(b: Building, x: number[]): Evaluation {
  const eb = energyBreakdown(b, x);
  const netEui = eb.net_eui;

  const capexBy = measureCapex(b, x);
  const embodiedBy = measureEmbodied(b, x);
  const capex = Object.values(capexBy).reduce((a, c) => a + c, 0);
  const embodied = Object.values(embodiedBy).reduce((a, c) => a + c, 0);

  const annualEnergyKwh = netEui * b.area;
  let npvEnergy = 0;
  let opCarbonTotal = 0;
  for (let yr = 0; yr < STUDY_PERIOD_YEARS; yr++) {
    const price = ENERGY_PRICE * Math.pow(1 + ENERGY_ESCALATION, yr);
    const disc = Math.pow(1 + DISCOUNT_RATE, yr);
    npvEnergy += (annualEnergyKwh * price) / disc;
    opCarbonTotal += annualEnergyKwh * gridEf(yr);
  }

  const lccTotal = capex + npvEnergy;
  const lccPerM2 = lccTotal / b.area;
  const wlcTotal = embodied + opCarbonTotal;
  const wlcPerM2 = wlcTotal / b.area;

  return {
    f1_eui: netEui, f2_lcc: lccPerM2, f3_wlc: wlcPerM2,
    capex, capex_by: capexBy, embodied, embodied_by: embodiedBy,
    npv_energy: npvEnergy, op_carbon_total: opCarbonTotal,
    annual_energy_kwh: annualEnergyKwh, energy: eb,
  };
}
