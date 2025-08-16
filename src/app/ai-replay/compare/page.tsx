interface StrategyResult {
  name: string
  sharpe: number
  returnPct: number
  maxDrawdownPct: number
}

async function fetchStrategyResults(): Promise<StrategyResult[]> {
  // TODO: 替换为真实 API
  return [
    { name: '策略A', sharpe: 1.2, returnPct: 18.3, maxDrawdownPct: -6.4 },
    { name: '策略B', sharpe: 0.9, returnPct: 12.7, maxDrawdownPct: -4.2 }
  ]
}

export default async function ComparePage() {
  const results = await fetchStrategyResults()
  return (
    <main className="overflow-x-auto">
      <table className="min-w-[640px] text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="p-2">策略</th>
            <th className="p-2">Sharpe</th>
            <th className="p-2">收益率</th>
            <th className="p-2">最大回撤</th>
          </tr>
        </thead>
        <tbody>
          {results.map(r => (
            <tr key={r.name} className="border-b">
              <td className="p-2">{r.name}</td>
              <td className="p-2">{r.sharpe.toFixed(2)}</td>
              <td className="p-2">{r.returnPct.toFixed(2)}%</td>
              <td className="p-2">{r.maxDrawdownPct.toFixed(2)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}


