import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { Icon, type IconName } from './Icon';

/**
 * Compound card:
 *   <Card><Card.Header icon="user" title="Account Details" /><Card.Body>…</Card.Body></Card>
 */
interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Lift slightly on hover (for clickable cards). */
  interactive?: boolean;
  padded?: boolean;
}

function CardRoot({ interactive, padded = true, className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'relative rounded-card border border-line bg-surface shadow-card',
        padded && 'p-5 sm:p-6',
        interactive && 'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-raised',
        className,
      )}
      {...rest}
    />
  );
}

function CardHeader({ title, description, icon, action, className }: {
  title: ReactNode; description?: ReactNode; icon?: IconName; action?: ReactNode; className?: string;
}) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-3', className)}>
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-fg-secondary">
          {icon && <Icon name={icon} size="sm" strokeWidth={2} />}
          {title}
        </h3>
        {description && <p className="mt-1 text-xs text-fg-faint">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={className} {...rest} />;
}

export const Card = Object.assign(CardRoot, { Header: CardHeader, Body: CardBody });
