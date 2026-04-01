// Shared constants for file upload validation
export const VALID_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export const VALID_IMAGE_TYPES_DISPLAY = "JPEG, PNG, WebP, GIF";

export const isValidImageType = (type: string): boolean =>
  VALID_IMAGE_TYPES.includes(type);
