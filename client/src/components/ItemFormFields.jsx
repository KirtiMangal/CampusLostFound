import { forwardRef } from 'react';
import { ITEM_CATEGORIES } from '../../../shared/itemConstants.js';
import FormField from './FormField.jsx';

const SelectField = forwardRef(function SelectField({ id, label, error, children, ...props }, ref) {
  return <div className="form-field">
    <label htmlFor={id}>{label}</label>
    <select ref={ref} id={id} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} {...props}>{children}</select>
    {error && <span className="field-error" id={`${id}-error`}>{error}</span>}
  </div>;
});

function DescriptionField({ register, error, assistant }) {
  return <div className="form-field">
    <label htmlFor="item-description">Description</label>
    <textarea id="item-description" rows="4" placeholder="Add details such as color, brand, or identifying features" aria-invalid={Boolean(error)} aria-describedby={error ? 'item-description-error' : undefined} {...register('description')} />
    {error && <span className="field-error" id="item-description-error">{error}</span>}
    {assistant}
  </div>;
}

export default function ItemFormFields({ register, errors, type, dateLabel, includeStatus = false, allowTypeChange = false, descriptionAssistant }) {
  return <>
    <FormField id="item-title" label="Item title" type="text" maxLength={120} placeholder="A short name for the item" error={errors.title?.message} {...register('title')} />
    <DescriptionField register={register} error={errors.description?.message} assistant={descriptionAssistant} />
    <div className="form-grid-two">
      <SelectField id="item-category" label="Category" error={errors.category?.message} {...register('category')}>
        <option value="">Select a category</option>
        {ITEM_CATEGORIES.map((category) => <option value={category} key={category}>{category}</option>)}
      </SelectField>
      <FormField id="item-location" label="Campus location" type="text" maxLength={120} placeholder="e.g. Main library" error={errors.location?.message} {...register('location')} />
    </div>
    {allowTypeChange && <SelectField id="item-type" label="Report type" error={errors.type?.message} {...register('type')}><option value="lost">Lost</option><option value="found">Found</option></SelectField>}
    <FormField id="item-date" label={dateLabel} type="date" error={errors.date?.message} {...register('date')} />
    {includeStatus && <SelectField id="item-status" label="Status" error={errors.status?.message} {...register('status')}>
      <option value="active">Active</option><option value="resolved">Resolved</option>
    </SelectField>}
    {!allowTypeChange && <input type="hidden" value={type} {...register('type')} />}
  </>;
}
