import type { Product } from "@/lib/types";

const MAX_DESC_CHARS = 400;

const truncate = (text: string, max = MAX_DESC_CHARS): string =>
  text.length <= max ? text : text.slice(0, max - 1) + "…";

export const buildProductContext = (product: Product): string => {
  const lines: string[] = [
    `Name: ${product.name}`,
    `Category: ${product.category}`,
    `Description: ${truncate(product.description)}`,
    `Price: $${product.price.toFixed(2)}`,
    `Stock: ${product.stock > 0 ? `${product.stock} units` : "Out of stock"}`,
  ];

  if (product.variations?.length) {
    lines.push(`Variations (${product.variations.length}):`);
    for (const v of product.variations) {
      const modifier =
        v.priceModifier === 0
          ? ""
          : ` (${v.priceModifier > 0 ? "+" : ""}$${v.priceModifier.toFixed(2)})`;
      const stock = v.stock > 0 ? `${v.stock} in stock` : "out of stock";
      lines.push(`- ${v.name} / ${v.designName}: ${stock}${modifier}`);
    }
  }

  return lines.join("\n");
};

export const trimHistory = <T extends { role: string }>(
  messages: T[],
  maxMessages: number,
): T[] => {
  if (messages.length <= maxMessages) return messages;
  return messages.slice(-maxMessages);
};
