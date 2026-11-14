'use client';

import { GuestOnlyRoute } from '@/core/auth';
import { AuthBackdrop } from '../components/AuthBackdrop';
import { AuthCard } from '../components/AuthCard';
import { LoginForm } from '../components/LoginForm';

export function LoginPage() {
  return (
    <GuestOnlyRoute>
      <AuthBackdrop>
        <AuthCard title="Sign in to your account">
          <LoginForm />
        </AuthCard>
      </AuthBackdrop>
    </GuestOnlyRoute>
  );
}
