'use client';

import StepView from '../components/StepView';

export default function Page() {
  return <StepView step={4} title="Issue" hint="Products are issued to shops. Only the missing difference per shop is issued." columns={['SKU','Name','Shop','File qty','Issued so far','To issue']} grouped={true} />;
}
