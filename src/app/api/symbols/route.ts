import { NextRequest } from 'next/server'

export async function GET(_req: NextRequest) {
  // 先只支持 ETHUSDC，固定返回该选项，避免外部 API 带来的不稳定与脏数据
  return Response.json({ data: [{ symbol: 'ETHUSDC' }] })
}


