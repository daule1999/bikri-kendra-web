import { PathParamsGate } from '@/lib/routeParams';
import Client from './MovementDetailClient';

// Static export: built once with a placeholder; worker/dynamic-routes.ts serves it for every real id.
export const dynamicParams = false;
export function generateStaticParams() { return [{ id: '_' }]; }

export default function Page() {
  return (
    <PathParamsGate segments={{ id: 2 }}>
      <Client />
    </PathParamsGate>
  );
}
