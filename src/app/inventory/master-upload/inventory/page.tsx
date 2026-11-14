'use client';

import StepView from '../components/StepView';

export default function Page() {
  return <StepView step={3} title="Inventory" hint="Stock is added so the total received matches the file. Only the missing difference is added." columns={['SKU','Name','File qty','Received so far','To add']} grouped={true} />;
}
