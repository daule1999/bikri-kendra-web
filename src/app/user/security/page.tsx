'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/core/api/secure-fetch';
import { useDispatch, useSelector } from 'react-redux';
import { clearMustResetPassword, selectMustResetPassword, selectUsername } from '@/store/slices/authSlice';

// ─── helpers ────────────────────────────────────────────────────────────────

function PasswordInput({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--theme-text-secondary)' }}>
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--theme-text-muted)' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </span>
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? '••••••••'}
          className="w-full pl-10 pr-10 py-2.5 text-sm rounded-lg border transition-all"
          style={{
            borderColor: 'var(--theme-border)',
            background: 'var(--theme-content-bg)',
            color: 'var(--theme-text-primary)',
          }}
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          {show ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function SecurityPage() {
  const dispatch = useDispatch();
  const router = useRouter();

  const reduxUsername = useSelector(selectUsername);
  const reduxMustReset = useSelector(selectMustResetPassword);

  // mustReset and username must be resolved client-side only.
  // Reading localStorage during render causes an SSR/hydration mismatch in Next.js:
  // the server renders mustReset=false (no window), React commits that HTML, and
  // the banner/skip button never appear even though localStorage says 'true'.
  // useEffect runs only on the client after hydration, so the state update is safe.
  const [mustReset, setMustReset] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    // Prefer Redux (already hydrated) → fall back to localStorage
    setMustReset(
      reduxMustReset !== null
        ? reduxMustReset
        : localStorage.getItem('mustResetPassword') === 'true'
    );
    setUsername(reduxUsername ?? localStorage.getItem('username'));
  }, [reduxMustReset, reduxUsername]);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cancel any pending redirect timer if the component unmounts (avoids memory leak)
  useEffect(() => {
    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, []);

  // Client-side validation before hitting the API
  const validate = (): string | null => {
    if (!oldPassword) return 'Current password is required.';
    if (newPassword.length < 6) return 'New password must be at least 6 characters.';
    if (newPassword === oldPassword) return 'New password must be different from current password.';
    if (newPassword !== confirmPassword) return 'New password and confirm password do not match.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setIsLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const caller = localStorage.getItem('username');

      const response = await apiFetch(`/api/users/${username}/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          ...(caller && { 'X-Username': caller }),
        },
        body: JSON.stringify({ oldPassword, newPassword, confirmPassword }),
      });

      if (response.ok) {
        // Clear the must-reset flag in Redux + localStorage
        dispatch(clearMustResetPassword());
        setSuccess(true);
        // Brief pause so the user sees the success message, then navigate
        redirectTimer.current = setTimeout(() => router.replace('/select-event'), 1800);
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data.message || data.error || `Failed with status ${response.status}`);
      }
    } catch (err) {
      console.error('[SecurityPage] change-password error:', err);
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    // When mustReset is true: skip keeps the flag alive — they'll be prompted again next login.
    // When mustReset is false: this acts as a plain "Cancel / Go back" button.
    router.back();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--theme-bg)' }}>
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: 'var(--theme-surface)', filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.25))' }}
      >
        {/* Accent bar */}
        <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg, #4F46E5, #7C3AED, #F59E0B)' }} />

        {/* Header */}
        <div
          className="px-8 pt-8 pb-6"
          style={{ background: 'linear-gradient(160deg, #1E1B4B 0%, #312E81 100%)' }}
        >
          <div className="flex items-center gap-3 mb-1">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Change Password</h1>
              <p className="text-sm" style={{ color: '#C7D2FE' }}>
                {mustReset ? 'Please set a new password to continue' : 'Update your account password'}
              </p>
            </div>
          </div>

          {/* Prompt banner — only shown when mustResetPassword is true */}
          {mustReset && (
            <div
              className="mt-4 p-3 rounded-xl text-sm flex items-start gap-2"
              style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#FCD34D' }}
            >
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                Your password was set by an administrator. We recommend changing it now — you can also skip and do it later.
              </span>
            </div>
          )}
        </div>

        {/* Form */}
        <div className="px-8 py-8">
          {success ? (
            <div className="text-center py-6">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(16, 185, 129, 0.15)' }}
              >
                <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-lg font-semibold" style={{ color: 'var(--theme-text-primary)' }}>Password changed!</p>
              <p className="text-sm mt-1" style={{ color: 'var(--theme-text-muted)' }}>Redirecting you now…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div
                  className="p-3.5 rounded-xl border flex items-start gap-3 text-sm"
                  style={{
                    borderColor: 'rgba(239, 68, 68, 0.3)',
                    background: 'rgba(239, 68, 68, 0.08)',
                    color: '#f87171',
                  }}
                >
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="font-medium leading-relaxed">{error}</span>
                </div>
              )}

              <PasswordInput id="old-password" label="Current Password" value={oldPassword} onChange={setOldPassword} />
              <PasswordInput id="new-password" label="New Password" value={newPassword} onChange={setNewPassword} placeholder="Min. 6 characters" />
              <PasswordInput id="confirm-password" label="Confirm New Password" value={confirmPassword} onChange={setConfirmPassword} />

              <div className="flex gap-3 pt-1">
                {/* Skip for Now (forced reset) or Cancel (voluntary change) — always shown */}
                <button
                  type="button"
                  onClick={handleSkip}
                  className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium border transition-all"
                  style={{
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text-secondary)',
                    background: 'transparent',
                  }}
                >
                  {mustReset ? 'Skip for Now' : 'Cancel'}
                </button>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold text-white transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98]"
                  style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}
                >
                  {isLoading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Saving…
                    </>
                  ) : 'Change Password'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
