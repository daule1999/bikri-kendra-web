'use client';

import StepView from '../components/StepView';

export default function Page() {
  return <StepView step={2} title="Products" hint="Products are created per category. A SKU that already exists must match the file exactly." columns={['SKU','Name','MRP','Selling price','Discount','Min threshold']} grouped={true} />;
}
