interface TradeRecord {
  time: string
  price: number
  qty: number
  side: 'BUY' | 'SELL'
}

async function fetchSessionDetail(id: string): Promise<{ trades: TradeRecord[] }> {
  // TODO: 替换为真实 API 调用
  const demo: TradeRecord[] = [
    { time: '2025-08-01T08:01:00Z', price: 68000, qty: 0.01, side: 'BUY' },
    { time: '2025-08-01T08:15:00Z', price: 68250, qty: 0.01, side: 'SELL' }
  ]
  return { trades: demo }
}

export default async function SessionDetailPage(props: { params: { id: string } }) {
  const { id } = props.params
  const { trades } = await fetchSessionDetail(id)

  return (
    <main className="space-y-4">
      <h3 className="text-lg font-medium">会话详情 #{id}</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="p-2">时间</th>
              <th className="p-2">方向</th>
              <th className="p-2">价格</th>
              <th className="p-2">数量</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t, idx) => (
              <tr key={idx} className="border-b">
                <td className="p-2 whitespace-nowrap">
                  {new Date(t.time).toLocaleString('zh-CN')}
                </td>
                <td className="p-2">
                  <span className={t.side === 'BUY' ? 'text-green-600' : 'text-red-600'}>{t.side}</span>
                </td>
                <td className="p-2">{t.price.toLocaleString()}</td>
                <td className="p-2">{t.qty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}


