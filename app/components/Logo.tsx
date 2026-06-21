'use client';

/**
 * liênnhã. brand logo, recreated as SVG in a blue→indigo palette.
 * - variant="mark": the squircle badge only (header / favicon).
 * - variant="full": badge + "liênnhã." serif wordmark.
 *
 * To use the exact original artwork instead, drop the file at public/logo.png
 * and set `src` on the <Logo> usages (see app/page.tsx header comment).
 */
export function LogoMark({ size = 40 }: { size?: number }) {
  const id = 'lnGrad';
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-label="liênnhã.">
      <defs>
        <linearGradient id={id} x1="50" y1="6" x2="50" y2="94" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3b82f6" />
          <stop offset="0.55" stopColor="#4f6bf0" />
          <stop offset="1" stopColor="#4f46e5" />
        </linearGradient>
      </defs>
      {/* squircle badge */}
      <path
        d="M30 8 H70 C82 8 92 18 92 32 V68 C92 82 82 92 68 92 H32 C18 92 8 82 8 68 V30 C8 18 18 8 30 8 Z"
        fill={`url(#${id})`}
      />
      {/* stacked brand initials, clean monoline white */}
      <text x="50" y="46" textAnchor="middle" fontFamily="'Segoe UI', system-ui, sans-serif"
        fontSize="27" fontWeight="700" fill="#ffffff" letterSpacing="-1">Liên</text>
      <text x="50" y="74" textAnchor="middle" fontFamily="'Segoe UI', system-ui, sans-serif"
        fontSize="27" fontWeight="700" fill="#ffffff" letterSpacing="-1">Nhã</text>
    </svg>
  );
}

export default function Logo({ size = 40, showWordmark = true }: { size?: number; showWordmark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      {showWordmark && (
        <span
          className="font-semibold tracking-tight text-slate-900"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: size * 0.55 }}
        >
          liênnhã<span className="text-blue-600">.</span>
        </span>
      )}
    </span>
  );
}
