export const validateSaleForm = (
  saleData: any,
  setErrorMessage: any,
  setShowErrorModal: any,
) => {
  if (!saleData.shopId || saleData.shopId === "ALL") {
    setErrorMessage("Please select a specific shop before processing a sale");
    setShowErrorModal(true);
    return false;
  }

  // Mobile is optional, but if provided must be exactly 10 digits
  if (saleData.customerMobile && !/^\d{10}$/.test(saleData.customerMobile)) {
    setErrorMessage("Customer mobile must be exactly 10 digits (numbers only)");
    setShowErrorModal(true);
    return false;
  }

  const hasAnyProduct = saleData.items.some((item: any) => item.productId);

  if (!hasAnyProduct) {
    setErrorMessage("Please add at least one item to the sale");
    setShowErrorModal(true);
    return false;
  }

  const hasIncompleteRow = saleData.items.some((item: any) => {
    const qty = parseInt(item.quantity);
    return !item.productId || isNaN(qty) || qty < 1;
  });

  if (hasIncompleteRow) {
    setErrorMessage(
      "Please complete or remove any empty/incomplete item rows before proceeding",
    );
    setShowErrorModal(true);
    return false;
  }

  return true;
};

export const hasStockOverdraft = (saleData: any, shopProducts: any[]) => {
  const quantitiesByProduct: Record<string, number> = {};
  saleData.items.forEach((item: any) => {
    if (item.productId) {
      const qty = parseInt(item.quantity) || 0;
      quantitiesByProduct[item.productId] =
        (quantitiesByProduct[item.productId] || 0) + qty;
    }
  });

  return Object.keys(quantitiesByProduct).some((productId) => {
    const stock =
      shopProducts.find((p: any) => p.id.toString() === productId)?.shopStock ||
      0;
    return quantitiesByProduct[productId] > stock;
  });
};

export const hasNoValidItems = (saleData: any) => {
  // At least one row must have a productId with qty >= 1
  const hasValid = saleData.items.some(
    (item: any) => item.productId && parseInt(item.quantity) > 0,
  );
  if (!hasValid) return true;

  return saleData.items.some((item: any) => {
    const qty = parseInt(item.quantity);
    return !item.productId || isNaN(qty) || qty < 1;
  });
};
