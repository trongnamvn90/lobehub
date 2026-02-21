'use client';

import { Flexbox } from '@lobehub/ui';
import { Progress, Tag } from 'antd';
import { cssVar } from 'antd-style';
import { memo } from 'react';

import { type BudgetWindow, useBudgetWarning } from '@/hooks/useBudgetWarning';

import ActionPopover from '../components/ActionPopover';

function badgeColor(pct: number, blocked: boolean) {
  if (blocked || pct >= 100) return '#991b1b';
  if (pct >= 90) return '#ef4444';
  if (pct >= 75) return '#eab308';
  return '#22c55e';
}

function progressColor(pct: number) {
  if (pct >= 100) return '#991b1b';
  if (pct >= 90) return '#ef4444';
  if (pct >= 75) return '#eab308';
  return '#22c55e';
}

function resetLabel(resetAt: string) {
  const diff = new Date(resetAt).getTime() - Date.now();
  if (diff <= 0) return 'now';
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h > 24) return new Date(resetAt).toLocaleDateString();
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const WindowBar = memo<{ hideCost: boolean; w: BudgetWindow }>(({ w, hideCost }) => (
  <Flexbox gap={2} style={{ marginBottom: 8 }}>
    <Flexbox align="center" horizontal justify="space-between" style={{ fontSize: 12 }}>
      <span style={{ fontWeight: 600 }}>{w.window}</span>
      <span style={{ color: cssVar.colorTextDescription }}>
        {hideCost ? `${w.pct.toFixed(0)}%` : `$${w.spent.toFixed(2)}/$${w.limit.toFixed(2)} (${w.pct.toFixed(0)}%)`}
      </span>
    </Flexbox>
    <Progress
      percent={Math.min(w.pct, 100)}
      showInfo={false}
      size="small"
      strokeColor={progressColor(w.pct)}
    />
    <Flexbox
      align="center"
      horizontal
      justify="space-between"
      style={{ color: cssVar.colorTextDescription, fontSize: 11 }}
    >
      {!hideCost && <span>Left: ${w.remaining.toFixed(2)}</span>}
      <span style={hideCost ? { marginLeft: 'auto' } : undefined}>
        Resets in {resetLabel(w.reset_at)}
      </span>
    </Flexbox>
  </Flexbox>
));

WindowBar.displayName = 'WindowBar';

const BudgetBadge = memo(() => {
  const { data, level } = useBudgetWarning();

  if (!data?.windows?.length) return null;

  const maxPct = Math.max(...data.windows.map((w) => w.pct));
  const blocked = level === 'blocked';
  const hideCost = !!(data as any).hide_cost;

  const icon = blocked ? '⛔' : '🐝';
  const pctDisplay = `${Math.min(Math.round(maxPct), 100)}%`;
  const color = badgeColor(maxPct, blocked);

  const popoverContent = (
    <Flexbox gap={4} style={{ minWidth: 220 }}>
      {blocked && (
        <Tag color="error" style={{ fontSize: 12, marginBottom: 4, padding: '2px 8px' }}>
          ⛔ Budget Exceeded
        </Tag>
      )}
      {data.windows.map((w) => (
        <WindowBar hideCost={hideCost} key={w.window} w={w} />
      ))}
    </Flexbox>
  );

  return (
    <ActionPopover
      content={popoverContent}
      minWidth={260}
      title={
        <Flexbox align="center" gap={6} horizontal>
          <span>🐝 Usage</span>
          {data.subscription && (
            <Tag color="gold" style={{ fontSize: 11, lineHeight: '18px', margin: 0, padding: '0 6px' }}>
              {data.subscription}
            </Tag>
          )}
        </Flexbox>
      }
    >
      <Flexbox
        align="center"
        horizontal
        gap={3}
        style={{
          background: cssVar.colorFillTertiary,
          borderRadius: 12,
          color,
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 600,
          height: 24,
          paddingInline: '6px 8px',
          userSelect: 'none',
        }}
      >
        <span>{icon}</span>
        <span>{pctDisplay}</span>
      </Flexbox>
    </ActionPopover>
  );
});

BudgetBadge.displayName = 'BudgetBadge';

export default BudgetBadge;
