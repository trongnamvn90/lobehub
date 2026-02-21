import { NextResponse } from 'next/server';

import { auth } from '@/auth';

const BUDGET_BEE_URL = process.env.BUDGET_BEE_URL || 'http://budget-bee-svc:8080';

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.email)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const email = session.user.email;
  const url = new URL(req.url);
  const history = url.searchParams.get('history') === '1';

  const [usageRes, historyRes] = await Promise.all([
    fetch(`${BUDGET_BEE_URL}/api/usage?email=${encodeURIComponent(email)}`),
    history
      ? fetch(`${BUDGET_BEE_URL}/api/usage/history?email=${encodeURIComponent(email)}&limit=20`)
      : null,
  ]);

  if (!usageRes.ok) {
    return NextResponse.json({ error: 'Budget service unavailable' }, { status: usageRes.status });
  }

  const usage = await usageRes.json();
  const historyData = historyRes ? await historyRes.json() : null;

  return NextResponse.json({ ...usage, history: historyData?.items ?? null });
}
