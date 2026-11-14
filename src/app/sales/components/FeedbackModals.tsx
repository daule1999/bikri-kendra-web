import React from 'react';
import { isAndroidDevice, isSmsEnabledForCurrentUser } from '@/lib/smsUtils';

interface FeedbackModalsProps {
    showSuccessModal: boolean;
    successMessage: string;
    receiptData: any;
    billData: any;
    onPrintBill: (bill: any) => void;
    onSendSms: (bill: any) => void;
    onCloseSuccess: () => void;
    showErrorModal: boolean;
    errorMessage: string;
    errorRedirect: boolean;
    onCloseError: () => void;
    isMobile: boolean;
}

const CheckCircleIcon = () => (
    <svg className="w-12 h-12 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const XCircleIcon = () => (
    <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const PrintIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
    </svg>
);

const SmsIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8-1.208 0-2.360-.214-3.410-.603L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
);

export function FeedbackModals({
    showSuccessModal, successMessage, receiptData, billData, onPrintBill, onSendSms, onCloseSuccess,
    showErrorModal, errorMessage, errorRedirect, onCloseError, isMobile
}: FeedbackModalsProps) {
    const successOkRef    = React.useRef<HTMLButtonElement>(null);
    const generateBillRef = React.useRef<HTMLButtonElement>(null);
    const errorOkRef      = React.useRef<HTMLButtonElement>(null);

    React.useEffect(() => {
        if (showSuccessModal) {
            const t = setTimeout(() => successOkRef.current?.focus(), 60);
            return () => clearTimeout(t);
        }
    }, [showSuccessModal]);

    React.useEffect(() => {
        if (showErrorModal) {
            const t = setTimeout(() => errorOkRef.current?.focus(), 60);
            return () => clearTimeout(t);
        }
    }, [showErrorModal]);

    const handleSuccessKey = (e: React.KeyboardEvent) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            if (!receiptData) return;
            const current = document.activeElement;
            if (current === successOkRef.current) generateBillRef.current?.focus();
            else successOkRef.current?.focus();
        }
    };

    const handleErrorKey = (e: React.KeyboardEvent) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            errorOkRef.current?.focus();
        }
    };

    return (
        <>
            {showSuccessModal && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                    onKeyDown={handleSuccessKey}
                >
                    <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl ring-1 ring-black/5 overflow-hidden">
                        {/* Colored top strip */}
                        <div className="h-1.5 bg-gradient-to-r from-emerald-400 to-emerald-600" />
                        <div className="p-6 text-center">
                            <div className="flex justify-center mb-3">
                                <CheckCircleIcon />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 mb-1">Sale Complete</h3>
                            <p className="text-sm text-slate-500 mb-5">{successMessage}</p>
                            <div className="flex gap-3 justify-center">
                                {receiptData ? (
                                    <>
                                        <button
                                            ref={generateBillRef}
                                            tabIndex={-1}
                                            onClick={() => onPrintBill(billData)}
                                            className="flex items-center gap-2 px-4 py-2.5 bg-sky-50 border border-sky-200 text-sky-700 rounded-xl text-sm font-bold hover:bg-sky-100 transition-all focus:outline-none focus:ring-2 focus:ring-sky-400"
                                        >
                                            <PrintIcon /> Print Bill
                                        </button>
                                        {/* Android-only, and limited to usernames containing "daule". */}
                                        {isAndroidDevice() && isSmsEnabledForCurrentUser() && (
                                            <button
                                                tabIndex={-1}
                                                onClick={() => onSendSms(billData)}
                                                className="flex items-center gap-2 px-4 py-2.5 bg-violet-50 border border-violet-200 text-violet-700 rounded-xl text-sm font-bold hover:bg-violet-100 transition-all focus:outline-none focus:ring-2 focus:ring-violet-400"
                                            >
                                                <SmsIcon /> Send SMS
                                            </button>
                                        )}
                                        <button
                                            ref={successOkRef}
                                            tabIndex={-1}
                                            onClick={onCloseSuccess}
                                            className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400"
                                        >
                                            Done
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        ref={successOkRef}
                                        tabIndex={-1}
                                        onClick={onCloseSuccess}
                                        className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400"
                                    >
                                        Done
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showErrorModal && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                    onKeyDown={handleErrorKey}
                >
                    <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl ring-1 ring-black/5 overflow-hidden">
                        {/* Colored top strip */}
                        <div className="h-1.5 bg-gradient-to-r from-red-400 to-red-600" />
                        <div className="p-6 text-center">
                            <div className="flex justify-center mb-3">
                                <XCircleIcon />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 mb-1">Something went wrong</h3>
                            <p className="text-sm text-slate-500 mb-5">{errorMessage}</p>
                            <button
                                ref={errorOkRef}
                                tabIndex={-1}
                                onClick={onCloseError}
                                className="px-6 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-all focus:outline-none focus:ring-2 focus:ring-red-400"
                            >
                                {errorRedirect ? 'Go to Shift Management' : 'OK'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
