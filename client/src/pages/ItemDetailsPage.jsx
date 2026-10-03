import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Flag, MapPin, Pencil, Trash2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import ItemFormFields from '../components/ItemFormFields.jsx';
import ItemImageUploader from '../components/ItemImageUploader.jsx';
import PotentialMatches from '../components/PotentialMatches.jsx';
import ClaimForm from '../components/ClaimForm.jsx';
import ClaimReview from '../components/ClaimReview.jsx';
import ReportDialog from '../components/ReportDialog.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { editItemSchema } from '../schemas/itemSchemas.js';
import { itemApi } from '../services/api.js';

function readableDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function ItemDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [newImages, setNewImages] = useState([]);
  const [removedImages, setRemovedImages] = useState([]);
  const [activeImage, setActiveImage] = useState(0);
  const [failedImages, setFailedImages] = useState([]);
  const [reportOpen, setReportOpen] = useState(false);
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(editItemSchema), mode: 'onBlur' });
  const editingType = watch('type');

  useEffect(() => {
    let current = true;
    itemApi.get(id).then(({ item: result }) => {
      if (current) setItem(result);
    }).catch((error) => {
      if (current) toast.error(error.response?.data?.message || 'This report could not be loaded.');
    }).finally(() => {
      if (current) setLoading(false);
    });
    return () => { current = false; };
  }, [id, toast]);

  if (loading) return <div className="auth-loading" role="status">Loading item report…</div>;
  if (!item) return <section className="items-empty detail-missing"><h1>We couldn’t find that report.</h1><Link className="button button-primary" to="/items">Browse reports</Link></section>;

  const canManage = user.role === 'admin' || user.id === item.owner?.id;
  const canClaim = item.type === 'found' && item.status === 'active' && user.id !== item.owner?.id;

  function startEditing() {
    reset({ ...item, date: item.date });
    setNewImages([]);
    setRemovedImages([]);
    setEditing(true);
  }

  async function saveChanges(values) {
    try {
      const { item: updated } = await itemApi.update(id, values, newImages, removedImages);
      setItem(updated);
      setNewImages([]);
      setRemovedImages([]);
      setActiveImage(0);
      setEditing(false);
      toast('Your report has been updated.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'The report could not be updated.');
    }
  }

  async function deleteReport() {
    if (!window.confirm('Delete this item report? This cannot be undone.')) return;
    try {
      await itemApi.delete(id);
      toast('Your item report has been deleted.');
      navigate('/items', { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || 'The report could not be deleted.');
    }
  }

  return <section className="item-detail-page">
    <Link className="auth-back" to="/items"><ArrowLeft size={14} /> Back to reports</Link>
    <article className="item-detail-card">
      <div className="item-detail-top"><span className={`type-badge type-${item.type}`}>{item.type} item</span><span className={`status-badge status-${item.status}`}>{item.status}</span></div>
      {editing ? <>
        <h1>Edit report</h1>
        <form className="auth-form item-form" onSubmit={handleSubmit(saveChanges)} noValidate>
          <ItemFormFields register={register} errors={errors} type={item.type} dateLabel={(editingType || item.type) === 'lost' ? 'Date lost' : 'Date found'} includeStatus allowTypeChange />
          <ItemImageUploader existingImages={item.images || []} files={newImages} onFilesChange={setNewImages} removedImageIds={removedImages} onRemovedImageIdsChange={setRemovedImages} disabled={isSubmitting} />
          <div className="detail-actions"><button className="button button-primary" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Save changes'}</button><button className="button button-secondary" type="button" onClick={() => setEditing(false)}>Cancel</button></div>
        </form>
      </> : <>
        <h1>{item.title}</h1><p className="item-detail-description">{item.description}</p>
        <ItemGallery images={item.images || []} activeImage={activeImage} setActiveImage={setActiveImage} failedImages={failedImages} setFailedImages={setFailedImages} />
        <dl className="item-detail-facts">
          <div><dt>Category</dt><dd>{item.category}</dd></div>
          <div><dt>Campus location</dt><dd><MapPin size={14} /> {item.location}</dd></div>
          <div><dt>{item.type === 'lost' ? 'Date lost' : 'Date found'}</dt><dd>{readableDate(item.date)}</dd></div>
          <div><dt>Reported by</dt><dd>{item.owner?.name || 'Campus member'}</dd></div>
          <div><dt>Report created</dt><dd>{new Date(item.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</dd></div>
        </dl>
        {canManage && <div className="detail-actions"><button className="button button-primary" onClick={startEditing}><Pencil size={14} /> Edit report</button><button className="button button-danger" onClick={deleteReport}><Trash2 size={14} /> Delete report</button></div>}
        <Link className="text-link detail-browse-link" to="/items">Explore more reports <ArrowUpRight size={14} /></Link>
      </>}
    </article>
    {!editing && <PotentialMatches itemId={id} enabled={canManage && item.status === 'active'} />}
    {!editing && item.type === 'found' && canManage && <ClaimReview itemId={id} allowReport={user.role !== 'admin'} itemHidden={item.isHidden} onApproved={() => setItem((current) => ({ ...current, status: 'resolved' }))} />}
    {!editing && canClaim && <ClaimForm itemId={id} />}
    {!editing && !canManage && <button className="button button-secondary item-report-action" onClick={() => setReportOpen(true)}><Flag size={15} /> Report this item</button>}
    {item.isHidden && canManage && <p className="moderation-hidden-notice" role="status">This report is hidden from other campus members while it is reviewed.</p>}
    {reportOpen && <ReportDialog targetType="item" targetId={id} onClose={() => setReportOpen(false)} />}
  </section>;
}

function ItemGallery({ images, activeImage, setActiveImage, failedImages, setFailedImages }) {
  const current = images[activeImage];
  return <section className="item-gallery" aria-label="Item photos">
    {current && !failedImages.includes(current.url) ? <img className="item-gallery-main" src={current.url} alt="Uploaded item" onError={() => setFailedImages((items) => [...items, current.url])} />
      : <div className="item-gallery-empty">{images.length ? 'This photo is unavailable.' : 'No photos were added to this report.'}</div>}
    {images.length > 1 && <div className="item-gallery-thumbnails" aria-label="Choose a photo">{images.map((image, index) => <button type="button" key={`${image.publicId || image.url}-${index}`} className={index === activeImage ? 'active' : ''} onClick={() => setActiveImage(index)} aria-label={`Show photo ${index + 1}`}>
      {!failedImages.includes(image.url) && <img src={image.url} alt="" onError={() => setFailedImages((items) => [...items, image.url])} />}
    </button>)}</div>}
  </section>;
}
