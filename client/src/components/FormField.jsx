import { forwardRef } from 'react';

const FormField = forwardRef(function FormField({ id, label, error, ...inputProps }, ref) {
  return <div className="form-field">
    <label htmlFor={id}>{label}</label>
    <input ref={ref} id={id} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} {...inputProps} />
    {error && <span className="field-error" id={`${id}-error`}>{error}</span>}
  </div>;
});

export default FormField;
