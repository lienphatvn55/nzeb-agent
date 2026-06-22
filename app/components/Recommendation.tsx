'use client';
import { useMemo } from 'react';

type Block =
  | { kind: 'para'; text: string; sub: boolean }
  | { kind: 'list'; items: string[] };

interface Section { title: string; blocks: Block[]; }

// A line is a section header if it's markdown-bold/heading, OR an ALL-CAPS line
// (some models emit the headers in CAPS without ** markers — handle both).
const isHeader = (l: string) => {
  if (/^\*\*|^#{1,6}\s/.test(l)) return true;
  if (/^[-•·*]\s/.test(l)) return false;
  const tt = l.trim();
  if (!tt || tt.length > 64) return false;
  const hasLetter = /[A-Za-zÀ-ỹ]/.test(tt);
  return hasLetter && tt === tt.toUpperCase() && tt !== tt.toLowerCase();
};
const clean = (l: string) => l.replace(/\*\*/g, '').replace(/^#{1,6}\s*/, '').replace(/^[-•·*]\s+/, '').trim();

function parse(narrative: string): { intro: string[]; title: string; sections: Section[] } {
  const lines = narrative.split('\n').map((l) => l.replace(/\r/g, '').trim()).filter((l) => l && !/^-{3,}$/.test(l));
  const intro: string[] = [];
  let title = '';
  const sections: Section[] = [];
  let cur: Section | null = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (isHeader(l)) {
      const text = clean(l);
      if (!title && !cur && sections.length === 0 && i + 1 < lines.length && isHeader(lines[i + 1])) { title = text; continue; }
      cur = { title: text, blocks: [] };
      sections.push(cur);
      continue;
    }
    const text = clean(l);
    if (!cur) { intro.push(text); continue; }
    const bullet = /^[-•·*]\s+/.test(l) || /^\d+[.)]\s+/.test(l);
    if (bullet) {
      const item = l.replace(/^[-•·*]\s+/, '').replace(/^\d+[.)]\s+/, '').replace(/\*\*/g, '').trim();
      const last = cur.blocks[cur.blocks.length - 1];
      if (last && last.kind === 'list') last.items.push(item);
      else cur.blocks.push({ kind: 'list', items: [item] });
    } else {
      cur.blocks.push({ kind: 'para', text, sub: text.endsWith(':') });
    }
  }
  return { intro, title, sections };
}

function splitLabel(item: string): { label: string; rest: string } {
  const colon = item.indexOf(':');
  if (colon > 1 && colon <= 46 && !/^[\d+\-−$]/.test(item)) {
    return { label: item.slice(0, colon).trim(), rest: item.slice(colon + 1).trim() };
  }
  return { label: '', rest: item };
}

function renderRest(rest: string) {
  const parts = rest.split(/(\([^)]*\))/g).filter(Boolean);
  return parts.map((p, i) =>
    p.startsWith('(') && p.endsWith(')')
      ? <span key={i} className="text-on-surface-variant/60">{p}</span>
      : <span key={i}>{p}</span>,
  );
}

const SECTION_TITLES: Record<string, string[]> = {
  en: ['Recommended retrofit package', 'Why (explainability)', 'Trade-offs on the Pareto front', 'Compliance', 'Smart-city / Net-Zero 2050 pathway'],
  vi: ['Gói cải tạo khuyến nghị', 'Vì sao (giải thích được)', 'Đánh đổi trên mặt Pareto', 'Tuân thủ tiêu chuẩn', 'Lộ trình Smart-city / Net-Zero 2050'],
  ko: ['권장 리트로핏 패키지', '근거 (설명가능성)', '파레토 프론트 트레이드오프', '규정 준수', '스마트시티 / 넷제로 2050 경로'],
};

// teal → amber → secondary accent cycle
const ACCENTS = ['#00e5ff', '#f3bf26', '#bdc7db', '#9cf0ff', '#fec931'];

export default function Recommendation({ narrative, lang = 'en' }: { narrative: string; lang?: string }) {
  const { title, sections } = useMemo(() => parse(narrative), [narrative]);
  const localized = SECTION_TITLES[lang] ?? SECTION_TITLES.en;

  if (!sections.length && !title) {
    return <div className="text-sm text-on-surface-variant whitespace-pre-wrap leading-relaxed">{narrative}</div>;
  }

  return (
    <div className="space-y-3">
      {title && (
        <div className="rounded-lg border border-primary-container/30 bg-primary-container/10 px-4 py-2.5 cyber-glow">
          <div className="text-[10px] font-medium uppercase tracking-wider text-primary-container/80 font-mono">NZEB · Net-Zero 2050</div>
          <div className="text-[13px] font-semibold text-primary leading-snug">{title}</div>
        </div>
      )}

      <div className="columns-1 sm:columns-2 sm:gap-4">
        {sections.map((s, i) => {
          const c = ACCENTS[i % ACCENTS.length];
          return (
            <section key={i} className="break-inside-avoid mb-4 rounded-lg cyber-border bg-surface-container-low p-3.5">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 rounded-md text-[11px] font-bold flex items-center justify-center shrink-0"
                  style={{ color: c, background: `${c}22` }}>{i + 1}</span>
                <h3 className="text-[11px] font-bold uppercase tracking-wide font-mono" style={{ color: c }}>{localized[i] ?? s.title}</h3>
              </div>
              <div className="space-y-2">
                {s.blocks.map((b, j) =>
                  b.kind === 'list' ? (
                    <ul key={j} className="space-y-1">
                      {b.items.map((it, k) => {
                        const { label, rest } = splitLabel(it);
                        return (
                          <li key={k} className="flex gap-2 text-[12.5px] leading-[1.5] text-on-surface-variant">
                            <span className="mt-[6px] w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c }} />
                            <span className="min-w-0">
                              {label && <span className="font-semibold text-on-surface">{label}: </span>}
                              {renderRest(rest)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : b.sub ? (
                    <p key={j} className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant pt-1 font-mono">{b.text}</p>
                  ) : (
                    <p key={j} className="text-[12.5px] leading-[1.5] text-on-surface-variant">{b.text}</p>
                  ),
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
