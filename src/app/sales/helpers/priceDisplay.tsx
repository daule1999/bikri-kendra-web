import React from 'react';

function toNum(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = typeof val === 'number' ? val : parseFloat(String(val));
  return isNaN(n) ? null : n;
}

/**
 * True when the product has a real discount worth showing (both prices
 * present and numerically different). Handles values arriving as strings
 * or numbers, since different call sites store them differently.
 */
export function hasDiscount(mrp: unknown, sellingPrice: unknown): boolean {
  const m = toNum(mrp);
  const s = toNum(sellingPrice);
  if (m === null || s === null) return false;
  return m !== s;
}

const sizeClasses = {
  sm: { mrp: 'text-[10px]', price: 'text-xs' },
  md: { mrp: 'text-[10px]', price: 'text-sm' },
  lg: { mrp: 'text-xs', price: 'text-base' },
} as const;

interface PriceTagProps {
  mrp: unknown;
  sellingPrice: unknown;
  size?: keyof typeof sizeClasses;
  className?: string;
  priceClassName?: string;
}

/**
 * Consistent MRP / selling-price rendering used across the Sale tab and
 * Catalog tab: same price -> show only MRP; different -> MRP struck
 * through followed by the (discounted) selling price.
 */
export function PriceTag({ mrp, sellingPrice, size = 'md', className = '', priceClassName = '' }: PriceTagProps) {
  const cls = sizeClasses[size];
  const discounted = hasDiscount(mrp, sellingPrice);
  const displayValue = discounted ? sellingPrice : (mrp ?? sellingPrice);
  const mrpText = mrp === null || mrp === undefined ? '' : String(mrp);
  const displayText = displayValue === null || displayValue === undefined ? '' : String(displayValue);

  return (
    <span className={`inline-flex items-baseline gap-1.5 ${className}`}>
      {discounted && (
        <span className={`${cls.mrp} text-red-500 font-bold line-through decoration-1 decoration-red-300`}>₹{mrpText}</span>
      )}
      <span className={`${cls.price} font-bold text-sky-600 ${priceClassName}`}>₹{displayText}</span>
    </span>
  );
}
