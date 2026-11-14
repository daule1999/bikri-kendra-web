import { cn } from '@/shared/lib/cn';

export function UserAvatar({ username, className }: { username?: string | null; className?: string }) {
  const initials = username ? username.slice(0, 2).toUpperCase() : '??';
  return (
    <div aria-hidden="true" className={cn('flex flex-shrink-0 items-center justify-center rounded-full bg-gradient-accent font-bold text-on-accent', className)}>
      {initials}
    </div>
  );
}
