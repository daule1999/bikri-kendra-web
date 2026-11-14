const MIN_FUZZY_LENGTH = 2;

function subsequenceScore(term: string, text: string): number | null {
  if (!term) return 0;
  if (!text) return null;

  let termIndex = 0;
  let firstMatchIndex = -1;
  let lastMatchIndex = -1;
  let gapTotal = 0;

  for (let i = 0; i < text.length && termIndex < term.length; i++) {
    if (text[i] === term[termIndex]) {
      if (firstMatchIndex === -1) firstMatchIndex = i;
      if (lastMatchIndex !== -1) gapTotal += i - lastMatchIndex - 1;
      lastMatchIndex = i;
      termIndex++;
    }
  }

  if (termIndex < term.length) return null; // not all characters found, in order

  return firstMatchIndex + gapTotal;
}

export interface MatchProductsOptions {
  nameKey?: string;
  skuKey?: string;
  limit?: number;
}

/**
 * Tiered "like" search shared by the Sale tab (useProductSearch) and the
 * Catalog tab search bar.
 *
 * Tier 1: exact substring match on name/sku (fastest, most predictable).
 * Tier 2: subsequence/abbreviation fuzzy match (e.g. "sabd" -> "Shabd",
 *         "agv" -> "Angvastra"), only applied once the term is long enough
 *         and only over products the substring pass didn't already match.
 *
 * Returns the full source list (up to `limit`) when the search term is
 * empty, so callers don't need a separate "no search" branch.
 */
export function matchProducts<T extends Record<string, any>>(
  searchTerm: string,
  source: T[],
  options: MatchProductsOptions = {},
): T[] {
  const { nameKey = 'name', skuKey = 'sku', limit = 50 } = options;
  const term = searchTerm.toLowerCase().trim();

  if (!term) {
    return source.slice(0, limit);
  }

  const searchTerms = term.split(' ').filter((t) => t);

  const substringMatches = source.filter((product) => {
    const name = (product[nameKey]?.toLowerCase?.() || '') as string;
    const sku = (product[skuKey]?.toLowerCase?.() || '') as string;
    return searchTerms.every((t) => name.includes(t) || sku.includes(t));
  });

  if (term.length < MIN_FUZZY_LENGTH) {
    return substringMatches.slice(0, limit);
  }

  const substringMatchIds = new Set(substringMatches.map((p) => p.id));
  const fuzzyMatches = source
    .filter((product) => !substringMatchIds.has(product.id))
    .map((product) => {
      const name = (product[nameKey]?.toLowerCase?.() || '') as string;
      const sku = (product[skuKey]?.toLowerCase?.() || '') as string;
      let totalScore = 0;
      for (const t of searchTerms) {
        const nameScore = subsequenceScore(t, name);
        const skuScore = subsequenceScore(t, sku);
        const best = [nameScore, skuScore].filter(
          (s): s is number => s !== null,
        );
        if (best.length === 0) return null; // this token didn't fuzzy-match — exclude product
        totalScore += Math.min(...best);
      }
      return { product, score: totalScore };
    })
    .filter((r): r is { product: T; score: number } => r !== null)
    .sort((a, b) => a.score - b.score)
    .map((r) => r.product);

  return [...substringMatches, ...fuzzyMatches].slice(0, limit);
}
