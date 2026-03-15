import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

describe('ConfirmDialog', () => {
  const baseProps = {
    isOpen: true,
    title: 'Are you sure?',
    message: 'This action cannot be undone.',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<ConfirmDialog {...baseProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders title and message when open', () => {
    render(<ConfirmDialog {...baseProps} />);
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
  });

  it('renders default confirm and cancel labels', () => {
    render(<ConfirmDialog {...baseProps} />);
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('renders custom confirm and cancel labels', () => {
    render(
      <ConfirmDialog
        {...baseProps}
        confirmLabel="Yes, delete"
        cancelLabel="No, keep it"
      />,
    );
    expect(screen.getByRole('button', { name: 'Yes, delete' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No, keep it' })).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button is clicked', () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...baseProps} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...baseProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when backdrop is clicked', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...baseProps} onCancel={onCancel} />);
    // The backdrop is the div with aria-hidden="true"
    const backdrop = document.querySelector('[aria-hidden="true"]');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop as Element);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('disables both buttons when loading', () => {
    render(<ConfirmDialog {...baseProps} loading />);
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  it('does not call onCancel when backdrop clicked while loading', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...baseProps} onCancel={onCancel} loading />);
    const backdrop = document.querySelector('[aria-hidden="true"]');
    fireEvent.click(backdrop as Element);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('uses danger variant styles by default when variant=danger', () => {
    render(<ConfirmDialog {...baseProps} variant="danger" />);
    // Confirm button should have red styling
    const confirmBtn = screen.getByRole('button', { name: 'Confirm' });
    expect(confirmBtn.className).toContain('bg-red-600');
  });

  it('uses warning variant styles when variant=warning', () => {
    render(<ConfirmDialog {...baseProps} variant="warning" />);
    const confirmBtn = screen.getByRole('button', { name: 'Confirm' });
    expect(confirmBtn.className).toContain('bg-yellow-600');
  });

  it('uses info variant styles when variant=info', () => {
    render(<ConfirmDialog {...baseProps} variant="info" />);
    const confirmBtn = screen.getByRole('button', { name: 'Confirm' });
    expect(confirmBtn.className).toContain('bg-blue-600');
  });

  it('has accessible dialog role and labelled by unique title id', () => {
    render(<ConfirmDialog {...baseProps} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    // The aria-labelledby must exist and point to the visible title element
    const labelId = dialog.getAttribute('aria-labelledby');
    expect(labelId).toBeTruthy();
    expect(document.getElementById(labelId!)).toHaveTextContent('Are you sure?');
  });

  it('uses unique IDs when two dialogs are rendered simultaneously', () => {
    const { container: c1 } = render(<ConfirmDialog {...baseProps} title="Dialog A" />);
    const { container: c2 } = render(<ConfirmDialog {...baseProps} title="Dialog B" />);

    const dialog1 = c1.querySelector('[role="dialog"]')!;
    const dialog2 = c2.querySelector('[role="dialog"]')!;

    const labelId1 = dialog1.getAttribute('aria-labelledby');
    const labelId2 = dialog2.getAttribute('aria-labelledby');

    expect(labelId1).toBeTruthy();
    expect(labelId2).toBeTruthy();
    // IDs must differ to avoid duplicate-ID violations
    expect(labelId1).not.toBe(labelId2);
  });

  it('shows loading spinner inside confirm button when loading', () => {
    render(<ConfirmDialog {...baseProps} loading />);
    const confirmBtn = screen.getByRole('button', { name: 'Confirm' });
    // There should be an svg spinner
    expect(confirmBtn.querySelector('svg')).not.toBeNull();
  });

  it('calls onCancel when Escape is pressed', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...baseProps} onCancel={onCancel} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('does not call onCancel on Escape when loading', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...baseProps} onCancel={onCancel} loading />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('wraps Tab from last focusable element back to first', () => {
    render(<ConfirmDialog {...baseProps} />);
    const dialog = screen.getByRole('dialog');
    const focusable = dialog.querySelectorAll('button:not([disabled])');
    const last = focusable[focusable.length - 1] as HTMLElement;

    // Focus the last button then Tab
    last.focus();
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: false });
    // After wrapping, focus should be on the first focusable element
    expect(document.activeElement).toBe(focusable[0]);
  });

  it('wraps Shift+Tab from first focusable element back to last', () => {
    render(<ConfirmDialog {...baseProps} />);
    const dialog = screen.getByRole('dialog');
    const focusable = dialog.querySelectorAll('button:not([disabled])');
    const first = focusable[0] as HTMLElement;
    const last = focusable[focusable.length - 1] as HTMLElement;

    // Focus the first button then Shift+Tab
    first.focus();
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });
});
