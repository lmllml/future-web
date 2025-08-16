interface MetricItem {
  name: string
  value: number
  unit?: string
}

async function fetchMetrics(): Promise<MetricItem[]> {
  // TODO: 替换为真实 API
  return [
    { name: '胜率', value: 58.2, unit: '%' },
    { name: '盈亏比', value: 1.68 },
    { name: '最大回撤', value: -8.1, unit: '%' },
    { name: '年化收益', value: 23.4, unit: '%' }
  ]
}

export default async function MetricsPage() {
  const metrics = await fetchMetrics()
  return (
    <main className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {metrics.map(m => (
        <div key={m.name} className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">{m.name}</div>
          <div className="mt-2 text-2xl font-semibold">
            {m.value}
            {m.unit ? <span className="ml-1 text-base text-muted-foreground">{m.unit}</span> : null}
          </div>
        </div>
      ))}
    </main>
  )
}


