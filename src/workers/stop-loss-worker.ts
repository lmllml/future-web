export type PreparedMetric = {
  roundId: string;
  symbol: string;
  positionSide: "LONG" | "SHORT";
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  realizedPnl: number;
  openTime: string;
  closeTime: string;
  maxDrawdownRate: number; // <= 0
  earlyFirstOpenPrice?: number;
  earlyFirstOpenQty?: number;
  earlyDrawdownRate?: number; // <= 0
  // 基于路径的K线数据（用于按时间顺序判断是否触发止损）
  klineHighs?: Float32Array;
  klineLows?: Float32Array;
  klineTimestamps?: Float64Array; // ms
};

export type TradeDetail = {
  roundId: string;
  symbol: string;
  positionSide: "LONG" | "SHORT";
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  finalPrice: number;
  pnlAmount: number;
  pnlRate: number;
  wouldHitStopLoss: boolean;
  maxDrawdownRate: number;
  openTime: string;
  closeTime: string;
};

export type RiskLevelResult = {
  percentage: number;
  totalProfit: number;
  totalProfitAmount: number;
  totalLossAmount: number;
  winRate: number;
  totalTrades: number;
  profitTrades: number;
  lossTrades: number;
  avgProfit: number;
  avgLoss: number;
  profitFactor: number;
  profitTradeDetails: TradeDetail[];
  lossTradeDetails: TradeDetail[];
};

type InMessage = { percentage: number; trades: PreparedMetric[] };

function computeForLevel(
  percentage: number,
  metrics: PreparedMetric[]
): RiskLevelResult {
  let totalTrades = 0;
  let profitTrades = 0;
  let lossTrades = 0;
  let totalProfitAmount = 0;
  let totalLossAmount = 0;
  let totalNetProfit = 0;
  const profitTradeDetails: TradeDetail[] = [];
  const lossTradeDetails: TradeDetail[] = [];

  for (const m of metrics) {
    const isLong = m.positionSide === "LONG";
    const entryPrice = m.entryPrice;
    const exitPrice = m.exitPrice;
    const quantity = m.quantity;
    if (!entryPrice || !exitPrice || !quantity) continue;

    // percentage === 0 means "no stop loss" (mapped from -999 upstream)
    if (percentage !== 0) {
      // 先判断两次开仓之间的早期止损（若预处理提供）
      if (
        m.earlyDrawdownRate !== undefined &&
        m.earlyFirstOpenPrice !== undefined &&
        m.earlyFirstOpenQty !== undefined &&
        m.earlyDrawdownRate <= percentage
      ) {
        const firstPrice = m.earlyFirstOpenPrice;
        const firstQty = m.earlyFirstOpenQty;
        const firstStopPrice = isLong
          ? firstPrice * (1 + percentage / 100)
          : firstPrice * (1 - percentage / 100);
        const pnlRateEarly = isLong
          ? ((firstStopPrice - firstPrice) / firstPrice) * 100
          : ((firstPrice - firstStopPrice) / firstPrice) * 100;
        const pnlAmountEarly = (pnlRateEarly / 100) * (firstPrice * firstQty);

        totalTrades++;
        totalNetProfit += pnlAmountEarly;
        const detail: TradeDetail = {
          roundId: m.roundId,
          symbol: m.symbol,
          positionSide: m.positionSide,
          entryPrice: firstPrice,
          exitPrice,
          quantity: firstQty,
          finalPrice: firstStopPrice,
          pnlAmount: pnlAmountEarly,
          pnlRate: pnlRateEarly,
          wouldHitStopLoss: true,
          maxDrawdownRate: m.earlyDrawdownRate!,
          openTime: m.openTime,
          closeTime: m.closeTime,
        };
        if (pnlAmountEarly > 0) {
          profitTrades++;
          totalProfitAmount += pnlAmountEarly;
          profitTradeDetails.push(detail);
        } else if (pnlAmountEarly < 0) {
          lossTrades++;
          totalLossAmount += Math.abs(pnlAmountEarly);
          lossTradeDetails.push(detail);
        }
        continue;
      }

      // 基于K线"路径"按时间顺序判断是否在到达真实平仓前触发止损
      if (
        m.klineLows &&
        m.klineHighs &&
        m.klineTimestamps &&
        m.klineLows.length === m.klineHighs.length &&
        m.klineHighs.length === m.klineTimestamps.length &&
        m.klineLows.length > 0
      ) {
        const stopLossPrice = isLong
          ? entryPrice * (1 + percentage / 100)
          : entryPrice * (1 - percentage / 100);
        const closeTimeMs = new Date(m.closeTime).getTime();
        let triggered = false;
        for (let i = 0; i < m.klineTimestamps.length; i++) {
          const t = m.klineTimestamps[i];
          // 不再在 closeTime 停止，持续扫描到“最新”K线
          if (isLong) {
            if (m.klineLows[i] <= stopLossPrice) {
              triggered = true;
              break;
            }
          } else {
            if (m.klineHighs[i] >= stopLossPrice) {
              triggered = true;
              break;
            }
          }
        }
        if (triggered) {
          const finalPrice = stopLossPrice;
          const pnlRate = isLong
            ? ((finalPrice - entryPrice) / entryPrice) * 100
            : ((entryPrice - finalPrice) / entryPrice) * 100;
          const pnlAmount = (pnlRate / 100) * (entryPrice * quantity);

          totalTrades++;
          totalNetProfit += pnlAmount;
          const detail: TradeDetail = {
            roundId: m.roundId,
            symbol: m.symbol,
            positionSide: m.positionSide,
            entryPrice,
            exitPrice,
            quantity,
            finalPrice,
            pnlAmount,
            pnlRate,
            wouldHitStopLoss: true,
            maxDrawdownRate: m.maxDrawdownRate,
            openTime: m.openTime,
            closeTime: m.closeTime,
          };
          if (pnlAmount > 0) {
            profitTrades++;
            totalProfitAmount += pnlAmount;
            profitTradeDetails.push(detail);
          } else if (pnlAmount < 0) {
            lossTrades++;
            totalLossAmount += Math.abs(pnlAmount);
            lossTradeDetails.push(detail);
          }
          continue;
        }
      }
    }

    // no stop or no trigger: use original exit
    const pnlRate = isLong
      ? ((exitPrice - entryPrice) / entryPrice) * 100
      : ((entryPrice - exitPrice) / entryPrice) * 100;
    const pnlAmount = (pnlRate / 100) * (entryPrice * quantity);
    totalTrades++;
    totalNetProfit += pnlAmount;
    const detail: TradeDetail = {
      roundId: m.roundId,
      symbol: m.symbol,
      positionSide: m.positionSide,
      entryPrice,
      exitPrice,
      quantity,
      finalPrice: exitPrice,
      pnlAmount,
      pnlRate,
      wouldHitStopLoss: false,
      maxDrawdownRate: m.maxDrawdownRate,
      openTime: m.openTime,
      closeTime: m.closeTime,
    };
    if (pnlAmount > 0) {
      profitTrades++;
      totalProfitAmount += pnlAmount;
      profitTradeDetails.push(detail);
    } else if (pnlAmount < 0) {
      lossTrades++;
      totalLossAmount += Math.abs(pnlAmount);
      lossTradeDetails.push(detail);
    }
  }

  const winRate = totalTrades > 0 ? (profitTrades / totalTrades) * 100 : 0;
  const avgProfit = profitTrades > 0 ? totalProfitAmount / profitTrades : 0;
  const avgLoss = lossTrades > 0 ? totalLossAmount / lossTrades : 0;
  const profitFactor = avgLoss > 0 ? avgProfit / avgLoss : 0;

  return {
    percentage,
    totalProfit: Number(totalNetProfit.toFixed(2)),
    totalProfitAmount: Number(totalProfitAmount.toFixed(2)),
    totalLossAmount: Number(totalLossAmount.toFixed(2)),
    winRate: Number(winRate.toFixed(1)),
    totalTrades,
    profitTrades,
    lossTrades,
    avgProfit: Number(avgProfit.toFixed(2)),
    avgLoss: Number(avgLoss.toFixed(2)),
    profitFactor: Number(profitFactor.toFixed(2)),
    profitTradeDetails,
    lossTradeDetails,
  };
}

self.onmessage = (e: MessageEvent<InMessage>) => {
  const { percentage, trades } = e.data;
  const result = computeForLevel(percentage, trades);
  (self as any).postMessage(result);
};
