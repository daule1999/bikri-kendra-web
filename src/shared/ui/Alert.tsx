import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { Icon, type IconName } from './Icon';

const VARIANTS = {
  danger: { cls: 'bg-danger-bg text-danger border-danger/30', icon: 'warning' },
  warning: { cls: 'bg-warning-bg text-accent-dark border-warning/30', icon: 'warning' },
  success: { cls: 'bg-success-bg text-success border-success/30', icon: 'check' },
  info: { cls: 'bg-info-bg text-info border-info/30', icon: 'info' },
} as const satisfies Record<string, { cls: string; icon: IconName }>;

export function Alert({ variant = 'info', title, children, className }: {
  variant?: keyof typeof VARIANTS; title?: ReactNode; children?: ReactNode; className?: string;
}) {
  const v = VARIANTS[variant];
  return (
    <div role={variant === 'danger' ? 'alert' : 'status'} className={cn('flex items-start gap-3 rounded-control border p-3.5 text-sm animate-fade-in', v.cls, className)}>
      <Icon name={v.icon} className="mt-0.5" />
      <div className="flex-1 font-medium leading-relaxed">
        {title && <p className="font-semibold">{title}</p>}
        {children}
      </div>
    </div>
  );
}
