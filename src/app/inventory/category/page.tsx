'use client';

import { useState } from 'react';
import AddCategoryForm from './components/AddCategoryForm';
import CategoryList from './components/CategoryList';

export default function CategoryPage() {
  const [addForm, setAddForm] = useState(false);
  return (
    <div className="animate-fade-in-up flex justify-center sm:mt-8">
      <div className="w-full sm:max-w-4xl space-y-6">
        {addForm ? <AddCategoryForm setAddForm={setAddForm} /> : <CategoryList setAddForm={setAddForm} />}
      </div>
    </div>
  );
}
