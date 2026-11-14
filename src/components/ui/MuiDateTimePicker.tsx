"use client";

import { useEffect, useRef, useState } from 'react';

// Custom hook to detect mobile viewport reactively
function useIsMobile() {
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        setIsMobile(window.innerWidth < 768);
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    return isMobile;
}

export interface MuiDateTimePickerProps {
    label: string;
    value: string; // YYYY-MM-DD or YYYY-MM-DDTHH:mm
    onChange: (val: string) => void;
    type?: 'date' | 'datetime-local';
    className?: string;
    id?: string;
    required?: boolean;
    size?: 'small' | 'medium';
    disabled?: boolean;
    variant?: 'web' | 'mobile' | 'auto';
}

// -------------------------------------------------------------
// 1. Shared Selection Panel UI Component
// -------------------------------------------------------------
interface MuiDateTimePickerPanelProps {
    type: 'date' | 'datetime-local';
    value: string;
    onConfirm: (val: string) => void;
    onCancel: () => void;
    sideBySide?: boolean;
}

function MuiDateTimePickerPanel({
    type,
    value,
    onConfirm,
    onCancel,
    sideBySide = false
}: MuiDateTimePickerPanelProps) {
    const [activeTab, setActiveTab] = useState<'date' | 'time'>('date');
    const [tempDate, setTempDate] = useState<Date>(new Date());
    const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
    const [showYearPicker, setShowYearPicker] = useState(false);

    // Scroll refs for time columns
    const hoursRef = useRef<HTMLDivElement>(null);
    const minutesRef = useRef<HTMLDivElement>(null);

    // Initialize temporary date state when panel mounts
    useEffect(() => {
        let initialDate = new Date();
        if (value) {
            const parsed = new Date(value);
            if (!isNaN(parsed.getTime())) {
                initialDate = parsed;
            }
        }
        setTempDate(initialDate);
        setCurrentMonth(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));
        setActiveTab('date');
        setShowYearPicker(false);
    }, [value]);

    // Center time scroll views to selected hours/minutes
    useEffect(() => {
        if (activeTab === 'time' || (sideBySide && type === 'datetime-local')) {
            const h = tempDate.getHours();
            const m = tempDate.getMinutes();
            const h12 = h % 12 === 0 ? 12 : h % 12;

            setTimeout(() => {
                if (hoursRef.current) {
                    const activeHourBtn = hoursRef.current.querySelector(`[data-hour="${h12}"]`);
                    if (activeHourBtn) {
                        activeHourBtn.scrollIntoView({ block: 'center', behavior: 'auto' });
                    }
                }
                if (minutesRef.current) {
                    const activeMinBtn = minutesRef.current.querySelector(`[data-minute="${m}"]`);
                    if (activeMinBtn) {
                        activeMinBtn.scrollIntoView({ block: 'center', behavior: 'auto' });
                    }
                }
            }, 50);
        }
    }, [activeTab, tempDate, sideBySide, type]);

    // Parse date parts
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // Calendar generation helpers
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay();

    const handlePrevMonth = () => {
        setCurrentMonth(new Date(year, month - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentMonth(new Date(year, month + 1, 1));
    };

    const handleSelectDay = (day: number) => {
        const nextTemp = new Date(tempDate);
        nextTemp.setFullYear(year);
        nextTemp.setMonth(month);
        nextTemp.setDate(day);
        setTempDate(nextTemp);

        if (type === 'date') {
            // For date picker only, we don't have a time tab
        } else if (!sideBySide) {
            // Auto switch to time selection tab for datetime picker for better wizard flow
            setTimeout(() => {
                setActiveTab('time');
            }, 180);
        }
    };

    const handleSelectYear = (y: number) => {
        setCurrentMonth(new Date(y, month, 1));
        const nextTemp = new Date(tempDate);
        nextTemp.setFullYear(y);
        setTempDate(nextTemp);
        setShowYearPicker(false);
    };

    const handleSelectHour = (h12: number) => {
        const isPM = tempDate.getHours() >= 12;
        let newH = h12 === 12 ? 0 : h12;
        if (isPM) newH += 12;

        const nextTemp = new Date(tempDate);
        nextTemp.setHours(newH);
        setTempDate(nextTemp);
    };

    const handleSelectMinute = (m: number) => {
        const nextTemp = new Date(tempDate);
        nextTemp.setMinutes(m);
        setTempDate(nextTemp);
    };

    const toggleAmPm = (amPm: 'AM' | 'PM') => {
        const currentH = tempDate.getHours();
        const isPM = currentH >= 12;
        let newH = currentH;

        if (amPm === 'AM' && isPM) {
            newH -= 12;
        } else if (amPm === 'PM' && !isPM) {
            newH += 12;
        }

        const nextTemp = new Date(tempDate);
        nextTemp.setHours(newH);
        setTempDate(nextTemp);
    };

    const handleConfirm = () => {
        let formatted = '';
        const yyyy = tempDate.getFullYear();
        const mm = String(tempDate.getMonth() + 1).padStart(2, '0');
        const dd = String(tempDate.getDate()).padStart(2, '0');

        if (type === 'date') {
            formatted = `${yyyy}-${mm}-${dd}`;
        } else {
            const hh = String(tempDate.getHours()).padStart(2, '0');
            const min = String(tempDate.getMinutes()).padStart(2, '0');
            formatted = `${yyyy}-${mm}-${dd}T${hh}:${min}`;
        }

        onConfirm(formatted);
    };

    // 12-hour values helper
    const get12HourAndPm = () => {
        const h = tempDate.getHours();
        const isPM = h >= 12;
        const h12 = h % 12 === 0 ? 12 : h % 12;
        const minStr = String(tempDate.getMinutes()).padStart(2, '0');
        return { h12, minStr, isPM };
    };

    const { h12, minStr, isPM } = get12HourAndPm();
    const currentYear = new Date().getFullYear();
    const yearsArray = Array.from({ length: 41 }, (_, i) => currentYear - 20 + i);

    // Dynamic views
    const calendarView = (
        <div className="flex-1 flex flex-col">
            {showYearPicker ? (
                <div className="flex-1 grid grid-cols-4 gap-2 overflow-y-auto max-h-[220px] py-1 select-none pr-1">
                    {yearsArray.map((y) => {
                        const isSelYear = y === currentMonth.getFullYear();
                        return (
                            <button
                                key={y}
                                type="button"
                                onClick={() => handleSelectYear(y)}
                                className={`py-2 text-xs font-bold rounded-lg transition-colors ${isSelYear
                                    ? 'bg-indigo-600 text-white font-extrabold shadow-sm'
                                    : 'hover:bg-slate-100 text-slate-700'
                                    }`}
                            >
                                {y}
                            </button>
                        );
                    })}
                </div>
            ) : (
                <div className="flex-1 flex flex-col">
                    <div className="flex items-center justify-between mb-3 shrink-0">
                        <button
                            type="button"
                            onClick={() => setShowYearPicker(true)}
                            className="flex items-center gap-1 text-slate-800 hover:text-indigo-600 text-xs font-extrabold px-2 py-1 rounded-lg hover:bg-slate-50 transition-colors uppercase tracking-wider"
                        >
                            {monthNames[month]} {year}
                            <span className="text-[8px] text-slate-400">▼</span>
                        </button>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={handlePrevMonth}
                                className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-indigo-600 rounded-full hover:bg-slate-100 transition-colors"
                            >
                                ◄
                            </button>
                            <button
                                type="button"
                                onClick={handleNextMonth}
                                className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-indigo-600 rounded-full hover:bg-slate-100 transition-colors"
                            >
                                ►
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-7 text-center text-[10px] font-bold text-slate-400 mb-2 shrink-0 select-none">
                        <span>S</span>
                        <span>M</span>
                        <span>T</span>
                        <span>W</span>
                        <span>T</span>
                        <span>F</span>
                        <span>S</span>
                    </div>

                    <div className="grid grid-cols-7 gap-y-1.5 text-center flex-1 items-center">
                        {Array.from({ length: firstDayIndex }).map((_, idx) => (
                            <div key={`empty-${idx}`} className="w-8 h-8" />
                        ))}

                        {Array.from({ length: daysInMonth }).map((_, idx) => {
                            const dayNum = idx + 1;
                            const isSelected =
                                tempDate.getFullYear() === year &&
                                tempDate.getMonth() === month &&
                                tempDate.getDate() === dayNum;

                            const isToday =
                                new Date().getFullYear() === year &&
                                new Date().getMonth() === month &&
                                new Date().getDate() === dayNum;

                            return (
                                <button
                                    key={`day-${dayNum}`}
                                    type="button"
                                    onClick={() => handleSelectDay(dayNum)}
                                    className={`w-8 h-8 mx-auto flex items-center justify-center text-xs font-semibold rounded-full transition-all focus:outline-none ${isSelected
                                        ? 'bg-indigo-600 text-white font-extrabold shadow-md scale-105'
                                        : isToday
                                            ? 'border border-indigo-600 text-indigo-600 font-bold'
                                            : 'hover:bg-slate-100 text-slate-800'
                                        }`}
                                >
                                    {dayNum}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );

    const timeView = (
        <div className="flex-1 flex flex-col justify-center">
            <div className="flex items-center justify-center gap-4 h-[180px]">
                <div className="flex flex-col items-center">
                    <span className="text-[9px] font-bold text-slate-400 mb-1 uppercase tracking-wide">Hour</span>
                    <div ref={hoursRef} className="w-14 h-[150px] overflow-y-auto border border-slate-100 rounded-lg py-1 scroll-none bg-slate-50/50">
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((hVal) => {
                            const isActive = h12 === hVal;
                            return (
                                <button
                                    key={`hr-${hVal}`}
                                    type="button"
                                    data-hour={hVal}
                                    onClick={() => handleSelectHour(hVal)}
                                    className={`w-full text-center py-1 text-xs font-bold transition-colors ${isActive
                                        ? 'bg-indigo-600 text-white shadow-xs font-extrabold'
                                        : 'hover:bg-slate-200 text-slate-700'
                                        }`}
                                >
                                    {String(hVal).padStart(2, '0')}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <span className="text-xl font-bold text-slate-400 mt-4 animate-pulse">:</span>

                <div className="flex flex-col items-center">
                    <span className="text-[9px] font-bold text-slate-400 mb-1 uppercase tracking-wide">Min</span>
                    <div ref={minutesRef} className="w-14 h-[150px] overflow-y-auto border border-slate-100 rounded-lg py-1 scroll-none bg-slate-50/50">
                        {Array.from({ length: 60 }, (_, i) => i).map((mVal) => {
                            const isActive = tempDate.getMinutes() === mVal;
                            return (
                                <button
                                    key={`min-${mVal}`}
                                    type="button"
                                    data-minute={mVal}
                                    onClick={() => handleSelectMinute(mVal)}
                                    className={`w-full text-center py-1 text-xs font-bold transition-colors ${isActive
                                        ? 'bg-indigo-600 text-white shadow-xs font-extrabold'
                                        : 'hover:bg-slate-200 text-slate-700'
                                        }`}
                                >
                                    {String(mVal).padStart(2, '0')}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="flex flex-col items-center">
                    <span className="text-[9px] font-bold text-slate-400 mb-1 uppercase tracking-wide">Period</span>
                    <div className="flex flex-col border border-slate-100 rounded-lg overflow-hidden bg-slate-50">
                        <button
                            type="button"
                            onClick={() => toggleAmPm('AM')}
                            className={`px-3 py-2 text-xs font-extrabold transition-colors ${!isPM
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'hover:bg-slate-200 text-slate-700'
                                }`}
                        >
                            AM
                        </button>
                        <button
                            type="button"
                            onClick={() => toggleAmPm('PM')}
                            className={`px-3 py-2 text-xs font-extrabold transition-colors ${isPM
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'hover:bg-slate-200 text-slate-700'
                                }`}
                        >
                            PM
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col w-full">
            {/* Header showing Selected State */}
            <div className="bg-indigo-600 px-6 py-5 text-white flex flex-col justify-between shrink-0">
                <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-200">
                    {type === 'date' ? 'Select Date' : 'Select Date & Time'}
                </span>
                <div className="flex items-baseline justify-between mt-1">
                    <div className="text-xl font-bold tracking-wide">
                        {tempDate.toLocaleString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' })}
                    </div>
                    {type === 'datetime-local' && (
                        <div className="text-xl font-bold tracking-wide text-indigo-100">
                            {h12}:{minStr} {isPM ? 'PM' : 'AM'}
                        </div>
                    )}
                </div>
            </div>

            {/* Content Body */}
            {sideBySide ? (
                <div className="flex flex-col sm:flex-row bg-white divide-y sm:divide-y-0 sm:divide-x divide-slate-100 min-h-[300px]">
                    {/* Left half: Calendar */}
                    <div className="p-5 w-full sm:w-[320px] flex flex-col justify-between">
                        {calendarView}
                    </div>

                    {/* Right half: Time selector */}
                    {type === 'datetime-local' && (
                        <div className="p-5 w-full sm:w-[280px] flex flex-col justify-between bg-slate-50/20">
                            {timeView}
                        </div>
                    )}
                </div>
            ) : (
                <>
                    {/* Wizards Navigation/Tabs (only in tabbed/mobile mode) */}
                    {type === 'datetime-local' && (
                        <div className="flex border-b border-slate-100 bg-slate-50 shrink-0 p-1">
                            <button
                                type="button"
                                onClick={() => { setActiveTab('date'); setShowYearPicker(false); }}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'date'
                                    ? 'bg-white text-indigo-600 shadow-xs'
                                    : 'text-slate-500 hover:text-slate-800'
                                    }`}
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                Date
                            </button>
                            <button
                                type="button"
                                onClick={() => { setActiveTab('time'); setShowYearPicker(false); }}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'time'
                                    ? 'bg-white text-indigo-600 shadow-xs'
                                    : 'text-slate-500 hover:text-slate-800'
                                    }`}
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Time
                            </button>
                        </div>
                    )}

                    <div className="p-4 bg-white min-h-[280px] flex flex-col justify-between">
                        {activeTab === 'date' ? calendarView : timeView}
                    </div>
                </>
            )}

            {/* Modal Action Buttons */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4 bg-slate-50/50 shrink-0">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={handleConfirm}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm hover:shadow-md transition-all active:scale-95"
                >
                    OK
                </button>
            </div>
        </div>
    );
}

// -------------------------------------------------------------
// 2. Shared Trigger Input Button
// -------------------------------------------------------------
interface MuiDateTimePickerInputProps {
    label: string;
    value: string;
    onClick: () => void;
    type: 'date' | 'datetime-local';
    required?: boolean;
    size?: 'small' | 'medium';
    disabled?: boolean;
    isOpen: boolean;
}

function MuiDateTimePickerInput({
    label,
    value,
    onClick,
    type,
    required = false,
    size = 'medium',
    disabled = false,
    isOpen
}: MuiDateTimePickerInputProps) {
    const isSmall = size === 'small';

    const formatDisplay = () => {
        if (!value) return '';
        const dateObj = new Date(value);
        if (isNaN(dateObj.getTime())) return '';

        const options: Intl.DateTimeFormatOptions = {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        };

        if (type === 'datetime-local') {
            options.hour = '2-digit';
            options.minute = '2-digit';
        }

        return dateObj.toLocaleString('en-IN', { ...options, timeZone: 'Asia/Kolkata' });
    };

    return (
        <div
            className={`w-full relative transition-all duration-200 bg-transparent ${isSmall ? 'rounded-xl' : 'rounded-2xl'
                } border ${isOpen
                    ? 'border-indigo-600 ring-2 ring-indigo-600/15'
                    : disabled
                        ? 'border-slate-100 bg-slate-50/50'
                        : 'border-slate-200 hover:border-slate-400'
                }`}
        >
            {/* Floating Badge Label */}
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
                onClick={() => !disabled && onClick()}
                disabled={disabled}
                className={`w-full flex items-center justify-between bg-transparent text-left font-medium text-slate-900 focus:outline-none transition-all duration-200 ${isSmall
                    ? 'text-xs pl-3 pr-7 py-1.5 rounded-xl'
                    : 'text-sm pl-4 pr-10 py-2.5 rounded-2xl'
                    } ${disabled ? 'cursor-not-allowed opacity-50 text-slate-400' : 'cursor-pointer'}`}
                style={isSmall ? { minHeight: '32px' } : { minHeight: '42px' }}
            >
                <span className={`truncate ${value ? 'text-slate-900 font-semibold' : 'text-slate-400'} ${disabled ? 'text-slate-400 font-normal' : ''}`}>
                    {formatDisplay() || (isSmall ? 'Choose' : `Select ${label}`)}
                </span>

                {/* DateTime Helper Adornment Icon */}
                <span
                    className={`absolute shrink-0 text-slate-400 transition-all duration-200 pointer-events-none ${isSmall ? 'right-3' : 'right-4'
                        } ${isOpen ? 'text-indigo-600' : ''}`}
                >
                    {type === 'date' ? (
                        <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    ) : (
                        <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    )}
                </span>
            </button>
        </div>
    );
}

// -------------------------------------------------------------
// 3. Web-Compatible Date Time Picker Component
// -------------------------------------------------------------
export function MuiDateTimePickerWeb({
    label,
    value,
    onChange,
    type = 'datetime-local',
    className = '',
    id,
    required = false,
    size = 'medium',
    disabled = false
}: MuiDateTimePickerProps) {
    const [isOpen, setIsOpen] = useState(false);

    // Close on click outside modal card backdrop overlay
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            const target = event.target as HTMLElement;
            if (target.classList.contains('mui-picker-backdrop')) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div className={`relative ${className}`} id={id}>
            <MuiDateTimePickerInput
                label={label}
                value={value}
                onClick={() => setIsOpen(true)}
                type={type}
                required={required}
                size={size}
                disabled={disabled}
                isOpen={isOpen}
            />

            {/* Centered spacious Web Modal Overlay (Perfect for Desktop nested forms!) */}
            {isOpen && (
                <div className="fixed inset-0 mui-picker-backdrop bg-black/40 backdrop-blur-xs z-[100] flex items-center justify-center p-4 animate-fade-in">
                    <div
                        className={`bg-white rounded-3xl overflow-hidden flex flex-col shadow-2xl ring-1 ring-black/5 animate-scale-up ${type === 'datetime-local'
                            ? 'w-full max-w-[320px] sm:max-w-[620px]'
                            : 'w-full max-w-[320px] sm:max-w-[340px]'
                            }`}
                    >
                        <MuiDateTimePickerPanel
                            type={type}
                            value={value}
                            sideBySide={type === 'datetime-local'}
                            onConfirm={(val) => {
                                onChange(val);
                                setIsOpen(false);
                            }}
                            onCancel={() => setIsOpen(false)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

// -------------------------------------------------------------
// 4. Mobile-Compatible Date Time Picker Component
// -------------------------------------------------------------
export function MuiDateTimePickerMobile({
    label,
    value,
    onChange,
    type = 'datetime-local',
    className = '',
    id,
    required = false,
    size = 'medium',
    disabled = false
}: MuiDateTimePickerProps) {
    const [isOpen, setIsOpen] = useState(false);

    // Close on click outside modal card backdrop overlay
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            const target = event.target as HTMLElement;
            if (target.classList.contains('mui-picker-backdrop')) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div className={`relative ${className}`} id={id}>
            <MuiDateTimePickerInput
                label={label}
                value={value}
                onClick={() => setIsOpen(true)}
                type={type}
                required={required}
                size={size}
                disabled={disabled}
                isOpen={isOpen}
            />

            {/* Centered touch-friendly Mobile Modal Overlay */}
            {isOpen && (
                <div className="fixed inset-0 mui-picker-backdrop bg-black/50 backdrop-blur-xs z-[100] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-[340px] overflow-hidden flex flex-col shadow-2xl ring-1 ring-black/5 animate-scale-up">
                        <MuiDateTimePickerPanel
                            type={type}
                            value={value}
                            sideBySide={false}
                            onConfirm={(val) => {
                                onChange(val);
                                setIsOpen(false);
                            }}
                            onCancel={() => setIsOpen(false)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

// -------------------------------------------------------------
// 5. Unified Responsive Date Time Picker Component (Default)
// -------------------------------------------------------------
export function MuiDateTimePicker(props: MuiDateTimePickerProps) {
    const isMobile = useIsMobile();
    const { variant = 'auto' } = props;

    // Determine target mode dynamically
    const isMobileMode = variant === 'mobile' || (variant === 'auto' && isMobile);

    if (isMobileMode) {
        return <MuiDateTimePickerMobile {...props} />;
    }

    return <MuiDateTimePickerWeb {...props} />;
}
