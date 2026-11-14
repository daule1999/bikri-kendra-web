import { PathParamsGate } from '@/lib/routeParams';
import Client from './InvoiceDetailClient';

// Static export: built once with a placeholder; worker/dynamic-routes.ts serves it for every real invoiceId.
export const dynamicParams = false;
export function generateStaticParams() { return [{ invoiceId: '_' }]; }

export default function Page() {
  return (
    <PathParamsGate segments={{ invoiceId: 2 }}>
      <Client />
    </PathParamsGate>
  );
}
