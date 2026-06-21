import { NextRequest, NextResponse } from 'next/server';
import { runHarness } from '@/lib/harness/agent';
import { BuildingInput } from '@/lib/harness/engine-client';

export const runtime = 'nodejs';
export const maxDuration = 60;

function parseBuilding(body: Record<string, unknown>): BuildingInput | string {
  const num = (v: unknown) => Number(v);
  const b: BuildingInput = {
    btype: String(body.btype ?? 'office'),
    year_built: num(body.byear ?? body.year_built),
    area: num(body.barea ?? body.area),
    floors: num(body.bfloors ?? body.floors),
    eui_base: num(body.beui ?? body.eui_base),
    u_wall: num(body.bwall ?? body.u_wall),
    budget: num(body.bbudget ?? body.budget),
  };
  const checks: Array<[number, string]> = [
    [b.year_built, 'year built'], [b.area, 'floor area'], [b.floors, 'floors'],
    [b.eui_base, 'EUI'], [b.u_wall, 'wall U-value'], [b.budget, 'budget'],
  ];
  for (const [v, label] of checks) {
    if (!Number.isFinite(v) || v <= 0) return `Invalid ${label}`;
  }
  if (b.eui_base > 1000) return 'EUI out of plausible range';
  return b;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const lang = String(body.lang ?? 'en').toLowerCase();
    const parsed = parseBuilding(body);
    if (typeof parsed === 'string') {
      return NextResponse.json({ error: parsed }, { status: 400 });
    }

    const result = await runHarness(parsed, lang);
    return NextResponse.json({
      building: parsed,
      narrative: result.narrative,
      trace: result.trace,
      steps: result.steps,
      model: result.model,
      optimization: result.captured.optimize ?? null,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Agent run failed', detail: String(err) }, { status: 500 });
  }
}
