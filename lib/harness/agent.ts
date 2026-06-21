/**
 * Agent Harness.
 *
 * A real tool-use loop (not a one-shot prompt): Claude plans, calls the
 * decision-engine tools, observes grounded results, and iterates until it can
 * write an explainable recommendation. Every claim in the final narrative is
 * backed by a tool result captured in `ctx.captured`.
 */
import Anthropic from '@anthropic-ai/sdk';
import { TOOLS, dispatchTool, HarnessContext } from './tools';
import { BuildingInput } from './engine-client';

// Sonnet by default for fast, reliable serverless runs; set HARNESS_MODEL to
// claude-opus-4-8 for the highest-quality narrative when latency budget allows.
const MODEL = process.env.HARNESS_MODEL ?? 'claude-sonnet-4-6';
const MAX_STEPS = 8;

const LANG_NOTE: Record<string, string> = {
  vi: 'Viết toàn bộ phần tường thuật bằng tiếng Việt.',
  ko: '모든 서술은 한국어로 작성하십시오.',
  en: 'Write all narrative in English.',
};

function systemPrompt(lang: string): string {
  return `You are the orchestration agent of an enterprise NZEB (Net-Zero Energy Building) deep-retrofit decision-support platform for Ho Chi Minh City, supporting the city's Net-Zero Carbon 2050 roadmap across building types (office, residential, commercial, mixed-use).

You do NOT invent numbers. You reason ONLY from the decision engine's tools:
- The surrogate energy model and NSGA-III optimiser produce f1=EUI, f2=LCC, f3=WLC.
- The compliance engine decides QCVN 09:2017 and LEED v5 BD+C verdicts.
- The XAI tool produces model-faithful attributions.

Required workflow:
1. Call run_nsga3_optimization first to obtain the Pareto front and the recommended (knee) design.
2. Call explain_design on the recommended design's intensity vector x to obtain the XAI attribution.
3. Call check_compliance on that same x to confirm the QCVN/LEED verdict.
4. Then write the final recommendation.

Final recommendation must contain these exact section headers (translate the heading text per the language instruction but keep the structure):
**RECOMMENDED RETROFIT PACKAGE** — the selected measures with their intensities, and the resulting EUI / LCC / WLC vs the baseline EUI.
**WHY (EXPLAINABILITY)** — cite the XAI waterfall: which measures contribute most to the EUI reduction, and the key sensitivity driver. Be specific with numbers.
**TRADE-OFFS ON THE PARETO FRONT** — contrast the recommended design with the min-EUI and min-LCC extremes.
**COMPLIANCE** — state QCVN 09:2017 pass/fail with the failing clause if any, and the LEED v5 BD+C likely tier with EA points.
**SMART-CITY / NET-ZERO 2050 PATHWAY** — one concrete IoT/M&V and scale-up recommendation.

Be concise, technical and decision-oriented. Max ~320 words. Use short bullet lines ("- ") for lists; do NOT use markdown tables (the UI renders plain text). ${LANG_NOTE[lang] ?? LANG_NOTE.en}`;
}

export interface HarnessResult {
  narrative: string;
  trace: Array<{ step: number; tool: string; input: unknown; summary: string }>;
  captured: HarnessContext['captured'];
  model: string;
  steps: number;
}

export async function runHarness(
  building: BuildingInput,
  lang: string,
): Promise<HarnessResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const ctx: HarnessContext = { building, captured: {} };
  const trace: HarnessResult['trace'] = [];

  const profile =
    `Building profile:\n` +
    `- Type: ${building.btype}\n` +
    `- Year built: ${building.year_built}\n` +
    `- Floor area: ${building.area} m²\n` +
    `- Floors: ${building.floors}\n` +
    `- Measured EUI: ${building.eui_base} kWh/m²/yr\n` +
    `- Wall U-value: ${building.u_wall} W/m²K\n` +
    `- Retrofit budget: $${building.budget.toLocaleString()}\n\n` +
    `Produce the explainable deep-retrofit recommendation following your required workflow.`;

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: profile },
  ];

  let steps = 0;
  let narrative = '';

  while (steps < MAX_STEPS) {
    steps++;
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 1600,
      system: systemPrompt(lang),
      tools: TOOLS,
      messages,
    });

    messages.push({ role: 'assistant', content: resp.content });

    const toolUses = resp.content.filter(
      (c): c is Anthropic.ToolUseBlock => c.type === 'tool_use',
    );

    // collect any text the model emitted this turn
    const text = resp.content
      .filter((c): c is Anthropic.TextBlock => c.type === 'text')
      .map((c) => c.text)
      .join('\n')
      .trim();
    if (text) narrative = text;

    if (resp.stop_reason !== 'tool_use' || toolUses.length === 0) {
      break;
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      let result: unknown;
      try {
        result = await dispatchTool(tu.name, tu.input as Record<string, unknown>, ctx);
        trace.push({
          step: steps, tool: tu.name, input: tu.input,
          summary: summarize(tu.name, result),
        });
      } catch (e) {
        result = { error: String(e) };
        trace.push({ step: steps, tool: tu.name, input: tu.input, summary: `error: ${e}` });
      }
      toolResults.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: JSON.stringify(result),
      });
    }
    messages.push({ role: 'user', content: toolResults });
  }

  return { narrative, trace, captured: ctx.captured, model: MODEL, steps };
}

function summarize(tool: string, result: unknown): string {
  const r = result as Record<string, unknown>;
  if (tool === 'run_nsga3_optimization') {
    const d = (r.recommended_design as Record<string, number>) ?? {};
    return `Pareto=${r.n_solutions} sols · rec EUI=${d.f1_eui} LCC=${d.f2_lcc} WLC=${d.f3_wlc}`;
  }
  if (tool === 'check_compliance') {
    const q = (r.qcvn as Record<string, unknown>) ?? {};
    const l = (r.leed as Record<string, unknown>) ?? {};
    return `QCVN ${q.n_pass}/${q.n_total} · LEED ${l.likely_tier}`;
  }
  if (tool === 'explain_design') {
    return `EUI -${r.eui_reduction_pct}% · ${(r.energy_waterfall as unknown[])?.length ?? 0} drivers`;
  }
  return 'ok';
}
