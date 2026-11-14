import { matchProducts } from "../helpers/productMatch";
import { RECENT_LIMIT, RecentCounts } from "../helpers/recentSold";

export function useProductSearch(
  shopProducts: any[],
  products: any[],
  saleData: any,
  productSearches: string[],
  selectedIndices: number[],
  setSelectedIndices: React.Dispatch<React.SetStateAction<number[]>>,
  showProductDropdowns: boolean[],
  setShowProductDropdowns: React.Dispatch<React.SetStateAction<boolean[]>>,
  recentCounts: RecentCounts = {},
) {
  const getFilteredProducts = (index: number) => {
    const searchTerm = productSearches[index]?.toLowerCase() || "";
    const currentProductName =
      saleData.items[index]?.productName?.toLowerCase() || "";
    const source = saleData.shopId ? shopProducts : products;

    // Filter out products already selected in other rows
    const availableSource = source.filter(
      (product) =>
        !saleData.items.some(
          (item: any, i: number) =>
            i !== index && item.productId === product.id.toString(),
        ),
    );

    const matched =
      searchTerm === "" || searchTerm === currentProductName
        ? availableSource
        : matchProducts(searchTerm, availableSource, { limit: 50 });

    // No Recent section without a shop (counts are per shop).
    if (!saleData.shopId || saleData.shopId === "ALL") return matched.slice(0, 50);

    // Recent = this user's 10 most-sold products in this shop (ties by name). A product
    // is in exactly one section. Out-of-stock ones stay visible but flagged (_outOfStock).
    const topIds = new Set(
      source
        .filter((p) => (recentCounts[String(p.id)] ?? 0) > 0)
        .sort((a, b) => (recentCounts[String(b.id)] ?? 0) - (recentCounts[String(a.id)] ?? 0) || String(a.name).localeCompare(String(b.name)))
        .slice(0, RECENT_LIMIT)
        .map((p) => String(p.id)),
    );
    const recent = matched
      .filter((p) => topIds.has(String(p.id)))
      .sort((a, b) => (recentCounts[String(b.id)] ?? 0) - (recentCounts[String(a.id)] ?? 0) || String(a.name).localeCompare(String(b.name)))
      .map((p) => ({ ...p, _section: "recent", _soldCount: recentCounts[String(p.id)] ?? 0, _outOfStock: (p.shopStock ?? 1) <= 0 }));
    const rest = matched.filter((p) => !topIds.has(String(p.id))).slice(0, 50);
    return recent.length === 0 ? rest : [...recent, ...rest.map((p) => ({ ...p, _section: "all" }))];
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent,
    handleProductSelect: (idx: number, id: string) => void,
  ) => {
    if (!showProductDropdowns[index]) return;
    const filteredProducts = getFilteredProducts(index);
    const currentSelected = selectedIndices[index];

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndices((prev) => {
          const copy = [...prev];
          copy[index] =
            currentSelected < filteredProducts.length - 1
              ? currentSelected + 1
              : 0;
          return copy;
        });
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndices((prev) => {
          const copy = [...prev];
          copy[index] =
            currentSelected > 0
              ? currentSelected - 1
              : filteredProducts.length - 1;
          return copy;
        });
        break;
      case "Enter":
        e.preventDefault();
        if (currentSelected >= 0 && filteredProducts[currentSelected] && !filteredProducts[currentSelected]._outOfStock) {
          handleProductSelect(
            index,
            filteredProducts[currentSelected].id.toString(),
          );
        }
        break;
      case "Escape":
        setShowProductDropdowns((prev) => {
          const copy = [...prev];
          copy[index] = false;
          return copy;
        });
        break;
    }
  };

  return { getFilteredProducts, handleKeyDown };
}
