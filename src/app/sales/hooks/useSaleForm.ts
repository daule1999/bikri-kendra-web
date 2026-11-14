import { useState } from "react";

export function useSaleForm() {
  const [saleData, setSaleData] = useState({
    shopId: "",
    customerName: "",
    customerMobile: "",
    cashReceived: "",
    paymentMode: "CASH" as "CASH" | "ONLINE" | "BOTH",
    cashAmount: "",
    onlineAmount: "",
    paymentReference: "",
    items: [
      {
        productId: "",
        productName: "",
        productSku: "",
        hsnCode: "1",
        quantity: "",
        mrp: "",
        sellingPrice: "",
        discount: "",
      },
    ],
  });

  const [productSearches, setProductSearches] = useState<string[]>([""]);
  const [showProductDropdowns, setShowProductDropdowns] = useState<boolean[]>([
    false,
  ]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([-1]);
  const [dropdownOpenUpwards, setDropdownOpenUpwards] = useState<boolean[]>([
    false,
  ]);
  const [paymentExpanded, setPaymentExpanded] = useState(false);
  const [qtyPristine, setQtyPristine] = useState<boolean[]>([true]);
  const clearQtyPristine = (index: number) => {
    setQtyPristine((prev) => {
      if (!prev[index]) return prev;
      const copy = [...prev];
      copy[index] = false;
      return copy;
    });
  };

  const addItem = () => {
    const newIndex = saleData.items.length;
    setSaleData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          productId: "",
          productName: "",
          productSku: "",
          hsnCode: "1",
          quantity: "",
          mrp: "",
          sellingPrice: "",
          discount: "",
        },
      ],
    }));
    setProductSearches((prev) => [...prev, ""]);
    setShowProductDropdowns((prev) => [...prev, false]);
    setDropdownOpenUpwards((prev) => [...prev, false]);
    setQtyPristine((prev) => [...prev, true]);

    setTimeout(() => {
      const newItemInput = document.querySelector(
        `input[data-item-index="${newIndex}"]`,
      ) as HTMLInputElement;
      if (newItemInput) {
        newItemInput.focus();
        newItemInput.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);
  };

  const removeItem = (index: number) => {
    setSaleData((prev) => {
      let newItems = prev.items.filter((_: any, i: number) => i !== index);
      if (newItems.length === 0)
        newItems = [
          {
            productId: "",
            productName: "",
            productSku: "",
            hsnCode: "1",
            quantity: "",
            mrp: "",
            sellingPrice: "",
            discount: "",
          },
        ];
      return { ...prev, items: newItems };
    });
    setProductSearches((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length === 0 ? [""] : next;
    });
    setShowProductDropdowns((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length === 0 ? [false] : next;
    });
    setDropdownOpenUpwards((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length === 0 ? [false] : next;
    });
    setQtyPristine((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length === 0 ? [true] : next;
    });
  };

  const updateItem = (index: number, field: string, value: string) => {
    setSaleData((prev) => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      return { ...prev, items: newItems };
    });
  };

  const quickAddProduct = (
    product: any,
    setErrorMessage: any,
    setShowErrorModal: any,
    setActiveTab: any,
  ) => {
    if ((product.shopStock || 0) <= 0) {
      setErrorMessage(`"${product.name}" is out of stock at this counter`);
      setShowErrorModal(true);
      return;
    }

    const existingIndex = saleData.items.findIndex(
      (item) => item.productId === product.id.toString(),
    );
    if (existingIndex !== -1) {
      const newItems = [...saleData.items];
      const currentQty = parseInt(newItems[existingIndex].quantity) || 0;
      const newQty = currentQty + 1;

      if (newQty > (product.shopStock || 0)) {
        setErrorMessage(
          `Cannot add more of "${product.name}". Max counter stock is ${product.shopStock}.`,
        );
        setShowErrorModal(true);
        return;
      }

      newItems[existingIndex] = {
        ...newItems[existingIndex],
        quantity: newQty.toString(),
      };
      setSaleData((prev) => ({ ...prev, items: newItems }));

      setTimeout(() => {
        const qtyInput = document.querySelector(
          `input[data-quantity-index="${existingIndex}"]`,
        ) as HTMLInputElement;
        if (qtyInput) qtyInput.focus();
      }, 50);

      setActiveTab("sale");
      return;
    }

    const emptyIndex = saleData.items.findIndex((item) => !item.productId);
    if (emptyIndex !== -1) {
      const newItems = [...saleData.items];
      newItems[emptyIndex] = {
        productId: product.id.toString(),
        productName: product.name,
        productSku: product.sku || "",
        hsnCode: "1",
        quantity: "1",
        mrp: product.mrp?.toString() || "",
        sellingPrice: product.sellingPrice?.toString() || "",
        discount: product.discount?.toString() || "",
      };
      setSaleData((prev) => ({ ...prev, items: newItems }));
      const newSearches = [...productSearches];
      newSearches[emptyIndex] = product.name;
      setProductSearches(newSearches);
      // Quantity was just freshly defaulted to '1' for this row — clear-on-first-focus applies.
      setQtyPristine((prev) => {
        const copy = [...prev];
        copy[emptyIndex] = true;
        return copy;
      });
      setTimeout(() => {
        const qtyInput = document.querySelector(
          `input[data-quantity-index="${emptyIndex}"]`,
        ) as HTMLInputElement;
        if (qtyInput) qtyInput.focus();
      }, 50);
    } else {
      const newIndex = saleData.items.length;
      setSaleData((prev) => ({
        ...prev,
        items: [
          ...prev.items,
          {
            productId: product.id.toString(),
            productName: product.name,
            productSku: product.sku || "",
            hsnCode: "1",
            quantity: "1",
            mrp: product.mrp?.toString() || "",
            sellingPrice: product.sellingPrice?.toString() || "",
            discount: product.discount?.toString() || "",
          },
        ],
      }));
      setProductSearches((prev) => [...prev, product.name]);
      setShowProductDropdowns((prev) => [...prev, false]);
      setDropdownOpenUpwards((prev) => [...prev, false]);
      setQtyPristine((prev) => [...prev, true]);
      setTimeout(() => {
        const qtyInput = document.querySelector(
          `input[data-quantity-index="${newIndex}"]`,
        ) as HTMLInputElement;
        if (qtyInput) qtyInput.focus();
      }, 50);
    }
    setActiveTab("sale");
  };

  const resetForm = (keepShopId?: string) => {
    const shopId = keepShopId ?? saleData.shopId;
    setSaleData({
      shopId,
      customerName: "",
      customerMobile: "",
      cashReceived: "",
      paymentMode: "CASH",
      cashAmount: "",
      onlineAmount: "",
      paymentReference: "",
      items: [
        {
          productId: "",
          productName: "",
          productSku: "",
          hsnCode: "1",
          quantity: "",
          mrp: "",
          sellingPrice: "",
          discount: "",
        },
      ],
    });
    setProductSearches([""]);
    setShowProductDropdowns([false]);
    setSelectedIndices([-1]);
    setDropdownOpenUpwards([false]);
    setQtyPristine([true]);
  };

  const calculateTotal = () =>
    saleData.items
      .reduce(
        (total, item) =>
          total +
          (parseFloat(item.quantity) || 0) *
            (parseFloat(item.sellingPrice) || 0),
        0,
      )
      .toFixed(2);

  const calculateChange = () => {
    const total = parseFloat(calculateTotal());
    const received =
      saleData.paymentMode === "CASH"
        ? parseFloat(saleData.cashReceived) || 0
        : (parseFloat(saleData.cashAmount) || 0) +
          (parseFloat(saleData.onlineAmount) || 0);
    return received >= total ? (received - total).toFixed(2) : "0.00";
  };

  const isPaymentValid = () => {
    const total = parseFloat(calculateTotal());
    if (total <= 0) return true;
    if (saleData.paymentMode === "CASH")
      return (parseFloat(saleData.cashReceived) || 0) >= total;
    if (saleData.paymentMode === "ONLINE")
      return saleData.paymentReference.trim() !== "";
    if (saleData.paymentMode === "BOTH")
      return (
        (parseFloat(saleData.cashAmount) || 0) +
          (parseFloat(saleData.onlineAmount) || 0) >=
          total && saleData.paymentReference.trim() !== ""
      );
    return false;
  };

  return {
    saleData,
    setSaleData,
    productSearches,
    setProductSearches,
    showProductDropdowns,
    setShowProductDropdowns,
    selectedIndices,
    setSelectedIndices,
    dropdownOpenUpwards,
    setDropdownOpenUpwards,
    paymentExpanded,
    setPaymentExpanded,
    qtyPristine,
    setQtyPristine,
    clearQtyPristine,
    addItem,
    removeItem,
    updateItem,
    quickAddProduct,
    resetForm,
    calculateTotal,
    calculateChange,
    isPaymentValid,
  };
}
