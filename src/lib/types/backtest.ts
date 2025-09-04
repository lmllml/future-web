// 回测相关类型定义

export type PositionSide = "LONG" | "SHORT";

export interface BacktestConfig {
  id: string;
  name: string;
  description?: string;
  
  // 基础配置
  totalUSDC: number; // 总USDC数量
  positionSizeConfig: PositionSizeConfig; // 每次下单配置
  
  // 数据源配置
  symbol: string; // 交易对 例如："BTCUSDT"
  exchange: string; // 交易所 例如："binance"
  market: string; // 市场类型 例如："futures"
  accountId?: string; // 账户ID
  
  // 时间范围
  startTime: string;
  endTime: string;
  
  // 回测策略配置
  strategyConfig: StrategyConfig;
  
  // 风险管理配置
  riskManagement: RiskManagementConfig;
  
  // 其他配置
  slippageRate?: number; // 滑点率，默认0.001
  feeRate?: number; // 手续费率，默认0.0004
  
  createdAt: string;
  updatedAt: string;
}

// 仓位大小配置
export interface PositionSizeConfig {
  type: "FIXED_AMOUNT" | "FIXED_PERCENTAGE"; // 固定金额 | 固定比例
  value: number; // 数值：固定金额(USDC) 或 固定比例(0-1)
  maxPositions?: number; // 最大同时持仓数，默认不限制
}

// 策略配置
export interface StrategyConfig {
  name: string; // 策略名称
  type: "FOLLOW_TRADES"; // 目前支持跟随交易记录策略
  params: FollowTradesStrategyParams;
}

// 跟随交易记录策略参数
export interface FollowTradesStrategyParams {
  followOpenOnly: boolean; // true: 只跟随开单，false: 跟随开平单
  filterConditions?: TradeFilterConditions; // 过滤条件
}

// 交易过滤条件
export interface TradeFilterConditions {
  minQuantity?: number; // 最小交易数量
  maxQuantity?: number; // 最大交易数量
  tradeTypes?: ("OPEN_LONG" | "OPEN_SHORT" | "CLOSE_LONG" | "CLOSE_SHORT")[]; // 允许的交易类型
  timeFilters?: TimeFilterConfig[]; // 时间过滤器
}

// 时间过滤器配置
export interface TimeFilterConfig {
  type: "TIME_RANGE" | "WEEKDAY" | "HOUR_RANGE";
  startTime?: string; // "HH:mm"
  endTime?: string; // "HH:mm"
  weekdays?: number[]; // 0-6, 0为周日
}

// 风险管理配置
export interface RiskManagementConfig {
  stopLoss: StopLossConfig;
  takeProfit: TakeProfitConfig;
  maxDrawdown?: number; // 最大回撤百分比，触发后停止交易
  maxDailyLoss?: number; // 每日最大亏损限制(USDC)
}

// 止损配置
export interface StopLossConfig {
  enabled: boolean;
  type: "PERCENTAGE" | "FIXED_AMOUNT" | "ATR"; // 百分比 | 固定金额 | ATR倍数
  value: number; // 对应类型的数值
  trailingStop?: boolean; // 是否启用移动止损
  trailingStopDistance?: number; // 移动止损距离
}

// 止盈配置
export interface TakeProfitConfig {
  enabled: boolean;
  type: "PERCENTAGE" | "FIXED_AMOUNT" | "RISK_REWARD_RATIO"; // 百分比 | 固定金额 | 风险收益比
  value: number; // 对应类型的数值
  partialTakeProfit?: PartialTakeProfitConfig[]; // 分批止盈配置
}

// 分批止盈配置
export interface PartialTakeProfitConfig {
  percentage: number; // 平仓比例 (0-1)
  triggerType: "PERCENTAGE" | "FIXED_AMOUNT" | "RISK_REWARD_RATIO";
  triggerValue: number;
}

// 回测状态
export enum BacktestStatus {
  PENDING = "PENDING",
  RUNNING = "RUNNING", 
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED"
}

// 回测结果实体
export interface BacktestResult {
  id: string;
  backtestConfigId: string;
  status: BacktestStatus;
  
  // 执行信息
  startTime: string;
  endTime?: string;
  duration?: number; // 执行耗时(ms)
  
  // 基础统计
  totalTrades: number; // 总交易次数
  winningTrades: number; // 盈利交易次数
  losingTrades: number; // 亏损交易次数
  winRate: number; // 胜率
  
  // 盈亏统计
  totalPnl: number; // 总盈亏(USDC)
  totalFees: number; // 总手续费(USDC)
  netPnl: number; // 净盈亏 = totalPnl - totalFees
  
  // 收益率统计
  totalReturn: number; // 总收益率
  annualizedReturn: number; // 年化收益率
  maxDrawdown: number; // 最大回撤
  maxDrawdownDate?: string; // 最大回撤发生日期
  
  // 风险指标
  sharpeRatio: number; // 夏普比率
  sortinoRatio: number; // 索提诺比率
  calmarRatio: number; // 卡尔马比率
  volatility: number; // 波动率
  
  // 交易统计
  avgWin: number; // 平均盈利
  avgLoss: number; // 平均亏损
  profitFactor: number; // 盈利因子 = 总盈利 / 总亏损
  averageTradeDuration: number; // 平均持仓时间(ms)
  maxConsecutiveWins: number; // 最大连续盈利次数
  maxConsecutiveLosses: number; // 最大连续亏损次数
  
  // 持仓统计
  maxPosition: number; // 最大持仓金额(USDC)
  averagePosition: number; // 平均持仓金额(USDC)
  maxConcurrentPositions: number; // 最大同时持仓数
  
  // 每日盈亏曲线
  dailyPnl: DailyPnlRecord[];
  
  // 详细交易记录
  trades: BacktestTradeRecord[];
  
  // 风险事件记录
  riskEvents: RiskEventRecord[];
  
  // 错误信息
  error?: string;
  
  createdAt: string;
  updatedAt: string;
}

// 每日盈亏记录
export interface DailyPnlRecord {
  date: string; // YYYY-MM-DD
  dailyPnl: number; // 当日盈亏
  cumulativePnl: number; // 累积盈亏
  drawdown: number; // 回撤
  balance: number; // 账户余额
  trades: number; // 当日交易次数
}

// 回测交易记录
export interface BacktestTradeRecord {
  id: string;
  originalTradeId?: string; // 原始交易记录ID
  symbol: string;
  side: "BUY" | "SELL";
  type: "MARKET" | "STOP_LOSS" | "TAKE_PROFIT";
  
  // 价格和数量
  price: number; // 成交价格
  quantity: number; // 成交数量
  notional: number; // 名义价值(USDC)
  
  // 时间
  timestamp: string; // 成交时间
  
  // 盈亏信息
  pnl?: number; // 本次交易盈亏(USDC)
  fee: number; // 手续费(USDC)
  
  // 持仓信息
  positionSide: PositionSide;
  positionSize: number; // 成交后持仓大小
  avgEntryPrice?: number; // 平均入场价格
  
  // 风险管理
  stopLossPrice?: number; // 止损价格
  takeProfitPrice?: number; // 止盈价格
  
  // 触发原因
  trigger: TradeTrigger;
  
  // 关联信息
  relatedTradeId?: string; // 相关交易ID(例如止损/止盈对应的开仓交易)
  
  createdAt: string;
}

// 交易触发原因
export enum TradeTrigger {
  FOLLOW_SIGNAL = "FOLLOW_SIGNAL", // 跟随信号
  STOP_LOSS = "STOP_LOSS", // 止损
  TAKE_PROFIT = "TAKE_PROFIT", // 止盈
  RISK_MANAGEMENT = "RISK_MANAGEMENT", // 风险管理
  MANUAL_CLOSE = "MANUAL_CLOSE" // 手动平仓
}

// 风险事件记录
export interface RiskEventRecord {
  id: string;
  type: RiskEventType;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  message: string;
  details?: Record<string, any>;
  timestamp: string;
  
  // 相关信息
  tradeId?: string;
  value?: number; // 相关数值
  threshold?: number; // 触发阈值
}

// 风险事件类型
export enum RiskEventType {
  MAX_DRAWDOWN_EXCEEDED = "MAX_DRAWDOWN_EXCEEDED", // 超过最大回撤
  DAILY_LOSS_LIMIT_EXCEEDED = "DAILY_LOSS_LIMIT_EXCEEDED", // 超过每日亏损限制
  MAX_POSITION_EXCEEDED = "MAX_POSITION_EXCEEDED", // 超过最大持仓
  INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE", // 余额不足
  STOP_LOSS_TRIGGERED = "STOP_LOSS_TRIGGERED", // 止损触发
  TAKE_PROFIT_TRIGGERED = "TAKE_PROFIT_TRIGGERED", // 止盈触发
  SLIPPAGE_WARNING = "SLIPPAGE_WARNING", // 滑点警告
  DATA_QUALITY_WARNING = "DATA_QUALITY_WARNING" // 数据质量警告
}

// 回测记录汇总信息（用于列表显示）
export interface BacktestSummary {
  id: string;
  name: string;
  description?: string;
  symbol: string;
  exchange: string;
  market: string;
  status: BacktestStatus;
  strategyName: string;
  
  // 时间范围
  startTime: string;
  endTime: string;
  duration?: number;
  
  // 关键指标
  totalTrades?: number;
  netPnl?: number;
  totalReturn?: number;
  maxDrawdown?: number;
  sharpeRatio?: number;
  winRate?: number;
  
  createdAt: string;
  updatedAt: string;
}
