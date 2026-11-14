'use client';

import StepView from '../components/StepView';

export default function Page() {
  return <StepView step={1} title="Shops" hint="Shops are created per category. A shop is identified by name plus counter number." columns={['Shop','Counter','Category']} grouped={false} />;
}
