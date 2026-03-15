import Link from 'next/link';

const CTA_BTN =
  'inline-block bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:from-blue-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg';

interface CtaButtonProps {
  readonly text: string;
  readonly href?: string;
  readonly onClick?: () => void;
}

export function CtaButton({ text, href, onClick }: CtaButtonProps) {
  if (href) {
    return <Link href={href} className={CTA_BTN}>{text}</Link>;
  }
  if (onClick) {
    return <button type="button" onClick={onClick} className={CTA_BTN}>{text}</button>;
  }
  return null;
}
