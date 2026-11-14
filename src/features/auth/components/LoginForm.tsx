'use client';

import { Alert, Button, Checkbox, Icon, Input, PasswordInput } from '@/shared/ui';
import { useLoginForm } from '../hooks/useLoginForm';

export function LoginForm() {
  const { fields, error, submitting, onSubmit } = useLoginForm();
  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate={false}>
      {error && <Alert variant="danger">{error}</Alert>}

      <Input
        id="login-username" label="Username" leftIcon="user" required autoComplete="username"
        placeholder="Enter your username"
        value={fields.username.value} onChange={(e) => fields.username.onChange(e.target.value)}
      />
      <PasswordInput
        id="login-password" label="Password" required autoComplete="current-password" placeholder="••••••••"
        ref={fields.password.ref}
        value={fields.password.value} onChange={(e) => fields.password.onChange(e.target.value)}
      />
      <Checkbox
        label="Remember me"
        checked={fields.rememberMe.checked} onChange={(e) => fields.rememberMe.onChange(e.target.checked)}
      />
      <Button id="login-submit-btn" type="submit" variant="accent" size="lg" fullWidth
        loading={submitting} loadingText="Signing in…" rightIcon={<Icon name="arrowRight" size="sm" strokeWidth={2} />}>
        Sign In
      </Button>
    </form>
  );
}
