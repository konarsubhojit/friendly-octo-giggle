import { describe, it, expect } from 'vitest'
import {
  VALID_IMAGE_TYPES,
  MAX_FILE_SIZE,
  VALID_IMAGE_TYPES_DISPLAY,
  isValidImageType,
} from '@/lib/upload-constants'

describe('upload-constants', () => {
  describe('VALID_IMAGE_TYPES', () => {
    it('includes jpeg, jpg, png, webp, gif', () => {
      expect(VALID_IMAGE_TYPES).toContain('image/jpeg')
      expect(VALID_IMAGE_TYPES).toContain('image/jpg')
      expect(VALID_IMAGE_TYPES).toContain('image/png')
      expect(VALID_IMAGE_TYPES).toContain('image/webp')
      expect(VALID_IMAGE_TYPES).toContain('image/gif')
    })

    it('has exactly 5 types', () => {
      expect(VALID_IMAGE_TYPES).toHaveLength(5)
    })
  })

  describe('MAX_FILE_SIZE', () => {
    it('equals 5MB', () => {
      expect(MAX_FILE_SIZE).toBe(5 * 1024 * 1024)
    })
  })

  describe('VALID_IMAGE_TYPES_DISPLAY', () => {
    it('is a readable string', () => {
      expect(VALID_IMAGE_TYPES_DISPLAY).toBe('JPEG, PNG, WebP, GIF')
    })
  })

  describe('isValidImageType', () => {
    it.each([
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif',
    ])('returns true for %s', (type) => {
      expect(isValidImageType(type)).toBe(true)
    })

    it.each([
      'image/svg+xml',
      'image/bmp',
      'application/pdf',
      'text/plain',
      '',
    ])('returns false for %s', (type) => {
      expect(isValidImageType(type)).toBe(false)
    })
  })
})
