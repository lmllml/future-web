export default function AiReplayLayout(
  props: Readonly<{ children: React.ReactNode }>
) {
  const { children } = props
  return (
    <section className="mx-auto max-w-6xl p-6">
      <h2 className="text-xl font-semibold">AI 交易复盘</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}


