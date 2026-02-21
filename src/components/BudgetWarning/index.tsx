'use client';

import { Alert } from '@lobehub/ui';
import { memo } from 'react';

import { useBudgetWarning } from '@/hooks/useBudgetWarning';

const BudgetWarning = memo(() => {
  const { data, level } = useBudgetWarning();

  if (level === 'ok' || !data) return null;

  const summary = data.windows
    .map((w) => `${w.window}: $${w.spent.toFixed(2)}/$${w.limit.toFixed(2)} (${w.pct.toFixed(0)}%)`)
    .join(' | ');

  const typeMap = {
    blocked: 'error',
    critical: 'error',
    warning: 'warning',
  } as const;

  const titleMap = {
    blocked: `⛔ Budget exceeded — ${summary}`,
    critical: `🔴 Budget almost full — ${summary}`,
    warning: `🟡 Budget usage high — ${summary}`,
  } as const;

  return (
    <div style={{ padding: '0 12px 6px' }}>
      <Alert title={titleMap[level]} type={typeMap[level]} />
    </div>
  );
});

BudgetWarning.displayName = 'BudgetWarning';

export default BudgetWarning;
