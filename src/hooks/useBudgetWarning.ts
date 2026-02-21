import useSWR from 'swr';

import { useUserStore } from '@/store/user';
import { authSelectors } from '@/store/user/selectors';

export type WarningLevel = 'blocked' | 'critical' | 'warning' | 'ok';

export interface BudgetWindow {
  limit: number;
  pct: number;
  remaining: number;
  reset_at: string;
  spent: number;
  window: string;
}

export interface BudgetData {
  blocked: boolean;
  email: string;
  subscription: string;
  windows: BudgetWindow[];
}

function computeLevel(data?: BudgetData): WarningLevel {
  if (!data?.windows?.length) return 'ok';
  const maxPct = Math.max(...data.windows.map((w) => w.pct));
  if (maxPct >= 100 || data.blocked) return 'blocked';
  if (maxPct >= 90) return 'critical';
  if (maxPct >= 75) return 'warning';
  return 'ok';
}

export function useBudgetWarning() {
  const isLogin = useUserStore(authSelectors.isLogin);

  const { data, isLoading } = useSWR<BudgetData>(
    isLogin ? 'budget-warning' : null,
    async () => {
      const res = await fetch('/api/budget');
      if (!res.ok) return undefined;
      return res.json();
    },
    {
      dedupingInterval: 30_000,
      refreshInterval: 60_000,
      revalidateOnFocus: true,
    },
  );

  return { data, isLoading, level: computeLevel(data) };
}
