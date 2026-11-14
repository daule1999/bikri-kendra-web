'use client';

import { useLegacyParams } from '@/lib/routeParams';

export default function InvoiceDetailClient() {
  const { invoiceId } = useLegacyParams<{ invoiceId: string }>();
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-primary mb-4">Invoice #{invoiceId}</h1>
      <div className="bg-bg p-4 rounded-lg">
        <p>Invoice details for {invoiceId}</p>
      </div>
    </div>
  );
}
