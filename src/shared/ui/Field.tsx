'use client';

import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { Icon, type IconName } from './Icon';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  leftIcon?: IconName;
  rightSlot?: ReactNode;
}

/** Labelled text input with optional leading icon, trailing slot, hint and error. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, leftIcon, rightSlot, className, id, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  return (
    <div className={className}>
      {label && <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-fg-secondary">{label}</label>}
      <div className="relative">
        {leftIcon && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted"><Icon name={leftIcon} size="sm" strokeWidth={2} /></span>}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={cn(
            'w-full rounded-control border bg-canvas py-2.5 text-sm text-fg transition-all placeholder:text-fg-faint',
            'focus:border-brand focus:ring-2 focus:ring-brand/20',
            error ? 'border-danger' : 'border-line',
            leftIcon ? 'pl-10' : 'pl-3', rightSlot ? 'pr-10' : 'pr-3',
          )}
          {...rest}
        />
        {rightSlot && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted">{rightSlot}</span>}
      </div>
      {error ? <p id={`${inputId}-error`} className="mt-1 text-xs text-danger">{error}</p>
        : hint ? <p id={`${inputId}-hint`} className="mt-1 text-xs text-fg-faint">{hint}</p> : null}
    </div>
  );
});

/** Input with a built-in show/hide toggle. */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputProps, 'type' | 'rightSlot'>>(function PasswordInput(props, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <Input
      ref={ref}
      type={visible ? 'text' : 'password'}
      leftIcon="lock"
      rightSlot={
        <button type="button" onClick={() => setVisible((v) => !v)} aria-label={visible ? 'Hide password' : 'Show password'} className="flex">
          <Icon name={visible ? 'eyeOff' : 'eye'} size="sm" strokeWidth={2} />
        </button>
      }
      {...props}
    />
  );
});

export function Checkbox({ label, className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: ReactNode }) {
  return (
    <label className={cn('flex cursor-pointer items-center gap-2 text-sm text-fg-muted', className)}>
      <input type="checkbox" className="rounded accent-accent" {...rest} />
      {label}
    </label>
  );
}
