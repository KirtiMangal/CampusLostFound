import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import FormField from '../components/FormField.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { loginSchema } from '../schemas/authSchemas.js';

export default function LoginPage() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(loginSchema), mode: 'onBlur' });

  async function submit(values) {
    try {
      await login(values);
      toast('Welcome back. You’re signed in.');
      navigate(location.state?.from?.pathname || '/dashboard', { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || 'We couldn’t sign you in. Please try again.');
    }
  }

  return <section className="auth-wrap"><div className="auth-card">
    <Link className="auth-back" to="/"><ArrowLeft size={14} /> Back to campus/found</Link>
    <div className="eyebrow">YOUR CAMPUS COMMUNITY IS HERE</div>
    <h1>Welcome <span className="serif-accent">back.</span></h1>
    <p className="auth-intro">Sign in to keep your campus community close.</p>
    <form className="auth-form" onSubmit={handleSubmit(submit)} noValidate>
      <FormField id="login-email" label="University email" type="email" autoComplete="email" placeholder="you@university.edu" error={errors.email?.message} {...register('email')} />
      <FormField id="login-password" label="Password" type="password" autoComplete="current-password" placeholder="Enter your password" error={errors.password?.message} {...register('password')} />
      <button className="button button-primary auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Signing in…' : 'Sign in'} {!isSubmitting && <ArrowUpRight size={16} />}</button>
    </form>
    <p className="auth-switch">New to campus/found? <Link to="/register">Create an account</Link></p>
  </div></section>;
}
