'use client';

/**
 * liênnhã. brand logo. Uses the real artwork at public/logo-mark.png
 * (background removed, transparent) for the badge, paired with the
 * "liênnhã." serif wordmark.
 */
export function LogoMark({ size = 40 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src="/logo-mark.png"
      alt="liênnhã."
      width={size}
      height={size}
      style={{ display: 'block', width: size, height: size, objectFit: 'contain' }}
    />
  );
}

export default function Logo({ size = 40, showWordmark = true }: { size?: number; showWordmark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark size={size} />
      {showWordmark && (
        <span
          className="font-semibold tracking-tight text-slate-900 dark:text-white"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: size * 0.55 }}
        >
          liênnhã<span className="text-blue-600 dark:text-blue-400">.</span>
        </span>
      )}
    </span>
  );
}
