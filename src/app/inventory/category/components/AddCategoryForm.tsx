'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api';
import { useInventory, inventoryLogger } from '../../context/InventoryContext';

export default function AddCategoryForm({ setAddForm }) {
  const { showSuccess, showError, fetchCategories } = useInventory();
  const [categoryData, setCategoryData] = useState({ name: '', description: '' });

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    inventoryLogger.info('Creating new category', categoryData);
    try {
      const response = await apiClient.post('/categories', categoryData);

      if (response.ok) {
        const result = await response.json();
        inventoryLogger.info('Category created successfully', result);
        setCategoryData({ name: '', description: '' });
        showSuccess(`Category "${categoryData.name}" created successfully`);
        fetchCategories();
      } else {
        const errorData = await response.json();
        inventoryLogger.error('Category creation failed', { status: response.status, error: errorData });
        showError(errorData.message || 'Failed to create category');
      }
    } catch (error) {
      inventoryLogger.error('Network error during category creation', error);
      showError('Network error occurred while creating category');
    }
  };

  return (
    <div className="bg-white sm:rounded-2xl sm:border border-indigo-50 p-4 sm:p-10 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] w-full sm:max-w-lg mx-auto">
      <div className="flex justify-between items-center flex-wrap gap-3 mb-6">
        <h3 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-3">
          <div className="bg-indigo-100 text-indigo-700 p-2 rounded-xl">📁</div>
          Register New Category
        </h3>
        <button
          type="button"
          onClick={() => setAddForm(false)}
          className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 whitespace-nowrap"
        >
          ← Back to Category dashboard
        </button>
      </div>
      <form onSubmit={handleCategorySubmit} className="space-y-5">
        <div>
          <input
            type="text"
            placeholder="Category Name *"
            value={categoryData.name}
            onChange={(e) => setCategoryData({ ...categoryData, name: e.target.value })}
            className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 transition-shadow"
            required
          />
        </div>
        <div>
          <textarea
            placeholder="Category Description"
            value={categoryData.description}
            onChange={(e) => setCategoryData({ ...categoryData, description: e.target.value })}
            className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl h-28 text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 transition-shadow resize-none"
          />
        </div>
        <button type="submit" className="w-full bg-indigo-600 text-white px-6 py-3.5 rounded-xl hover:bg-indigo-700 font-bold shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5">
          Register Category
        </button>
      </form>
    </div>
  );
}
