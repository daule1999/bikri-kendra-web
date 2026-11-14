import {
    CheckIcon as HeroCheck,
    PencilIcon as HeroPencil,
    TrashIcon as HeroTrash,
    XMarkIcon as HeroX,
    ArrowPathIcon as HeroRefresh
} from '@heroicons/react/20/solid';

import React from 'react';

// Define standard Tailwind class presets to enforce strict design uniformity
const BASE_STYLE = "transition-all duration-200 cursor-pointer shrink-0";

interface IconProps extends React.SVGProps<SVGSVGElement> {
    className?: string;
}

export const RefreshIcon = ({ className = '', ...props }: IconProps) => (
    <HeroRefresh
        className={`${BASE_STYLE} w-4.5 h-4.5 text-slate-400 hover:text-indigo-600 ${className}`}
        {...props}
    />
);

export const PencilIcon = ({ className = '', ...props }: IconProps) => (
    <HeroPencil
        className={`${BASE_STYLE} w-4 h-4 text-slate-400 hover:text-indigo-600 ${className}`}
        {...props}
    />
);

export const TrashIcon = ({ className = '', ...props }: IconProps) => (
    <HeroTrash
        className={`${BASE_STYLE} w-4.5 h-4.5 text-slate-400 hover:text-rose-600 ${className}`}
        {...props}
    />
);

export const CheckIcon = ({ className = '', ...props }: IconProps) => (
    <HeroCheck
        className={`${BASE_STYLE} w-5 h-5 text-emerald-600 hover:text-emerald-700 ${className}`}
        {...props}
    />
);

export const CancelIcon = ({ className = '', ...props }: IconProps) => (
    <HeroX
        className={`${BASE_STYLE} w-5 h-5 text-slate-400 hover:text-slate-600 ${className}`}
        {...props}
    />
);

// Specialty variant for embedded action buttons (like your Save button)
export const CheckIconWhite = ({ className = '', ...props }: IconProps) => (
    <HeroCheck
        className={`${BASE_STYLE} w-3.5 h-3.5 text-white ${className}`}
        {...props}
    />
);