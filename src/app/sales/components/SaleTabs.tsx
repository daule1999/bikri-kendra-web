import React from 'react';

interface SaleTabsProps {
    activeTab: 'sale' | 'catalog' | 'cancel';
    onTabChange: (tab: 'sale' | 'catalog' | 'cancel') => void;
    isMobile: boolean;
}

const SaleIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
);

const CatalogIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
);

const CancelIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z" />
    </svg>
);

export function SaleTabs({ activeTab, onTabChange, isMobile }: SaleTabsProps) {
    const tabs = [
        { key: 'sale' as const, label: 'Sale', mobileLabel: 'Sale', Icon: SaleIcon, activeColor: 'text-sky-700 bg-sky-50 border-b-2 border-sky-600' },
        { key: 'catalog' as const, label: 'Counter Catalog', mobileLabel: 'Catalog', Icon: CatalogIcon, activeColor: 'text-sky-700 bg-sky-50 border-b-2 border-sky-600' },
        { key: 'cancel' as const, label: 'Cancel / Return Order', mobileLabel: 'Cancel/Return', Icon: CancelIcon, activeColor: 'text-red-700 bg-red-50 border-b-2 border-red-500' },
    ];

    return (
        <div className="flex border-b border-slate-100 overflow-x-auto bg-white">
            {tabs.map(({ key, label, mobileLabel, Icon, activeColor }) => {
                const isActive = activeTab === key;
                return (
                    <button
                        key={key}
                        onClick={() => onTabChange(key)}
                        className={`
                            flex items-center gap-2 px-4 sm:px-6 py-3 whitespace-nowrap text-sm font-semibold
                            transition-all duration-150 select-none focus:outline-none
                            ${isActive
                                ? activeColor
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 border-b-2 border-transparent'
                            }
                        `}
                    >
                        <span className={`transition-colors ${isActive ? '' : 'opacity-60'}`}>
                            <Icon />
                        </span>
                        <span className="sm:hidden">{mobileLabel}</span>
                        <span className="hidden sm:inline">{label}</span>
                    </button>
                );
            })}
        </div>
    );
}
