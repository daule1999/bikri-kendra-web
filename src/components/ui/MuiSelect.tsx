"use client";

import { useEffect, useRef, useState } from 'react';

interface SelectOption {
    value: string | number;
    label: string;
}

interface MuiSelectProps {
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
}

export function MuiSelect({
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
}: MuiSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const selectedOption = options.find(opt => String(opt.value) === String(value));
    const displayLabel = selectedOption ? selectedOption.label : '';
    const isSmall = size === 'small';

    return (
        <div ref={containerRef} className={`relative ${className}`} id={id}>
            {/* Outer Border Container (Transparent background) */}
            <div
                className={`w-full relative transition-all duration-200 bg-transparent ${isSmall ? 'rounded-xl' : 'rounded-2xl'
                    } border ${isOpen
                        ? 'border-indigo-600 ring-2 ring-indigo-600/15'
                        : disabled
                            ? 'border-slate-100 bg-slate-50/50'
                            : 'border-slate-200 hover:border-slate-400'
                    }`}
            >
                {/* Floating Badge Label (Uses a white background mask to slice neatly through the border) */}
                <span
                    className={`absolute left-3 px-1 bg-white uppercase tracking-wider font-bold transition-all duration-200 pointer-events-none select-none z-10 ${isSmall
                            ? 'text-[9px] -top-2'
                            : 'text-[10px] -top-2.5'
                        } ${isOpen ? 'text-indigo-600' : 'text-slate-500'} ${disabled ? 'text-slate-400' : ''}`}
                >
                    {label} {required && '*'}
                </span>

                <button
                    type="button"
                    onClick={() => !disabled && setIsOpen(!isOpen)}
                    onKeyDown={(e) => {
                        // Close dropdown and let the form's Tab trap take over
                        if (e.key === 'Tab' || e.key === 'Escape') {
                            setIsOpen(false);
                        }
                    }}
                    onBlur={(e) => {
                        // Close dropdown whenever focus leaves the trigger entirely
                        // (covers both Tab and clicking elsewhere)
                        if (!containerRef.current?.contains(e.relatedTarget as Node)) {
                            setIsOpen(false);
                        }
                    }}
                    disabled={disabled}
                    tabIndex={tabIndex}
                    className={`w-full flex items-center justify-between bg-transparent text-left font-medium text-slate-900 focus:outline-none transition-all duration-200 ${isSmall
                            ? 'text-xs pl-3 pr-7 py-1.5 rounded-xl'
                            : 'text-sm pl-4 pr-10 py-2.5 rounded-2xl'
                        } ${disabled ? 'cursor-not-allowed opacity-50 text-slate-400' : 'cursor-pointer'}`}
                    style={isSmall ? { minHeight: '32px' } : { minHeight: '42px' }}
                >
                    <span className={`truncate ${displayLabel ? 'text-slate-900 font-semibold' : 'text-slate-400'} ${disabled ? 'text-slate-400 font-normal' : ''}`}>
                        {displayLabel || (isSmall ? 'Choose' : `Select ${label}`)}
                    </span>

                    {/* Arrow indicator (Using a neat slate/indigo arrow pointer) */}
                    <span
                        className={`absolute shrink-0 text-slate-400 transition-all duration-200 pointer-events-none ${isSmall ? 'right-3 text-[10px]' : 'right-4 text-xs'
                            } ${isOpen ? 'rotate-180 text-indigo-600' : ''}`}
                    >
                        ▼
                    </span>
                </button>
            </div>

            {/* Dropdown Menu Popup (Clean White Minimalist Menu Card) */}
            {isOpen && (
                <div
                    onMouseDown={(e) => e.preventDefault()}
                    className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl py-1 max-h-48 overflow-y-auto min-w-[150px]"
                >
                    {options.length === 0 ? (
                        <div className="px-3 py-1.5 text-[10px] text-slate-400 italic">
                            No options available
                        </div>
                    ) : (
                        options.map((opt) => {
                            const isSelected = String(opt.value) === String(value);
                            return (
                                <button
                                    key={opt.value}
                                    type="button"
                                    tabIndex={-1}
                                    onClick={() => {
                                        onChange(String(opt.value));
                                        setIsOpen(false);
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
            )}
        </div>
    );
}