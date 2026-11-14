'use client';

import StepView from '../components/StepView';

export default function Page() {
  return <StepView step={0} title="Categories" hint="Categories are created first. Existing categories are reused and left unchanged." columns={['Category','Description']} grouped={false} />;
}
