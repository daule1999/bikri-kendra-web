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

/**
 * Tiered "LIKE" search shared across the whole app — same algorithm as the Sales-tab
 * product search and the Catalog tab (see app/sales/helpers/productMatch.ts), generalized
 * here to work over any item shape via `getFields`, which returns the text fields to search
 * per item (e.g. [name, sku], or [orderNumber, customerName, ...lineItemNames]).
 *
 * Tier 1: every search word must appear as a substring in at least one field (fast, exact).
 * Tier 2 (only once the term is >= 2 chars): subsequence/abbreviation fuzzy match across
 *         fields (e.g. "sabd" -> "Shabd", "agv" -> "Angvastra"), applied only to items the
 *         substring tier didn't already match, ranked by how tightly the matched characters
 *         cluster together (tighter = better, so closer matches rank first).
 *
 * Returns the full source list (up to `limit`) when the search term is empty, so callers
 * don't need a separate "no search" branch.
 */
export function matchItems<T>(
  searchTerm: string,
  source: T[],
  getFields: (item: T) => Array<string | number | null | undefined>,
  limit: number = 50
): T[] {
  const term = searchTerm.toLowerCase().trim();

  if (!term) {
    return source.slice(0, limit);
  }

  const searchTerms = term.split(' ').filter((t) => t);
  const fieldsOf = (item: T) => getFields(item).map((f) => String(f ?? '').toLowerCase());

  const substringMatches: T[] = [];
  const substringMatchSet = new Set<T>();
  for (const item of source) {
    const fields = fieldsOf(item);
    if (searchTerms.every((t) => fields.some((f) => f.includes(t)))) {
      substringMatches.push(item);
      substringMatchSet.add(item);
    }
  }

  if (term.length < MIN_FUZZY_LENGTH) {
    return substringMatches.slice(0, limit);
  }

  const fuzzyMatches = source
    .filter((item) => !substringMatchSet.has(item))
    .map((item) => {
      const fields = fieldsOf(item);
      let totalScore = 0;
      for (const t of searchTerms) {
        const scores = fields
          .map((f) => subsequenceScore(t, f))
          .filter((s): s is number => s !== null);
        if (scores.length === 0) return null; // this word didn't fuzzy-match any field — exclude item
        totalScore += Math.min(...scores);
      }
      return { item, score: totalScore };
    })
    .filter((r): r is { item: T; score: number } => r !== null)
    .sort((a, b) => a.score - b.score)
    .map((r) => r.item);

  return [...substringMatches, ...fuzzyMatches].slice(0, limit);
}

/** Convenience wrapper for the common case of searching a name field plus an optional sku field. */
export function matchByNameSku<T extends Record<string, any>>(
  searchTerm: string,
  source: T[],
  options: { nameKey?: string; skuKey?: string; limit?: number } = {}
): T[] {
  const { nameKey = 'name', skuKey = 'sku', limit = 50 } = options;
  return matchItems(searchTerm, source, (item) => [item[nameKey], item[skuKey]], limit);
}
