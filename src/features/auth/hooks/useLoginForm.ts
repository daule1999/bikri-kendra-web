'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/core/auth';
import { ApiError } from '@/core/api';
import { ROUTES, STORAGE_KEYS } from '@/core/config';

/** All login-form state and side effects; the component only renders. */
export function useLoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const passwordRef = useRef<HTMLInputElement>(null);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Pre-fill a remembered username and jump straight to the password field.
  useEffect(() => {
    const remembered = localStorage.getItem(STORAGE_KEYS.rememberedUsername);
    if (remembered) {
      setUsername(remembered);
      setRememberMe(true);
      requestAnimationFrame(() => passwordRef.current?.focus());
    }
  }, []);

  const clearError = () => error && setError(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const user = await login(username.trim(), password);
      if (rememberMe) localStorage.setItem(STORAGE_KEYS.rememberedUsername, user.username);
      else localStorage.removeItem(STORAGE_KEYS.rememberedUsername);
      // ProtectedRoute sends must-reset users to the change-password page.
      router.replace(user.mustResetPassword ? ROUTES.changePassword : ROUTES.dashboard);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed. Please try again.');
      setSubmitting(false);
    }
  };

  return {
    fields: {
      username: { value: username, onChange: (v: string) => { setUsername(v); clearError(); } },
      password: { value: password, onChange: (v: string) => { setPassword(v); clearError(); }, ref: passwordRef },
      rememberMe: { checked: rememberMe, onChange: setRememberMe },
    },
    error,
    submitting,
    onSubmit,
  };
}
