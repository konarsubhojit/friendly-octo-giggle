import { randomBytes } from "node:crypto";

const BASE62_CHARS =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const SHORT_ID_LENGTH = 7;

export const generateShortId = (): string => {
  const limit = 248;
  let result = "";
  while (result.length < SHORT_ID_LENGTH) {
    const bytes = randomBytes(SHORT_ID_LENGTH - result.length);
    for (let index = 0; index < bytes.length && result.length < SHORT_ID_LENGTH; index++) {
      if (bytes[index] < limit) {
        result += BASE62_CHARS[bytes[index] % 62];
      }
    }
  }
  return result;
};

export const generateOrderId = (): string => `ORD${generateShortId()}`;
