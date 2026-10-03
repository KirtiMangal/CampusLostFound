import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import FormField from '../components/FormField.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { registerSchema } from '../schemas/authSchemas.js';

export default function RegisterPage() {
  const { register: createAccount } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(registerSchema), mode: 'onBlur' });

  async function submit(values) {
    try {
      await createAccount(values);
      toast('Your account is ready. Welcome to campus/found!');
      navigate('/dashboard', { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || 'We couldn’t create your account. Please try again.');
    }
  }

  return <section className="auth-wrap"><div className="auth-card auth-card-wide">
    <Link className="auth-back" to="/"><ArrowLeft size={14} /> Back to campus/found</Link>
    <div className="eyebrow">A COMMUNITY THAT LOOKS OUT FOR YOU</div>
    <h1>Make yourself <span className="serif-accent">at home.</span></h1>
    <p className="auth-intro">Create your student account to join the campus community.</p>
    <form className="auth-form" onSubmit={handleSubmit(submit)} noValidate>
      <FormField id="register-name" label="Full name" type="text" autoComplete="name" placeholder="Your full name" error={errors.name?.message} {...register('name')} />
      <FormField id="register-email" label="University email" type="email" autoComplete="email" placeholder="you@university.edu" error={errors.email?.message} {...register('email')} />
      <FormField id="register-password" label="Password" type="password" autoComplete="new-password" placeholder="At least 8 characters" error={errors.password?.message} {...register('password')} />
      <FormField id="register-confirm-password" label="Confirm password" type="password" autoComplete="new-password" placeholder="Enter your password again" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
      <button className="button button-primary auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creating account…' : 'Create account'} {!isSubmitting && <ArrowUpRight size={16} />}</button>
    </form>
    <p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>
  </div></section>;
}
