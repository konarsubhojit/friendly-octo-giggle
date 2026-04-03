interface CartGlyphProps {
  readonly className?: string
}

const cartMaskStyles = {
  backgroundColor: 'currentColor',
  maskImage: "url('/cart.svg')",
  maskPosition: 'center',
  maskRepeat: 'no-repeat',
  maskSize: '180% auto',
  WebkitMaskImage: "url('/cart.svg')",
  WebkitMaskPosition: 'center',
  WebkitMaskRepeat: 'no-repeat',
  WebkitMaskSize: '180% auto',
} as const

export default function CartGlyph({
  className = 'inline-block h-6 w-6 shrink-0',
}: CartGlyphProps) {
  return (
    <span aria-hidden="true" className={className} style={cartMaskStyles} />
  )
}
