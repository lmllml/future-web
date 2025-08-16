import Link from 'next/link'

interface SessionItem {
  id: string
  symbol: string
  startedAt: string
  pnl: number
}

function formatCurrency(value: number): string {
  return value.toLocaleString('zh-CN', { style: 'currency', currency: 'USD' })
}

async function fetchSessions(): Promise<SessionItem[]> {
  // TODO: 替换为真实 API 调用
  return [
    { id: 's1', symbol: 'BTCUSDT', startedAt: '2025-08-01T08:00:00Z', pnl: 123.45 },
    { id: 's2', symbol: 'ETHUSDT', startedAt: '2025-08-01T10:00:00Z', pnl: -42.13 }
  ]
}

export default async function SessionsPage() {
  const sessions = await fetchSessions()
  return (
    <main className="space-y-4">
      <h3 className="text-lg font-medium">复盘会话</h3>
      <ul className="divide-y rounded-md border">
        {sessions.map(session => (
          <li key={session.id} className="flex items-center justify-between p-3">
            <div className="space-y-1">
              <div className="font-medium">{session.symbol}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(session.startedAt).toLocaleString('zh-CN')}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className={session.pnl >= 0 ? 'text-green-600' : 'text-red-600'}>
                {formatCurrency(session.pnl)}
              </span>
              <Link className="text-primary underline" href={`/ai-replay/sessions/${session.id}`}>
                查看
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </main>
  )
}


