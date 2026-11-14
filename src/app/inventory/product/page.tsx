'use client';

import { useState } from 'react';
import AddProductForm from './components/AddProductForm';
import ProductList from './components/ProductList';

export default function ProductPage() {
  const [addForm, setAddForm] = useState(false);
  const [duplicateSource, setDuplicateSource] = useState<any>(null);

  const toggleAddForm = (v: boolean) => {
    if (!v) setDuplicateSource(null);
    setAddForm(v);
  };

  const handleDuplicate = (product: any) => {
    setDuplicateSource(product);
    setAddForm(true);
  };

  return (
    <div className="animate-fade-in-up mt-8 w-full max-w-full">
      {addForm ? (
        <AddProductForm setAddForm={toggleAddForm} initialProduct={duplicateSource} />
      ) : (
        <ProductList setAddForm={toggleAddForm} onDuplicate={handleDuplicate} />
      )}
    </div>
  );
}
