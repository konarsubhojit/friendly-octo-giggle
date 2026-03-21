"use client";

import { useRouter } from "next/navigation";
import type { Product } from "@/lib/types";
import ProductFormModal from "@/components/admin/ProductFormModal";

interface ProductEditPageFormProps {
  readonly product: Product;
}

const ProductEditPageForm = ({ product }: ProductEditPageFormProps) => {
  const router = useRouter();

  const handleCancel = () => {
    router.push(`/admin/products/${product.id}`);
  };

  const handleSuccess = (savedProduct: Product) => {
    router.push(`/admin/products/${savedProduct.id}`);
    router.refresh();
  };

  return (
    <ProductFormModal
      editingProduct={product}
      layout="page"
      onClose={handleCancel}
      onSuccess={handleSuccess}
    />
  );
};
export default ProductEditPageForm;
