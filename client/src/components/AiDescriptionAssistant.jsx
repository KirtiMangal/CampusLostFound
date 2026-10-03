import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useToast } from '../context/ToastContext.jsx';
import { aiApi } from '../services/api.js';

export default function AiDescriptionAssistant({ type, getValues, setValue }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [suggestion, setSuggestion] = useState(null);

  async function generate() {
    const values = getValues();
    if (!values.description?.trim()) {
      setError('Add a rough description first. You can keep it short.');
      setSuggestion(null);
      return;
    }
    const request = {
      type,
      roughDescription: values.description.trim(),
      ...(values.category ? { category: values.category } : {}),
      ...(values.title?.trim() ? { title: values.title.trim() } : {}),
      ...(values.location?.trim() ? { location: values.location.trim() } : {}),
      ...(values.date ? { date: values.date } : {}),
    };

    setLoading(true);
    setError('');
    setSuggestion(null);
    try {
      const response = await aiApi.describe(request);
      setSuggestion(response.data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'AI assistance is temporarily unavailable. You can continue entering the description manually.');
      toast.error('AI assistance is unavailable right now. Your report form is still available.');
    } finally {
      setLoading(false);
    }
  }

  function applySuggestion() {
    if (!suggestion) return;
    setValue('title', suggestion.suggestedTitle, { shouldDirty: true, shouldValidate: true });
    setValue('description', suggestion.suggestedDescription, { shouldDirty: true, shouldValidate: true });
    setValue('category', suggestion.suggestedCategory, { shouldDirty: true, shouldValidate: true });
  }

  return <div className="ai-description-assistant">
    <button className="ai-assistant-button" type="button" onClick={generate} disabled={loading}>
      <Sparkles size={14} /> {loading ? 'Generating…' : 'Help me describe it'}
    </button>
    {loading && <span className="ai-assistant-loading" role="status">Generating a description suggestion…</span>}
    {error && <p className="ai-assistant-error" role="alert">{error}</p>}
    {suggestion && <section className="ai-suggestion-card" aria-label="AI description suggestions">
      <div className="ai-suggestion-heading"><Sparkles size={14} /><strong>Review these suggestions</strong></div>
      <div className="ai-suggestion-copy"><span>Suggested title</span><p>{suggestion.suggestedTitle}</p></div>
      <div className="ai-suggestion-copy"><span>Suggested description</span><p>{suggestion.suggestedDescription}</p></div>
      <div className="ai-suggestion-copy"><span>Suggested category</span><p>{suggestion.suggestedCategory}</p></div>
      {suggestion.keywords.length > 0 && <div className="ai-suggestion-copy"><span>Keywords</span><div className="ai-keyword-list">{suggestion.keywords.map((keyword, index) => <span className="ai-keyword" key={`${keyword}-${index}`}>{keyword}</span>)}</div></div>}
      {suggestion.clarifyingQuestions.length > 0 && <div className="ai-suggestion-copy"><span>You may want to add</span><ul>{suggestion.clarifyingQuestions.map((question, index) => <li key={`${question}-${index}`}>{question}</li>)}</ul></div>}
      <button className="button button-secondary ai-apply-button" type="button" onClick={applySuggestion}>Use suggestions</button>
    </section>}
  </div>;
}
