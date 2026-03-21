import {
  useState,
  useEffect,
  type ChangeEvent,
  type BaseSyntheticEvent,
} from "react";
import { type Product } from "@/lib/types";
import toast from "react-hot-toast";
import { logError } from "@/lib/logger";
import {
  isValidImageType,
  MAX_FILE_SIZE,
  VALID_IMAGE_TYPES_DISPLAY,
} from "@/lib/upload-constants";
import { useCurrency, type CurrencyCode } from "@/contexts/CurrencyContext";
import { PRODUCT_ERRORS, API_ERRORS } from "@/lib/constants/error-messages";

export const MAX_IMAGES = 10;

export interface ProductFormData {
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  image: string;
  images: string[];
}

const DEFAULT_PRICE_CURRENCY: CurrencyCode = "INR";

const convertCurrency = (
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
  rates: Record<CurrencyCode, number>,
): number => {
  const amountInBase = amount / rates[from];
  return Number((amountInBase * rates[to]).toFixed(2));
};

const buildInitialFormData = (
  product: Product | null,
  rates: Record<CurrencyCode, number>,
): ProductFormData =>
  product
    ? {
        name: product.name,
        description: product.description,
        price: convertCurrency(
          product.price,
          "INR",
          DEFAULT_PRICE_CURRENCY,
          rates,
        ),
        stock: product.stock,
        category: product.category,
        image: product.image,
        images: product.images ?? [],
      }
    : {
        name: "",
        description: "",
        price: 0,
        stock: 0,
        category: "",
        image: "",
        images: [],
      };

const validateName = (v: string): string | undefined => {
  if (!v.trim()) return PRODUCT_ERRORS.NAME_REQUIRED;
  if (v.trim().length < 2) return PRODUCT_ERRORS.NAME_TOO_SHORT;
  return undefined;
};

const validateDescription = (v: string): string | undefined =>
  v.trim() ? undefined : PRODUCT_ERRORS.DESCRIPTION_REQUIRED;

const validatePrice = (v: number): string | undefined =>
  !v || v <= 0 ? PRODUCT_ERRORS.PRICE_POSITIVE : undefined;

const validateStock = (v: number): string | undefined =>
  v < 0 || !Number.isInteger(v) ? PRODUCT_ERRORS.STOCK_INVALID : undefined;

const validateCategory = (v: string): string | undefined =>
  v.trim() ? undefined : PRODUCT_ERRORS.CATEGORY_REQUIRED;

const validateImage = (
  hasExisting: boolean,
  hasFile: boolean,
): string | undefined =>
  !hasExisting && !hasFile ? PRODUCT_ERRORS.IMAGE_REQUIRED : undefined;

const validateImageFile = (file: File): string | null => {
  if (!isValidImageType(file.type)) {
    return PRODUCT_ERRORS.IMAGE_TYPE_INVALID(VALID_IMAGE_TYPES_DISPLAY);
  }
  if (file.size > MAX_FILE_SIZE) {
    return PRODUCT_ERRORS.IMAGE_SIZE_EXCEEDED(MAX_FILE_SIZE / 1024 / 1024);
  }
  return null;
};

const uploadSingleImage = async (file: File): Promise<string | null> => {
  const uploadFormData = new FormData();
  uploadFormData.append("file", file);
  const res = await fetch("/api/upload", {
    method: "POST",
    body: uploadFormData,
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to upload image");
  }
  const data = await res.json();
  return data.data.url;
};

const getApiEndpoint = (editingProduct: Product | null) =>
  editingProduct
    ? {
        url: `/api/admin/products/${editingProduct.id}`,
        method: "PUT" as const,
      }
    : { url: "/api/admin/products", method: "POST" as const };

const getSubmitButtonText = (
  uploading: boolean,
  saving: boolean,
  isEditing: boolean,
): string => {
  if (uploading) return "Uploading...";
  if (saving) return "Saving...";
  return isEditing ? "Update Product" : "Create Product";
};

const useProductForm = (
  editingProduct: Product | null,
  onClose: () => void,
  onSuccess: (product: Product) => void,
) => {
  const { availableCurrencies, rates } = useCurrency();
  const [priceCurrency, setPriceCurrency] = useState<CurrencyCode>(
    DEFAULT_PRICE_CURRENCY,
  );
  const [formData, setFormData] = useState<ProductFormData>(() =>
    buildInitialFormData(editingProduct, rates),
  );
  const [stockInput, setStockInput] = useState(
    String(editingProduct ? editingProduct.stock : 0),
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [additionalFiles, setAdditionalFiles] = useState<(File | null)[]>(() =>
    new Array((editingProduct?.images ?? []).length).fill(null),
  );
  const [slotIds, setSlotIds] = useState<string[]>(() =>
    (editingProduct?.images ?? []).map(() => crypto.randomUUID()),
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof ProductFormData, string>>
  >({});
  const [categoryList, setCategoryList] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((json) => {
        const items: { name: string }[] = json.data ?? [];
        setCategoryList(items.map((c) => c.name));
      })
      .catch(() => {});
  }, []);

  const totalImages =
    (formData.image || imageFile ? 1 : 0) + formData.images.length;

  const validate = (): boolean => {
    const errors: Partial<Record<keyof ProductFormData, string>> = {
      name: validateName(formData.name),
      description: validateDescription(formData.description),
      price: validatePrice(formData.price),
      stock: validateStock(formData.stock),
      category: validateCategory(formData.category),
      image: editingProduct
        ? undefined
        : validateImage(Boolean(formData.image), Boolean(imageFile)),
    };
    const filtered = Object.fromEntries(
      Object.entries(errors).filter(([, v]) => v !== undefined),
    ) as Partial<Record<keyof ProductFormData, string>>;
    setFieldErrors(filtered);
    return Object.keys(filtered).length === 0;
  };

  const clearFieldError = (field: keyof ProductFormData) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handlePriceCurrencyChange = (newCurrency: CurrencyCode) => {
    setFormData({
      ...formData,
      price: convertCurrency(formData.price, priceCurrency, newCurrency, rates),
    });
    setPriceCurrency(newCurrency);
  };

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateImageFile(file);
    if (err) {
      setFieldErrors((prev) => ({ ...prev, image: err }));
      return;
    }
    setFieldErrors((prev) => ({ ...prev, image: undefined }));
    setImageFile(file);
  };

  const handleAdditionalImageChange = (
    idx: number,
    e: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateImageFile(file);
    if (err) {
      toast.error(err);
      return;
    }
    const newFiles = [...additionalFiles];
    newFiles[idx] = file;
    setAdditionalFiles(newFiles);
  };

  const addImageSlot = () => {
    if (totalImages >= MAX_IMAGES) {
      toast.error(`Maximum ${MAX_IMAGES} images allowed`);
      return;
    }
    setFormData((prev) => ({ ...prev, images: [...prev.images, ""] }));
    setAdditionalFiles((prev) => [...prev, null]);
    setSlotIds((prev) => [...prev, crypto.randomUUID()]);
  };

  const removeAdditionalImage = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== idx),
    }));
    setAdditionalFiles((prev) => prev.filter((_, i) => i !== idx));
    setSlotIds((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleStockChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setStockInput(raw);
    if (raw === "") {
      setFormData({ ...formData, stock: 0 });
      clearFieldError("stock");
      return;
    }
    const value = Number.parseInt(raw, 10);
    if (!Number.isNaN(value) && value >= 0) {
      setFormData({ ...formData, stock: value });
      clearFieldError("stock");
    }
  };

  const resolveImageUrl = async (): Promise<string | null> => {
    if (imageFile) {
      setUploading(true);
      try {
        return await uploadSingleImage(imageFile);
      } catch (err) {
        logError({ error: err, context: "resolveImageUrl" });
        toast.error(API_ERRORS.IMAGE_UPLOAD);
        return null;
      } finally {
        setUploading(false);
      }
    }
    if (!formData.image) {
      setFieldErrors((prev) => ({
        ...prev,
        image: PRODUCT_ERRORS.IMAGE_REQUIRED,
      }));
      return null;
    }
    return formData.image;
  };

  const uploadAdditionalImages = async (): Promise<string[]> => {
    const additionalUrls: string[] = [];
    for (let index = 0; index < formData.images.length; index++) {
      const file = additionalFiles[index];
      if (file) {
        setUploading(true);
        try {
          const url = await uploadSingleImage(file);
          if (url) additionalUrls.push(url);
        } catch (err) {
          logError({ error: err, context: "uploadAdditionalImages" });
          toast.error("Failed to upload one or more additional images");
        } finally {
          setUploading(false);
        }
      } else if (formData.images[index]) {
        additionalUrls.push(formData.images[index]);
      }
    }
    return additionalUrls;
  };

  const saveProductToApi = async (
    imageUrl: string,
    additionalImages: string[],
  ) => {
    const productData = {
      ...formData,
      price: convertCurrency(formData.price, priceCurrency, "INR", rates),
      image: imageUrl,
      images: additionalImages,
    };
    const { url, method } = getApiEndpoint(editingProduct);
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(productData),
    });
    if (!res.ok) {
      const errorBody = await res.json();
      throw new Error(
        (errorBody as { error?: string }).error ?? "Failed to save product",
      );
    }
    const saved = (await res.json()) as {
      data?: { product?: Product };
      product?: Product;
    };
    return (
      saved.data?.product ?? saved.product ?? (saved as unknown as Product)
    );
  };

  const handleSubmit = async (e: BaseSyntheticEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const primaryUrl = await resolveImageUrl();
      if (!primaryUrl) {
        return;
      }
      const additionalUrls = await uploadAdditionalImages();
      const savedProduct = await saveProductToApi(primaryUrl, additionalUrls);
      toast.success(
        editingProduct
          ? "Product updated successfully"
          : "Product created successfully",
      );
      onSuccess(savedProduct);
      onClose();
    } catch (err) {
      logError({ error: err, context: "handleSubmit" });
      toast.error(API_ERRORS.PRODUCT_SAVE);
    } finally {
      setSaving(false);
    }
  };

  return {
    formData,
    setFormData,
    stockInput,
    imageFile,
    additionalFiles,
    slotIds,
    uploading,
    saving,
    fieldErrors,
    categoryList,
    priceCurrency,
    availableCurrencies,
    totalImages,
    submitButtonText: getSubmitButtonText(
      uploading,
      saving,
      Boolean(editingProduct),
    ),
    clearFieldError,
    handlePriceCurrencyChange,
    handleImageChange,
    handleAdditionalImageChange,
    addImageSlot,
    removeAdditionalImage,
    handleStockChange,
    handleSubmit,
  };
};

export default useProductForm;
