import { useEffect, useState } from 'react';
import { loadLocalCounts, refreshRecent, rebuildRecentIfEmpty, subscribeRecent, RecentCounts } from '../helpers/recentSold';

/** Live "units sold by me in this shop" counts for the Recent section. */
export function useRecentSold(shopId: string | number | undefined | null): RecentCounts {
  const [counts, setCounts] = useState<RecentCounts>({});
  useEffect(() => {
    if (!shopId || shopId === 'ALL') { setCounts({}); return; }
    const load = () => setCounts(loadLocalCounts(shopId));
    load();
    const unsub = subscribeRecent(load);
    refreshRecent(shopId).then(() => rebuildRecentIfEmpty(shopId));
    return unsub;
  }, [shopId]);
  return counts;
}
