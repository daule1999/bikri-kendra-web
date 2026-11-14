import { cn } from '@/shared/lib/cn';
import { Icon, type IconName } from './Icon';
import { toneClass, type Tone } from './tone';

const SIZES = { md: 'w-11 h-11 rounded-control', lg: 'w-16 h-16 rounded-card' } as const;

/** Tinted square holding an icon (module cards, empty states, auth header). */
export function IconBadge({ icon, tone = 'indigo', size = 'md', className }: {
  icon: IconName; tone?: Tone; size?: keyof typeof SIZES; className?: string;
}) {
  return (
    <div className={cn(toneClass(tone), 'flex items-center justify-center bg-tone-soft text-tone', SIZES[size], className)}>
      <Icon name={icon} size={size === 'lg' ? 'xl' : 'lg'} strokeWidth={1.7} />
    </div>
  );
}
