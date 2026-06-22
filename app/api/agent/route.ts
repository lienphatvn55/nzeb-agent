import { NextRequest, NextResponse } from 'next/server';
import { runHarness } from '@/lib/harness/agent';
import { BuildingInput } from '@/lib/harness/engine-client';

export const runtime = 'nodejs';
export const maxDuration = 60;

// --- Rate limiting (per-IP sliding window) --------------------------------- //
// DISABLED by default so testers/reviewers can use the app freely. Flip
// RATE_LIMIT_ENABLED to `true` to turn on abuse/cost protection.
// NOTE: this in-memory limiter only protects ONE serverless instance. For real
//    production behind multiple instances, back it with Upstash/Redis instead.
const RATE_LIMIT_ENABLED = false; // set true to enable rate limiting
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10; // requests per window per IP
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  if (!RATE_LIMIT_ENABLED) return false;
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_LIMIT_MAX;
}

// Upper bounds keep a single request from triggering a pathological workload.
const MAX = { year: 2100, area: 5_000_000, floors: 300, eui: 1000, uWall: 100, budget: 1e10 };

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
  const checks: Array<[number, string, number]> = [
    [b.year_built, 'year built', MAX.year],
    [b.area, 'floor area', MAX.area],
    [b.floors, 'floors', MAX.floors],
    [b.eui_base, 'EUI', MAX.eui],
    [b.u_wall, 'wall U-value', MAX.uWall],
    [b.budget, 'budget', MAX.budget],
  ];
  for (const [v, label, max] of checks) {
    if (!Number.isFinite(v) || v <= 0) return `Invalid ${label}`;
    if (v > max) return `${label} out of plausible range`;
  }
  const ALLOWED = ['office', 'residential', 'commercial', 'mixed'];
  if (!ALLOWED.includes(b.btype)) b.btype = 'office';
  return b;
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('[agent] ANTHROPIC_API_KEY is not set');
      return NextResponse.json({ error: 'Server is not configured' }, { status: 503 });
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
    if (rateLimited(ip)) {
      return NextResponse.json({ error: 'Too many requests, please slow down' }, { status: 429 });
    }

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
    // Log the full error server-side; return a generic message to the client so
    // we don't leak stack traces / internal paths. Detail only in development.
    console.error('[agent] run failed:', err);
    const detail = process.env.NODE_ENV !== 'production' ? String(err) : undefined;
    return NextResponse.json(
      { error: 'Agent run failed', ...(detail ? { detail } : {}) },
      { status: 500 },
    );
  }
}
