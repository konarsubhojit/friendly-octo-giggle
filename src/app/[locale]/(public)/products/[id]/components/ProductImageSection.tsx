import { ButterflyAccent } from '@/components/ui/DecorativeElements'
import ImageCarousel from '@/features/product/components/ImageCarousel'

interface ProductImageSectionProps {
  readonly images: string[]
  readonly productName: string
}

export const ProductImageSection = ({
  images,
  productName,
}: ProductImageSectionProps) => (
  <div className="relative">
    <ImageCarousel images={images} productName={productName} />
    <ButterflyAccent className="absolute -top-4 -left-4 w-10 h-10 opacity-30 hidden sm:block animate-float-gentle" />
  </div>
)
