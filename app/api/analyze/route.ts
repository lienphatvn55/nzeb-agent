import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { btype, byear, barea, bfloors, beui, bwall, bbudget, lang } = body;
    const age = 2025 - parseInt(byear);

    const langNote =
      lang === 'ko'
        ? 'Respond entirely in Korean (한국어로 답변해주세요).'
        : lang === 'vi'
        ? 'Respond entirely in Vietnamese (Trả lời bằng tiếng Việt).'
        : 'Respond in English.';

    const recoPrompt = `You are an NZEB retrofit optimization expert for hot-humid climates (Ho Chi Minh City, Vietnam). ${langNote}

Building profile:
- Type: ${btype}, built ${byear} (${age} years old)
- Floor area: ${barea} m², ${bfloors} floors
- Current EUI: ${beui} kWh/m²/yr
- Wall U-value: ${bwall} W/m²K
- Retrofit budget: $${parseInt(bbudget).toLocaleString()}

Provide a structured response with these exact sections:
**TOP 3 RETROFIT MEASURES**
(List 3 measures with estimated savings % each)

**TARGET POST-RETROFIT EUI**
(Specific number and % reduction)

**KEY TRADE-OFFS**
(Energy / Cost / Comfort balance)

**SMART CITY INTEGRATION**
(1 specific IoT/AI monitoring recommendation)

Be technical and specific. Max 280 words.`;

    const compliancePrompt = `You are a green building compliance expert. ${langNote}

Building: ${btype}, ${byear}, EUI=${beui} kWh/m²/yr, wall U=${bwall} W/m²K, area=${barea}m², budget=$${parseInt(bbudget).toLocaleString()}

Assess compliance with these exact sections:

**QCVN 09:2017 STATUS**
(Current vs required EUI limit ~120 kWh/m²/yr for offices; wall U ≤1.5 W/m²K; pass/fail with gap analysis)

**LEED v5 BD+C — ENERGY & ATMOSPHERE**
(Estimated credits achievable; top 2 specific credit opportunities for this building)

Two sections, bullet points, max 200 words.`;

    const [recoResult, compResult] = await Promise.all([
      client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 800,
        messages: [{ role: 'user', content: recoPrompt }],
      }),
      client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        messages: [{ role: 'user', content: compliancePrompt }],
      }),
    ]);

    const recoText = recoResult.content
      .filter((c) => c.type === 'text')
      .map((c) => (c as { type: 'text'; text: string }).text)
      .join('');

    const compText = compResult.content
      .filter((c) => c.type === 'text')
      .map((c) => (c as { type: 'text'; text: string }).text)
      .join('');

    const euiNum = parseInt(beui);
    const wallNum = parseFloat(bwall);
    const qcvnPass = euiNum < 120 && wallNum < 1.5;
    const leedPts = euiNum < 100 ? 18 : euiNum < 130 ? 12 : euiNum < 160 ? 6 : 2;
    const savings = Math.round(euiNum * 0.28);
    const co2 = Math.round(parseInt(barea) * savings * 0.000493);
    const payback = Math.round(parseInt(bbudget) / (parseInt(barea) * savings * 0.12));

    return NextResponse.json({
      reco: recoText,
      compliance: compText,
      metrics: { savings, co2, payback, leedPts, qcvnPass },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}