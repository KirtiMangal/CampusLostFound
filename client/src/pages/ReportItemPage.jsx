import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import ItemFormFields from '../components/ItemFormFields.jsx';
import ItemImageUploader from '../components/ItemImageUploader.jsx';
import AiDescriptionAssistant from '../components/AiDescriptionAssistant.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { reportSchema } from '../schemas/itemSchemas.js';
import { itemApi } from '../services/api.js';

export default function ReportItemPage({ type }) {
  const isLost = type === 'lost';
  const navigate = useNavigate();
  const toast = useToast();
  const [images, setImages] = useState([]);
  const { register, handleSubmit, getValues, setValue, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(reportSchema(type)),
    defaultValues: { type },
    mode: 'onBlur',
  });

  async function submit(values) {
    try {
      const { item } = await itemApi.create(values, images);
      toast(isLost ? 'Your lost item report is posted.' : 'Thank you for reporting a found item.');
      navigate(`/items/${item.id}`, { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || 'We couldn’t save your report. Please try again.');
    }
  }

  return <section className="auth-wrap item-form-wrap"><div className="auth-card auth-card-wide">
    <Link className="auth-back" to="/items"><ArrowLeft size={14} /> Back to browse</Link>
    <div className="eyebrow">YOUR CAMPUS COMMUNITY IS HERE</div>
    <h1>{isLost ? 'Report a lost' : 'Report a found'} <span className="serif-accent">item.</span></h1>
    <p className="auth-intro">{isLost ? 'Share what you remember so your campus community can help.' : 'A few details can help return someone’s belongings.'}</p>
    <form className="auth-form item-form" onSubmit={handleSubmit(submit)} noValidate>
      <ItemFormFields register={register} errors={errors} type={type} dateLabel={isLost ? 'Date lost' : 'Date found'} descriptionAssistant={<AiDescriptionAssistant type={type} getValues={getValues} setValue={setValue} />} />
      <ItemImageUploader files={images} onFilesChange={setImages} disabled={isSubmitting} />
      <button className="button button-primary auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving report…' : 'Post report'} {!isSubmitting && <ArrowUpRight size={16} />}</button>
    </form>
  </div></section>;
}
