import { NextRequest } from "next/server";

export async function GET(_req: NextRequest) {
  // 返回支持的交易对和市场类型
  const symbols = [
    { symbol: "ETHUSDC", markets: ["futures", "spot"] },
    { symbol: "ETHUSDT", markets: ["futures", "spot"] },
  ];
  return Response.json({ data: symbols });
}
