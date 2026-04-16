// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { UserAvatar } from '@/features/admin/components/UserAvatar'

vi.mock('next/image', () => ({
  default: ({
    alt,
    src,
    width,
    height,
  }: {
    alt: string
    src: string
    width: number
    height: number
  }) => <img alt={alt} src={src} width={width} height={height} />,
}))

describe('UserAvatar', () => {
  it('renders image when image URL is provided', () => {
    render(
      <UserAvatar
        name="John Doe"
        email="john@example.com"
        image="https://example.com/avatar.jpg"
      />
    )

    const img = screen.getByAltText('John Doe')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg')
    expect(img).toHaveAttribute('width', '40')
    expect(img).toHaveAttribute('height', '40')
  })

  it('uses "User" as alt text when name is null', () => {
    render(
      <UserAvatar
        name={null}
        email="user@example.com"
        image="https://example.com/avatar.jpg"
      />
    )

    const img = screen.getByAltText('User')
    expect(img).toBeInTheDocument()
  })

  it('renders initial from name when no image is provided', () => {
    render(
      <UserAvatar name="Alice Smith" email="alice@example.com" image={null} />
    )

    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('renders initial from email when name is null', () => {
    render(<UserAvatar name={null} email="bob@example.com" image={null} />)

    expect(screen.getByText('B')).toBeInTheDocument()
  })

  it('uppercases email initial', () => {
    render(<UserAvatar name={null} email="test@example.com" image={null} />)

    expect(screen.getByText('T')).toBeInTheDocument()
  })

  it('handles empty name string by using email initial', () => {
    render(<UserAvatar name="" email="charlie@example.com" image={null} />)

    expect(screen.getByText('C')).toBeInTheDocument()
  })
})
