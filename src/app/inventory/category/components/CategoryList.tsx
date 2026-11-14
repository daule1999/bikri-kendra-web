'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api';
import { useInventory, inventoryLogger } from '../../context/InventoryContext';
import { matchItems } from '@/lib/searchMatch';
import { CancelIcon } from '@/components/ui/Icons';

export default function CategoryList({ setAddForm }) {
  const { categories, showSuccess, showError, fetchCategories } = useInventory();
  const [categorySearchTerm, setCategorySearchTerm] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editCategoryData, setEditCategoryData] = useState({ name: '', description: '' });
  const [isUpdatingCategory, setIsUpdatingCategory] = useState(false);

  const startCategoryEdit = (category: any) => {
    setEditingCategoryId(category.id);
    setEditCategoryData({
      name: category.name || '',
      description: category.description || ''
    });
  };

  const cancelCategoryEdit = () => {
    setEditingCategoryId(null);
    setEditCategoryData({ name: '', description: '' });
  };

  const handleCategoryUpdate = async (categoryId: number) => {
    if (!editCategoryData.name.trim()) {
      showError('Category name is required');
      return;
    }

    setIsUpdatingCategory(true);
    inventoryLogger.info('Updating category', { categoryId, payload: editCategoryData });
    try {
      const response = await apiClient.put(`/categories/${categoryId}`, {
        name: editCategoryData.name.trim(),
        description: editCategoryData.description
      });

      if (response.ok) {
        const result = await response.json();
        inventoryLogger.info('Category updated successfully', result);
        showSuccess(`Category "${editCategoryData.name}" updated successfully`);
        cancelCategoryEdit();
        fetchCategories();
      } else {
        const errorData = await response.json();
        inventoryLogger.error('Category update failed', { status: response.status, error: errorData });
        showError(errorData.message || 'Failed to update category');
      }
    } catch (error) {
      inventoryLogger.error('Network error during category update', error);
      showError('Network error occurred while updating category');
    } finally {
      setIsUpdatingCategory(false);
    }
  };

  const filteredCategories = matchItems(
    categorySearchTerm,
    categories,
    (category) => [category?.name, category?.description],
    Infinity
  );

  return (
    <div className="bg-white sm:rounded-2xl sm:border border-indigo-50 p-4 sm:p-8 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
      <div className='flex justify-between items-center'>
        <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
          <div className="bg-indigo-100 text-indigo-700 p-2 rounded-xl">🗂️</div>
          All Categories
        </h3>
        <button
          onClick={() => setAddForm(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-1.5 rounded-xl font-bold shadow-md hover:shadow-lg transition-all duration-150"
        >
          Add category
        </button>
      </div>

      <div className="mb-5 relative">
        <input
          type="text"
          placeholder="Search categories by name or description..."
          value={categorySearchTerm}
          onChange={(e) => setCategorySearchTerm(e.target.value)}
          className="w-full p-3 pr-10 bg-gray-50 border border-gray-200 rounded-xl text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 transition-shadow"
        />
        {categorySearchTerm && (
          <button
            type="button"
            onClick={() => setCategorySearchTerm('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 rounded-full hover:bg-slate-100"
            title="Clear search"
            aria-label="Clear search"
          >
            <CancelIcon />
          </button>
        )}
      </div>

      {categories.length === 0 ? (
        <p className="text-sm text-gray-500">No categories found.</p>
      ) : filteredCategories.length === 0 ? (
        <p className="text-sm text-gray-500">No categories match your search.</p>
      ) : (
        <div className="space-y-4">
          {filteredCategories.map((category) => (
            <div key={category.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50/40">
              {editingCategoryId === category.id ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editCategoryData.name}
                    onChange={(e) => setEditCategoryData({ ...editCategoryData, name: e.target.value })}
                    className="w-full p-3 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                    placeholder="Category Name"
                    required
                  />
                  <textarea
                    value={editCategoryData.description}
                    onChange={(e) => setEditCategoryData({ ...editCategoryData, description: e.target.value })}
                    className="w-full p-3 bg-white border border-gray-300 rounded-lg h-24 text-sm focus:ring-2 focus:ring-indigo-500 resize-none"
                    placeholder="Category Description"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleCategoryUpdate(category.id)}
                      disabled={isUpdatingCategory}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60"
                    >
                      {isUpdatingCategory ? 'Updating...' : 'Update'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelCategoryEdit}
                      disabled={isUpdatingCategory}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-300 disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-gray-800">{category.name}</p>
                    <p className="text-sm text-gray-500 mt-1">{category.description || 'No description added'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => startCategoryEdit(category)}
                    className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-semibold hover:bg-indigo-200 self-start"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
