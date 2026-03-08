import { randomBytes } from "node:crypto";

const BASE62_CHARS =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const SHORT_ID_LENGTH = 7;

/**
 * Generates a cryptographically random base62 short ID (7 chars).
 * 62^7 ≈ 3.5 trillion possible values — collision-safe for product/order scale.
 */
export const generateShortId = (): string => {
  const limit = 248; // largest multiple of 62 that fits in a byte (62 * 4)
  let result = "";
  while (result.length < SHORT_ID_LENGTH) {
    const bytes = randomBytes(SHORT_ID_LENGTH - result.length);
    for (let i = 0; i < bytes.length && result.length < SHORT_ID_LENGTH; i++) {
      if (bytes[i] < limit) {
        result += BASE62_CHARS[bytes[i] % 62];
      }
    }
  }
  return result;
};
