'use client';

interface ToggleSwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label?: string;
    /** Text shown next to the switch describing the current state, e.g. "Sellable" / "Hidden". */
    activeLabel?: string;
    inactiveLabel?: string;
    disabled?: boolean;
    size?: 'small' | 'medium';
}

/**
 * Simple on/off switch used for boolean product flags (e.g. "Available for Sale").
 * Styled to match the app's indigo accent used across MuiSelect and buttons.
 */
export function ToggleSwitch({
    checked,
    onChange,
    label,
    activeLabel = 'On',
    inactiveLabel = 'Off',
    disabled = false,
    size = 'medium',
}: ToggleSwitchProps) {
    const isSmall = size === 'small';
    const trackWidth = isSmall ? 'w-9' : 'w-11';
    const trackHeight = isSmall ? 'h-5' : 'h-6';
    const knobSize = isSmall ? 'h-4 w-4' : 'h-5 w-5';
    const knobTranslate = checked ? (isSmall ? 'translate-x-4' : 'translate-x-5') : 'translate-x-0.5';

    return (
        <div className="flex items-center gap-2">
            {label && (
                <span className={`font-bold text-indigo-700 uppercase tracking-wider ${isSmall ? 'text-[9px]' : 'text-[10px]'}`}>
                    {label}
                </span>
            )}
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                disabled={disabled}
                onClick={() => !disabled && onChange(!checked)}
                className={`relative inline-flex ${trackWidth} ${trackHeight} shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 ${checked ? 'bg-indigo-600' : 'bg-gray-300'
                    } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
                <span
                    className={`inline-block ${knobSize} transform rounded-full bg-white shadow-sm transition-transform duration-200 ${knobTranslate}`}
                />
            </button>
            <span className={`font-semibold ${isSmall ? 'text-xs' : 'text-sm'} ${checked ? 'text-indigo-700' : 'text-gray-500'}`}>
                {checked ? activeLabel : inactiveLabel}
            </span>
        </div>
    );
}
