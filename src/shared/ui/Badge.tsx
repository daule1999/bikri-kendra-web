import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { toneClass, type Tone } from './tone';

export function Badge({ tone = 'indigo', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn(toneClass(tone), 'inline-flex items-center gap-1.5 rounded-full border border-tone-line bg-tone-soft px-2.5 py-0.5 text-xs font-semibold text-tone', className)}>
      {children}
    </span>
  );
}
