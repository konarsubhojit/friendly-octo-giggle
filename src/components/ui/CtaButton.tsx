import Link from "next/link";

const CTA_BTN =
  "inline-block bg-gradient-to-r from-[var(--accent-warm)] to-[var(--accent-rose)] text-white px-6 py-2.5 rounded-full font-bold text-sm hover:from-[var(--accent-rose)] hover:to-[var(--accent-warm)] transition-all shadow-warm hover:shadow-warm-lg hover:scale-105 focus-warm";

interface CtaButtonProps {
  readonly text: string;
  readonly href?: string;
  readonly onClick?: () => void;
}

export function CtaButton({ text, href, onClick }: CtaButtonProps) {
  if (href) {
    return (
      <Link href={href} className={CTA_BTN}>
        {text}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={CTA_BTN}>
        {text}
      </button>
    );
  }
  return null;
}
