'use client';
import { useMemo } from 'react';

/**
 * Renders the agent narrative as a structured report instead of a flat wall of
 * text. The harness emits sections wrapped in **bold** headers (translated per
 * language) with "- " bullet lines; we parse that into a hero title + numbered,
 * colour-accented sections with bold bullet labels.
 */

type Block =
  | { kind: 'para'; text: string; sub: boolean }
  | { kind: 'list'; items: string[] };

interface Section {
  title: string;
  blocks: Block[];
}

const HEADER_RE = /^\*\*|^#{1,6}\s/;
const isHeader = (l: string) => HEADER_RE.test(l);
const clean = (l: string) =>
  l.replace(/\*\*/g, '').replace(/^#{1,6}\s*/, '').replace(/^[-•·*]\s+/, '').trim();

function parse(narrative: string): { intro: string[]; title: string; sections: Section[] } {
  const lines = narrative
    .split('\n')
    .map((l) => l.replace(/\r/g, '').trim())
    .filter((l) => l && !/^-{3,}$/.test(l));

  const intro: string[] = [];
  let title = '';
  const sections: Section[] = [];
  let cur: Section | null = null;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (isHeader(l)) {
      const text = clean(l);
      // Hero title: the first header line directly followed by another header.
      if (!title && !cur && sections.length === 0 && i + 1 < lines.length && isHeader(lines[i + 1])) {
        title = text;
        continue;
      }
      cur = { title: text, blocks: [] };
      sections.push(cur);
      continue;
    }

    const text = clean(l);
    if (!cur) {
      intro.push(text);
      continue;
    }

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

// Split "Label: detail" into a bold label + rest. Guards against bolding values
// (lines starting with a number) or splitting on a colon deep inside the text.
function splitLabel(item: string): { label: string; rest: string } {
  const colon = item.indexOf(':');
  if (colon > 1 && colon <= 46 && !/^[\d+\-−$]/.test(item)) {
    return { label: item.slice(0, colon).trim(), rest: item.slice(colon + 1).trim() };
  }
  return { label: '', rest: item };
}

// Wrap parenthetical notes in a muted style so figures read cleanly.
function renderRest(rest: string) {
  const parts = rest.split(/(\([^)]*\))/g).filter(Boolean);
  return parts.map((p, i) =>
    p.startsWith('(') && p.endsWith(')') ? (
      <span key={i} className="text-slate-400 dark:text-slate-500">{p}</span>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

// The harness emits exactly these 5 sections, in this order. We relabel them in
// the UI language so headers always match the selected language even when the
// model leaves its headers in English.
const SECTION_TITLES: Record<string, string[]> = {
  en: ['Recommended retrofit package', 'Why (explainability)', 'Trade-offs on the Pareto front', 'Compliance', 'Smart-city / Net-Zero 2050 pathway'],
  vi: ['Gói cải tạo khuyến nghị', 'Vì sao (giải thích được)', 'Đánh đổi trên mặt Pareto', 'Tuân thủ tiêu chuẩn', 'Lộ trình Smart-city / Net-Zero 2050'],
  ko: ['권장 리트로핏 패키지', '근거 (설명가능성)', '파레토 프론트 트레이드오프', '규정 준수', '스마트시티 / 넷제로 2050 경로'],
};

const ACCENTS = [
  { bar: 'bg-blue-500', dot: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400', chip: 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300' },
  { bar: 'bg-indigo-500', dot: 'bg-indigo-500', text: 'text-indigo-600 dark:text-indigo-400', chip: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300' },
  { bar: 'bg-cyan-500', dot: 'bg-cyan-500', text: 'text-cyan-600 dark:text-cyan-400', chip: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-300' },
  { bar: 'bg-emerald-500', dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', chip: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300' },
  { bar: 'bg-amber-500', dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', chip: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300' },
];

export default function Recommendation({ narrative, lang = 'en' }: { narrative: string; lang?: string }) {
  const { title, sections } = useMemo(() => parse(narrative), [narrative]);
  const localized = SECTION_TITLES[lang] ?? SECTION_TITLES.en;

  if (!sections.length && !title) {
    // Fallback: render raw text if the narrative didn't match the expected shape.
    return <div className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{narrative}</div>;
  }

  return (
    <div className="space-y-3">
      {title && (
        <div className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 shadow-sm shadow-blue-600/20">
          <div className="text-[10px] font-medium uppercase tracking-wider text-blue-100/80">NZEB · Net-Zero 2050</div>
          <div className="text-[13px] font-semibold text-white leading-snug">{title}</div>
        </div>
      )}

      <div className="columns-1 sm:columns-2 sm:gap-4">
        {sections.map((s, i) => {
          const a = ACCENTS[i % ACCENTS.length];
          return (
            <section key={i} className="break-inside-avoid mb-4 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-3.5">
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-5 h-5 rounded-md ${a.chip} text-[11px] font-bold flex items-center justify-center shrink-0`}>{i + 1}</span>
                <h3 className={`text-[11px] font-bold uppercase tracking-wide ${a.text}`}>{localized[i] ?? s.title}</h3>
              </div>
              <div className="space-y-2">
                {s.blocks.map((b, j) =>
                  b.kind === 'list' ? (
                    <ul key={j} className="space-y-1">
                      {b.items.map((it, k) => {
                        const { label, rest } = splitLabel(it);
                        return (
                          <li key={k} className="flex gap-2 text-[12.5px] leading-[1.5] text-slate-600 dark:text-slate-300">
                            <span className={`mt-[6px] w-1.5 h-1.5 rounded-full shrink-0 ${a.dot}`} />
                            <span className="min-w-0">
                              {label && <span className="font-semibold text-slate-800 dark:text-slate-100">{label}: </span>}
                              {renderRest(rest)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : b.sub ? (
                    <p key={j} className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 pt-1">{b.text}</p>
                  ) : (
                    <p key={j} className="text-[12.5px] leading-[1.5] text-slate-600 dark:text-slate-300">{b.text}</p>
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
