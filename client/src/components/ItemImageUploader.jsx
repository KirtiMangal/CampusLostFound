import { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';

const MAX_FILES = 5;
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export default function ItemImageUploader({ existingImages = [], files = [], onFilesChange, removedImageIds = [], onRemovedImageIdsChange, disabled = false }) {
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);
  const activeImages = existingImages.filter((image) => !removedImageIds.includes(image.publicId));

  useEffect(() => () => previews.forEach(({ url }) => URL.revokeObjectURL(url)), [previews]);

  function selectFiles(event) {
    const selected = [...event.target.files];
    event.target.value = '';
    if (!selected.length) return;
    const next = [...files];
    for (const file of selected) {
      if (!ALLOWED_TYPES.has(file.type)) { setError(`${file.name}: choose a JPEG, PNG, or WebP image.`); return; }
      if (file.size > MAX_BYTES) { setError(`${file.name}: each image must be 5 MB or smaller.`); return; }
      if (activeImages.length + next.length >= MAX_FILES) { setError('An item can have no more than 5 images.'); return; }
      next.push(file);
    }
    setError('');
    onFilesChange(next);
  }

  function removeExisting(image) {
    if (!image.publicId) return;
    onRemovedImageIdsChange([...removedImageIds, image.publicId]);
    setError('');
  }

  return <section className="image-upload-section" aria-label="Item photos">
    <div className="image-upload-heading"><div><h2>Item photos</h2><p>JPEG, PNG, or WebP · up to 5 MB each · {activeImages.length + files.length}/5 selected</p></div>
      <button className="button button-secondary image-select-button" type="button" onClick={() => inputRef.current?.click()} disabled={disabled || activeImages.length + files.length >= MAX_FILES}><ImagePlus size={15} /> Add photos</button>
      <input ref={inputRef} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={selectFiles} disabled={disabled} aria-label="Choose item photos" />
    </div>
    {error && <p className="image-upload-error" role="alert">{error}</p>}
    {(existingImages.length > 0 || previews.length > 0) ? <>
      {existingImages.length > 0 && <div className="image-preview-group"><h3>Existing images</h3><div className="image-preview-grid">
        {existingImages.map((image) => {
          const removed = removedImageIds.includes(image.publicId);
          return <div className={`image-preview${removed ? ' image-preview-removed' : ''}`} key={image.publicId || image.url}>
            <img src={image.url} alt="Existing item" onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }} />
            {removed ? <button type="button" className="image-restore-button" onClick={() => onRemovedImageIdsChange(removedImageIds.filter((id) => id !== image.publicId))} disabled={disabled}>Undo remove</button>
              : image.publicId && <button type="button" className="image-remove-button" aria-label="Remove existing image" title="Remove image" onClick={() => removeExisting(image)} disabled={disabled}><X size={14} /></button>}
          </div>;
        })}
      </div></div>}
      {previews.length > 0 && <div className="image-preview-group"><h3>New images</h3><div className="image-preview-grid">
        {previews.map(({ file, url }, index) => <div className="image-preview" key={`${file.name}-${file.lastModified}-${index}`}><img src={url} alt={`Selected ${file.name}`} /><button type="button" className="image-remove-button" aria-label={`Remove ${file.name}`} title="Remove image" onClick={() => onFilesChange(files.filter((_, fileIndex) => fileIndex !== index))} disabled={disabled}><X size={14} /></button><span className="image-preview-name">{file.name}</span></div>)}
      </div></div>}
    </> : <div className="image-upload-empty">No photos selected. Clear photos can help identify the item.</div>}
  </section>;
}
