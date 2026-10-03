import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ItemImageUploader from './ItemImageUploader.jsx';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function choose(files) {
  const input = screen.getByLabelText('Choose item photos');
  Object.defineProperty(input, 'files', { configurable: true, value: files });
  fireEvent.change(input);
}

describe('ItemImageUploader', () => {
  it('previews valid selected images and removes a selected image', () => {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:preview') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    const onFilesChange = vi.fn();
    const file = new File(['jpeg-data'], 'bag.jpg', { type: 'image/jpeg' });
    const { rerender } = render(<ItemImageUploader files={[]} onFilesChange={onFilesChange} />);
    choose([file]);
    expect(onFilesChange).toHaveBeenCalledWith([file]);
    rerender(<ItemImageUploader files={[file]} onFilesChange={onFilesChange} />);
    expect(screen.getByAltText('Selected bag.jpg')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove bag.jpg' }));
    expect(onFilesChange).toHaveBeenLastCalledWith([]);
  });

  it('rejects unsupported types and files larger than 5 MB', () => {
    const onFilesChange = vi.fn();
    render(<ItemImageUploader files={[]} onFilesChange={onFilesChange} />);
    choose([new File(['data'], 'notes.pdf', { type: 'application/pdf' })]);
    expect(screen.getByRole('alert').textContent).toContain('JPEG, PNG, or WebP');
    choose([new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' })]);
    expect(screen.getByRole('alert').textContent).toContain('5 MB or smaller');
    expect(onFilesChange).not.toHaveBeenCalled();
  });

  it('does not accept more than five images in total', () => {
    const onFilesChange = vi.fn();
    const selected = Array.from({ length: 5 }, (_, index) => new File(['data'], `${index}.webp`, { type: 'image/webp' }));
    const { rerender } = render(<ItemImageUploader files={[]} onFilesChange={onFilesChange} />);
    choose(selected);
    expect(onFilesChange).toHaveBeenCalledWith(selected);
    onFilesChange.mockClear();
    rerender(<ItemImageUploader files={selected} onFilesChange={onFilesChange} />);
    choose([new File(['data'], 'sixth.webp', { type: 'image/webp' })]);
    expect(screen.getByRole('alert').textContent).toContain('no more than 5');
    expect(onFilesChange).not.toHaveBeenCalled();
  });

  it('stages removal of an existing image and supports undo before submission', () => {
    const onRemovedImageIdsChange = vi.fn();
    const image = { url: 'https://example.test/photo.webp', publicId: 'campusfind/items/photo' };
    const props = { existingImages: [image], files: [], onFilesChange: vi.fn(), removedImageIds: [], onRemovedImageIdsChange };
    const { rerender } = render(<ItemImageUploader {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove existing image' }));
    expect(onRemovedImageIdsChange).toHaveBeenCalledWith(['campusfind/items/photo']);
    rerender(<ItemImageUploader {...props} removedImageIds={['campusfind/items/photo']} />);
    fireEvent.click(screen.getByRole('button', { name: 'Undo remove' }));
    expect(onRemovedImageIdsChange).toHaveBeenLastCalledWith([]);
  });
});
