export interface RoundPnlData {
  symbol: string;
  exchange: string;
  market: string;
  accountId?: string;
  roundId: string;
  positionSide: "LONG" | "SHORT";
  openTradeIds: string[];
  closeTradeIds: string[];
  openOrderIds?: string[];
  closeOrderIds?: string[];
  openTime: string; // ISO
  closeTime: string; // ISO
  totalQuantity: number;
  avgEntryPrice: number;
  avgExitPrice: number;
  realizedPnl: number;
  totalFees: number;
  leverage?: number; // 杠杆倍数（期货专用）
  calculatedAt: string;
}

export interface KlineData {
  symbol: string;
  interval: string;
  openTime: string;
  closeTime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume: number;
  trades: number;
  takerBuyBaseVolume: number;
  takerBuyQuoteVolume: number;
  exchange: string;
  market: string;
  timestamp: string;
}

export interface TradeData {
  symbol: string;
  exchange: string;
  market?: string;
  accountId?: string;
  orderId?: string;
  tradeId: string;
  price: number;
  quantity: number;
  quoteQuantity: number;
  timestamp: string;
  isBuyerMaker: boolean;
  commission: number;
  commissionAsset: string;
  side?: "BUY" | "SELL";
  positionSide?: "LONG" | "SHORT" | "BOTH";
  reduceOnly?: boolean;
  tradeType?: string;
}
