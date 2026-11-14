import { forwardRef, type ButtonHTMLAttributes, type AnchorHTMLAttributes, type ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/shared/lib/cn';
import { Spinner } from './Spinner';

const VARIANTS = {
  primary: 'bg-brand text-on-accent hover:opacity-90',
  accent: 'bg-gradient-accent text-on-accent hover:opacity-90',
  secondary: 'bg-surface text-fg-secondary border border-line hover:bg-surface-hover',
  ghost: 'bg-transparent text-fg-muted hover:bg-black/5',
  danger: 'bg-danger text-on-accent hover:opacity-90',
  /** Tinted by the parent's tone-* class (see shared/ui/tone.ts). */
  tone: 'bg-tone-soft text-tone border border-tone-line hover:opacity-90',
} as const;

const SIZES = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2.5 text-sm gap-2',
  lg: 'px-4 py-3 text-sm gap-2',
} as const;

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

interface StyleProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const buttonClasses = ({ variant = 'primary', size = 'md', fullWidth }: StyleProps, className?: string) =>
  cn(
    'inline-flex items-center justify-center rounded-control font-semibold transition-all duration-150',
    'active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100',
    VARIANTS[variant], SIZES[size], fullWidth && 'w-full', className,
  );

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, StyleProps {
  loading?: boolean;
  loadingText?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, fullWidth, leftIcon, rightIcon, loading, loadingText, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading} className={buttonClasses({ variant, size, fullWidth }, className)} {...rest}>
      {loading ? <Spinner /> : leftIcon}
      {loading && loadingText ? loadingText : children}
      {!loading && rightIcon}
    </button>
  );
});

export interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement>, StyleProps {
  href: string;
}

export function ButtonLink({ variant, size, fullWidth, leftIcon, rightIcon, className, children, href, ...rest }: ButtonLinkProps) {
  return (
    <Link href={href} className={buttonClasses({ variant, size, fullWidth }, className)} {...rest}>
      {leftIcon}{children}{rightIcon}
    </Link>
  );
}
