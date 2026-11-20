import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import StatusMessage from '../components/StatusMessage.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function SignInPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next')?.startsWith('/') ? searchParams.get('next') : '/account';
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'login') await login({ email: form.email, password: form.password });
      else await register(form);
      navigate(next, { replace: true });
    } catch (caught) {
      setError(caught.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-layout">
      <form onSubmit={submit}>
        <p className="eyebrow">{mode === 'login' ? 'CUSTOMER SIGN-IN' : 'CREATE A TEST ACCOUNT'}</p>
        <h1>{mode === 'login' ? 'Sign in' : 'Create account'}</h1>
        <StatusMessage type="info">Classroom demo: use a fictional name and a test email such as student1@example.com. Do not reuse a real password.</StatusMessage>
        <StatusMessage type="error">{error}</StatusMessage>
        {mode === 'register' && (
          <label>Full name<input name="name" value={form.name} onChange={updateField} minLength="2" maxLength="80" autoComplete="name" required /></label>
        )}
        <label>Email address<input name="email" type="email" value={form.email} onChange={updateField} autoComplete="email" required /></label>
        <label>Password<input name="password" type="password" value={form.password} onChange={updateField} minLength={mode === 'register' ? 8 : 1} maxLength="72" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required /></label>
        <button disabled={submitting}>{submitting ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
        <p className="auth-switch">
          {mode === 'login' ? 'No test account yet?' : 'Already have a test account?'}{' '}
          <button type="button" className="link-button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
            {mode === 'login' ? 'Create one' : 'Sign in'}
          </button>
        </p>
        <Link to="/">Back to products</Link>
      </form>
    </section>
  );
}
