"use client";

import { useEffect, useRef, useState } from 'react';
import { matchItems } from '@/lib/searchMatch';
import { CancelIcon } from '@/components/ui/Icons';

interface SelectOption {
    value: string | number;
    label: string;
}

interface MuiSearchSelectProps {
    label: string;
    value: string | number;
    onChange: (val: string) => void;
    options: SelectOption[];
    className?: string;
    id?: string;
    required?: boolean;
    size?: 'small' | 'medium';
    disabled?: boolean;
    tabIndex?: number;
    searchPlaceholder?: string;
}

export function MuiSearchSelect({
    label,
    value,
    onChange,
    options,
    className = '',
    id,
    required = false,
    size = 'medium',
    disabled = false,
    tabIndex,
    searchPlaceholder = 'Search...',
}: MuiSearchSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearch('');
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Auto-focus search input when dropdown opens
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => searchRef.current?.focus(), 50);
        } else {
            setSearch('');
        }
    }, [isOpen]);

    const selectedOption = options.find(opt => String(opt.value) === String(value));
    const displayLabel = selectedOption ? selectedOption.label : '';
    const isSmall = size === 'small';

    const filtered = matchItems(search, options, (opt) => [opt.label], Infinity);

    return (
        <div ref={containerRef} className={`relative ${className}`} id={id}>
            {/* Trigger button */}
            <div
                className={`w-full relative transition-all duration-200 bg-transparent ${isSmall ? 'rounded-xl' : 'rounded-2xl'
                    } border ${isOpen
                        ? 'border-indigo-600 ring-2 ring-indigo-600/15'
                        : disabled
                            ? 'border-slate-100 bg-slate-50/50'
                            : 'border-slate-200 hover:border-slate-400'
                    }`}
            >
                <span
                    className={`absolute left-3 px-1 bg-white uppercase tracking-wider font-bold transition-all duration-200 pointer-events-none select-none z-10 ${isSmall ? 'text-[9px] -top-2' : 'text-[10px] -top-2.5'
                        } ${isOpen ? 'text-indigo-600' : 'text-slate-500'} ${disabled ? 'text-slate-400' : ''}`}
                >
                    {label} {required && '*'}
                </span>

                <button
                    type="button"
                    onClick={() => !disabled && setIsOpen(!isOpen)}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') { setIsOpen(false); setSearch(''); }
                    }}
                    disabled={disabled}
                    tabIndex={tabIndex}
                    className={`w-full flex items-center justify-between bg-transparent text-left font-medium text-slate-900 focus:outline-none transition-all duration-200 ${isSmall ? 'text-xs pl-3 pr-7 py-1.5 rounded-xl' : 'text-sm pl-4 pr-10 py-2.5 rounded-2xl'
                        } ${disabled ? 'cursor-not-allowed opacity-50 text-slate-400' : 'cursor-pointer'}`}
                    style={isSmall ? { minHeight: '32px' } : { minHeight: '42px' }}
                >
                    <span className={`truncate ${displayLabel ? 'text-slate-900 font-semibold' : 'text-slate-400'} ${disabled ? 'text-slate-400 font-normal' : ''}`}>
                        {displayLabel || (isSmall ? 'Choose' : `Select ${label}`)}
                    </span>
                    <span
                        className={`absolute shrink-0 text-slate-400 transition-all duration-200 pointer-events-none ${isSmall ? 'right-3 text-[10px]' : 'right-4 text-xs'
                            } ${isOpen ? 'rotate-180 text-indigo-600' : ''}`}
                    >
                        ▼
                    </span>
                </button>
            </div>

            {/* Dropdown with search */}
            {isOpen && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl min-w-[150px]">
                    {/* Search input */}
                    <div className="p-2 border-b border-slate-100">
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-400/20 transition-all">
                            <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                            </svg>
                            <input
                                ref={searchRef}
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Escape') { setIsOpen(false); setSearch(''); }
                                    // Select first filtered option on Enter
                                    if (e.key === 'Enter' && filtered.length > 0) {
                                        onChange(String(filtered[0].value));
                                        setIsOpen(false);
                                        setSearch('');
                                    }
                                }}
                                placeholder={searchPlaceholder}
                                className="flex-1 bg-transparent text-xs text-slate-700 placeholder-slate-400 focus:outline-none"
                            />
                            {search && (
                                <button
                                    type="button"
                                    tabIndex={-1}
                                    onClick={() => setSearch('')}
                                    className="flex items-center justify-center w-5 h-5 rounded-full hover:bg-slate-200 transition-colors"
                                    title="Clear search"
                                    aria-label="Clear search"
                                >
                                    <CancelIcon className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Options list */}
                    <div className="py-1 max-h-44 overflow-y-auto" onMouseDown={(e) => e.preventDefault()}>
                        {filtered.length === 0 ? (
                            <div className="px-3 py-3 text-xs text-slate-400 italic text-center">
                                No results for &quot;{search}&quot;
                            </div>
                        ) : (
                            filtered.map((opt) => {
                                const isSelected = String(opt.value) === String(value);
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        tabIndex={-1}
                                        onClick={() => {
                                            onChange(String(opt.value));
                                            setIsOpen(false);
                                            setSearch('');
                                        }}
                                        className={`w-full text-left px-3 py-2 transition-colors duration-150 flex items-center justify-between ${isSmall ? 'text-[11px]' : 'text-xs'
                                            } ${isSelected
                                                ? 'bg-indigo-50 text-indigo-600 font-semibold'
                                                : 'hover:bg-slate-50 text-slate-700'
                                            }`}
                                    >
                                        <span className="truncate">{opt.label}</span>
                                        {isSelected && (
                                            <svg className="w-3.5 h-3.5 text-indigo-600 shrink-0 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
