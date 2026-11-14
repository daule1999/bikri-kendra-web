import { useCallback } from 'react';

export function useKeyboardNavigation(saleData: any, addItem: () => void) {

    // ─── Focus the first field at Point 1 ───────────────────────────────────────
    const focusPoint1 = useCallback(() => {
        const shopWrapper = document.querySelector<HTMLElement>('[data-focusable="shop-select"]');
        const shopInput = shopWrapper?.querySelector<HTMLElement>('input:not([disabled]), select:not([disabled])');
        const isShopDisabled =
            shopWrapper?.hasAttribute('data-shop-locked') ||
            shopWrapper?.querySelector('input[disabled], select[disabled]') != null ||
            shopWrapper?.querySelector('[aria-disabled="true"]') != null;

        if (shopInput && !isShopDisabled) {
            shopInput.focus();
        } else {
            const customerNameInput = document.querySelector<HTMLInputElement>('input[name="customerName"]');
            if (customerNameInput) customerNameInput.focus();
        }
    }, []);

    // ─── Backspace navigation (Shift+Backspace) ──────────────────────────────────
    const handleBackspaceNavigation = useCallback(
        (e: React.KeyboardEvent, currentField: string, index?: number) => {
            if (e.key === 'Backspace' && e.shiftKey) {
                const target = e.target as HTMLInputElement;
                if (target.value === '' && target.selectionStart === 0) {
                    e.preventDefault();

                    if (currentField === 'quantity' && index !== undefined) {
                        const productInput = document.querySelector<HTMLInputElement>(
                            `input[data-item-index="${index}"]`
                        );
                        if (productInput) productInput.focus();

                    } else if (currentField === 'product' && index !== undefined && index > 0) {
                        const prevQtyInput = document.querySelector<HTMLInputElement>(
                            `input[data-quantity-index="${index - 1}"]`
                        );
                        if (prevQtyInput) prevQtyInput.focus();

                    } else if (currentField === 'product' && index === 0) {
                        const mobileInput = document.querySelector<HTMLInputElement>('input[name="customerMobile"]');
                        if (mobileInput) mobileInput.focus();

                    } else if (currentField === 'cashReceived') {
                        const lastIndex = saleData.items.length - 1;
                        const lastQtyInput = document.querySelector<HTMLInputElement>(
                            `input[data-quantity-index="${lastIndex}"]`
                        );
                        if (lastQtyInput) lastQtyInput.focus();

                    } else if (currentField === 'customerMobile') {
                        const customerNameInput = document.querySelector<HTMLInputElement>('input[name="customerName"]');
                        if (customerNameInput) customerNameInput.focus();

                    } else if (currentField === 'customerName') {
                        const shopInput = document.querySelector<HTMLElement>(
                            '[data-focusable="shop-select"] input:not([disabled]), [data-focusable="shop-select"] select:not([disabled])'
                        );
                        if (shopInput) shopInput.focus();
                    }
                }
            }
        },
        // ✅ FIX: use saleData.items.length (primitive) — not saleData.items (object ref)
        // This prevents stale closures when items are added/removed.
        [saleData.items.length]
    );

    // ─── Shift+Tab on Customer Name → Shop (only if shop is in Tab sequence) ────
    // Uses [tabindex="1"] selector: in fullscreen mode the MuiSelect trigger has
    // tabIndex=-1, so no element matches and we skip the prevent+focus. The active
    // form trap then fires and blocks Shift+Tab at the first allowed element.
    const handleCustomerNameShiftTab = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Tab' && e.shiftKey) {
            const shopEl = document.querySelector<HTMLElement>('[tabindex="1"]');
            if (shopEl) {
                e.preventDefault();
                shopEl.focus();
            }
            // No prevent default here in fullscreen — active trap handles it.
        }
    }, []);

    // ─── Shift+Tab on first Product row → Customer Mobile ───────────────────────
    const handleProductRowShiftTab = useCallback((index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Tab' && e.shiftKey && index === 0) {
            e.preventDefault();
            const mobileInput = document.querySelector<HTMLInputElement>('input[name="customerMobile"]');
            if (mobileInput) mobileInput.focus();
        }
    }, []);

    // ─── Form-level key handlers (Ctrl+N, Ctrl+S, Alt+P, Alt+S) ────────────────
    const handleFormKeyDown = useCallback(
        (e: React.KeyboardEvent, handlePreviewClick: () => void) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'n' || e.key === 'F2')) {
                e.preventDefault();
                addItem();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                const form = e.currentTarget as HTMLFormElement;
                form.requestSubmit();
            }
            if (e.altKey && e.key.toLowerCase() === 'p') {
                e.preventDefault();
                handlePreviewClick();
            }
            // Alt+S — jump to Shop selector from anywhere in the form.
            // Works even in fullscreen mode (where the shop has tabIndex=-1 and
            // is excluded from Tab order, but is still focusable directly).
            if (e.altKey && e.key.toLowerCase() === 's') {
                e.preventDefault();
                const shopBtn = document.querySelector<HTMLElement>(
                    '[data-focusable="shop-select"] button:not([disabled])'
                );
                if (shopBtn) shopBtn.focus();
            }
        },
        [addItem]
    );

    // ─── Quantity key handler ────────────────────────────────────────────────────
    const handleQuantityKeyDown = useCallback(
        (index: number, e: React.KeyboardEvent) => {
            // Forward Tab: active trap handles Qty (11+i*3) → Remove (12+i*3) automatically.
            // The old manual "last-row Qty → Add Item" jump is no longer needed because the
            // Remove button is now tabIndex=12+i*3, which is the next slot in the sequence.
            // After Remove, the active trap continues: last-row Remove → Add Item (50).

            // Shift+Tab on Qty → go back to the same row's Product input
            if (e.key === 'Tab' && e.shiftKey) {
                e.preventDefault();
                const productInput = document.querySelector<HTMLInputElement>(
                    `input[data-item-index="${index}"]`
                );
                if (productInput) productInput.focus();
            }
        },
        [saleData.items.length]
    );

    // ─── Delete row shortcut (Shift+Delete) ─────────────────────────────────────
    const handleDeleteRowShortcut = useCallback(
        (index: number, e: React.KeyboardEvent, removeItem: (idx: number) => void) => {
            if (e.shiftKey && e.key === 'Delete') {
                e.preventDefault();
                removeItem(index);
                setTimeout(() => {
                    const focusIndex = Math.max(0, index - 1);
                    const fallbackInput = document.querySelector<HTMLInputElement>(
                        `input[data-item-index="${focusIndex}"]`
                    );
                    if (fallbackInput) fallbackInput.focus();
                }, 0);
            }
        },
        []
    );

    // ─── Print button Tab → loop back to Point 1 ────────────────────────────────
    const handlePrintButtonKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Tab' && !e.shiftKey) {
                e.preventDefault();
                focusPoint1();
            }
        },
        [focusPoint1]
    );

    // ─── Add Item button: Tab → expand payment section + focus CASH mode button ──
    // Without this, Tab from Add Item (50) goes naturally to the next ascending tabIndex.
    // With payment modes renumbered to 51/52/53, this now works via natural order too,
    // but we still need to expand the section on mobile before Tab reaches the inputs (54+).
    const handleAddItemKeyDown = useCallback(
        (e: React.KeyboardEvent, setPaymentExpanded: (b: boolean) => void) => {
            if (e.key === 'Tab' && !e.shiftKey) {
                e.preventDefault();
                setPaymentExpanded(true);
                setTimeout(() => {
                    // CASH button has tabIndex=51; focus it directly
                    const cashBtn = document.querySelector<HTMLButtonElement>('[tabindex="51"]');
                    if (cashBtn) cashBtn.focus();
                }, 30);
            }
        },
        []
    );

    // ─── Cash Received Tab → skip Change div, go to Preview ─────────────────────
    const handleCashReceivedKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Tab' && !e.shiftKey) {
            e.preventDefault();
            const previewBtn = document.querySelector<HTMLButtonElement>('button[data-action="preview"]');
            if (previewBtn) previewBtn.focus();
        }
    }, []);

    // ─── ONLINE mode Reference ID Tab → Preview ──────────────────────────────────
    const handleOnlineRefKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Tab' && !e.shiftKey) {
            e.preventDefault();
            const previewBtn = document.querySelector<HTMLButtonElement>('button[data-action="preview"]');
            if (previewBtn) previewBtn.focus();
        }
    }, []);

    // ─── BOTH mode Online Reference Tab → Preview ────────────────────────────────
    const handleBothOnlineRefKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Tab' && !e.shiftKey) {
            e.preventDefault();
            const previewBtn = document.querySelector<HTMLButtonElement>('button[data-action="preview"]');
            if (previewBtn) previewBtn.focus();
        }
    }, []);

    return {
        handleBackspaceNavigation,
        handleFormKeyDown,
        handleQuantityKeyDown,
        handleAddItemKeyDown,
        handleDeleteRowShortcut,
        handlePrintButtonKeyDown,
        handleCashReceivedKeyDown,
        handleOnlineRefKeyDown,
        handleBothOnlineRefKeyDown,
        handleCustomerNameShiftTab,
        handleProductRowShiftTab,
        focusPoint1,
    };
}
