'use client';

import { Flexbox } from '@lobehub/ui';
import { Modal, Progress, Table, Tag, Typography } from 'antd';
import { memo, useEffect } from 'react';
import useSWR from 'swr';

import { type BudgetData, type BudgetWindow } from '@/hooks/useBudgetWarning';

const { Text } = Typography;

interface HistoryItem {
  cost: number;
  model: string;
  time: string;
  tokens: number;
}

interface UsageWithHistory extends BudgetData {
  history: HistoryItem[] | null;
}

function progressColor(pct: number) {
  if (pct >= 100) return '#991b1b';
  if (pct >= 90) return '#ef4444';
  if (pct >= 75) return '#eab308';
  return '#22c55e';
}

function formatResetTime(iso: string): string {
  const d = new Date(iso);
  const diff = d.getTime() - Date.now();
  const abs =
    d.toLocaleDateString([], { day: 'numeric', month: 'short' }) +
    ' ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diff <= 0) return `${abs} (now)`;
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const rel =
    h > 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
  return `${abs} (${rel})`;
}

const WindowBar = memo<{ hideCost?: boolean; w: BudgetWindow }>(({ w, hideCost }) => {
  return (
    <Flexbox gap={4} style={{ marginBottom: 16 }}>
      <Flexbox align="center" horizontal justify="space-between">
        <Text strong>{w.window} window</Text>
        <Text type="secondary">
          {hideCost ? `${w.pct.toFixed(0)}%` : `$${w.spent.toFixed(2)} / $${w.limit.toFixed(2)}`}
        </Text>
      </Flexbox>
      <Progress
        percent={Math.min(w.pct, 100)}
        showInfo={false}
        strokeColor={progressColor(w.pct)}
      />
      <Flexbox align="center" horizontal justify="space-between">
        {!hideCost && <Text type="secondary">Remaining: ${w.remaining.toFixed(2)}</Text>}
        <Text type="secondary">Resets: {formatResetTime(w.reset_at)}</Text>
      </Flexbox>
    </Flexbox>
  );
});

const baseColumns = [
  {
    dataIndex: 'time',
    key: 'time',
    render: (v: string) => {
      const d = new Date(v);
      return `${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ${d.toLocaleDateString([], { day: 'numeric', month: 'short' })}`;
    },
    title: 'Time',
    width: 140,
  },
  { dataIndex: 'model', key: 'model', title: 'Model' },
];

const costColumn = {
  dataIndex: 'cost',
  key: 'cost',
  render: (v: number) => `$${v < 0.01 ? v.toFixed(6) : v.toFixed(4)}`,
  title: 'Cost',
  width: 100,
};

const tokensColumn = { dataIndex: 'tokens', key: 'tokens', title: 'Tokens', width: 80 };

function getHistoryColumns(hideCost?: boolean) {
  return hideCost ? [...baseColumns, tokensColumn] : [...baseColumns, costColumn, tokensColumn];
}

const UsagePanel = memo<{ onClose: () => void; open: boolean }>(({ open, onClose }) => {
  const { data, mutate } = useSWR<UsageWithHistory>(
    open ? 'usage-panel' : null,
    async () => {
      const res = await fetch('/api/budget?history=1');
      if (!res.ok) return undefined;
      return res.json();
    },
    { refreshInterval: 30_000, revalidateOnFocus: true },
  );

  useEffect(() => {
    if (open) mutate();
  }, [open]);

  return (
    <Modal
      footer={null}
      open={open}
      title={
        <Flexbox align="center" gap={8} horizontal>
          🐝 Usage
          {data?.subscription && (
            <Tag color="gold" style={{ marginLeft: 4 }}>
              {data.subscription}
            </Tag>
          )}
        </Flexbox>
      }
      width={520}
      onCancel={onClose}
    >
      <Flexbox gap={8} style={{ maxHeight: 480, overflowY: 'auto', padding: '8px 0' }}>
        {data?.valid_until && (
          <Text style={{ marginBottom: 4 }} type="secondary">
            📅 Subscription expires: {formatResetTime(data.valid_until)}
          </Text>
        )}
        {data?.blocked && (
          <Tag color="error" style={{ fontSize: 14, marginBottom: 8, padding: '4px 12px' }}>
            ⛔ Budget Exceeded
          </Tag>
        )}

        {data?.windows?.map((w) => (
          <WindowBar hideCost={data.hide_cost} key={w.window} w={w} />
        ))}

        {data?.history && data.history.length > 0 && (
          <>
            <Text strong style={{ marginTop: 8 }}>
              Recent Activity
            </Text>
            <Table
              columns={getHistoryColumns(data.hide_cost)}
              dataSource={data.history.map((h, i) => ({ ...h, key: i }))}
              pagination={false}
              size="small"
            />
          </>
        )}
      </Flexbox>
    </Modal>
  );
});

WindowBar.displayName = 'WindowBar';
UsagePanel.displayName = 'UsagePanel';

export default UsagePanel;
