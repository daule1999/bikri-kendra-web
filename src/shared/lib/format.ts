import { APP } from '@/core/config';

/** "14 Nov" in the app locale. */
export const formatShortDate = (d: Date) => d.toLocaleDateString(APP.locale, { day: '2-digit', month: 'short' });
