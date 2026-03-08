import { randomBytes } from "node:crypto";

const BASE62_CHARS =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const SHORT_ID_LENGTH = 7;

/**
 * Generates a cryptographically random base62 short ID (7 chars).
 * 62^7 ≈ 3.5 trillion possible values — collision-safe for product/order scale.
 */
export function generateShortId(): string {
  const bytes = randomBytes(SHORT_ID_LENGTH);
  let result = "";
  for (let i = 0; i < SHORT_ID_LENGTH; i++) {
    result += BASE62_CHARS[bytes[i] % 62];
  }
  return result;
}
