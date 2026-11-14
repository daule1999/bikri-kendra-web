import { ReceiptEventConfig } from '@/lib/recieptConfig';

/**
 * TypeScript interface representing an Event item
 * mapped identically to your backend database and Route Handler proxy schema.
 */
export interface EventItem {
    id: number;
    eventName: string;
    eventType: string;
    description?: string;
    location: string;
    startDate: string;
    endDate: string;
    isActive: boolean;
    receiptConfig?: ReceiptEventConfig;
}

export const EVENTS = 'Events' as const;

export const EVENTS_SMALL = 'events' as const;