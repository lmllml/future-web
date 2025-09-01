# K 线缓存优化说明

## 概述

为了优化止盈止损计算性能，避免重复请求相同时间段的 K 线数据，我们实现了一个全局的 K 线缓存服务。

## 主要特性

### 1. 智能缓存管理

- **多层缓存策略**: 支持时间范围包含关系的缓存复用
- **TTL 管理**: 1 分钟 K 线缓存 5 分钟，其他时间周期缓存 30 分钟
- **防重复请求**: 相同请求会复用正在进行的网络请求

### 2. 预加载机制

- **批量预热**: 根据交易数据批量预加载所需 K 线
- **智能预加载**: 筛选条件确定后自动预加载相关时间段数据
- **时间范围扩展**: 支持扩展已有缓存的时间范围

### 3. 自动刷新

- **定期更新**: 每 2 分钟自动刷新接近当前时间的 1 分钟 K 线数据
- **智能刷新**: 只刷新 1 小时内的最新数据
- **并发控制**: 限制同时刷新的数量，避免过多网络请求

### 4. 内存管理

- **容量限制**: 最多缓存 1000 个条目
- **智能清理**: 优先清理过期、数据量大、访问频率低的条目
- **内存监控**: 当内存使用超过 100MB 时主动清理
- **定期维护**: 每 5 分钟进行一次缓存清理和内存检查

## 性能提升

### 止盈止损计算优化

- **避免重复请求**: 相同回合的 K 线数据只请求一次
- **批量预热**: 在分析开始前预加载所有需要的 K 线数据
- **缓存复用**: 不同止损等级计算复用相同的 K 线数据

### 网络请求减少

- **缓存命中**: 大部分 K 线请求直接从缓存获取
- **时间范围复用**: 大时间范围的缓存可以满足小时间范围的请求
- **并发优化**: 相同请求会合并，避免重复网络调用

## 使用方法

### 基本使用

```typescript
import { klineCacheService } from "@/lib/kline-cache";

// 获取K线数据（自动使用缓存）
const klines = await klineCacheService.getKlines({
  symbol: "ETHUSDC",
  exchange: "binance",
  market: "futures",
  interval: "1m",
  startTime: "2024-01-01T00:00:00Z",
  endTime: "2024-01-02T00:00:00Z",
});
```

### 批量预热

```typescript
// 根据交易数据预热缓存
await klineCacheService.warmupCache(trades, ["1m", "5m"]);
```

### 缓存状态监控

页面右下角的缓存状态组件显示：

- 缓存条目数量
- 数据点总数
- 内存使用估算
- 清理和刷新功能

## 文件变更

### 新增文件

- `src/lib/kline-cache.ts` - K 线缓存服务核心实现
- `src/components/cache-status.tsx` - 缓存状态显示组件
- `KLINE_CACHE_OPTIMIZATION.md` - 本说明文档

### 修改文件

- `src/components/charts/stop-loss-dialog.tsx` - 集成缓存服务，优化止损计算
- `src/components/charts/kline-dialog.tsx` - 使用缓存服务获取 K 线数据
- `src/app/round-pnl/round-list.tsx` - 最大浮亏计算使用缓存
- `src/app/round-pnl/page.tsx` - 添加预加载和缓存状态组件

## 配置参数

可以通过修改 `kline-cache.ts` 中的常量来调整缓存策略：

```typescript
// 缓存TTL
private readonly CACHE_TTL_1M = 5 * 60 * 1000; // 1分钟K线缓存时间
private readonly CACHE_TTL_OTHER = 30 * 60 * 1000; // 其他K线缓存时间

// 容量限制
private readonly MAX_CACHE_ENTRIES = 1000; // 最大缓存条目数
```

## 监控和维护

### 缓存统计

```typescript
const stats = klineCacheService.getCacheStats();
console.log(stats);
// {
//   totalEntries: 150,
//   totalDataPoints: 45000,
//   memoryUsageEstimate: "9.00 MB"
// }
```

### 手动清理

```typescript
// 清空所有缓存
klineCacheService.clearCache();

// 销毁服务（停止定时器）
klineCacheService.destroy();
```

## 注意事项

1. **内存使用**: 缓存会占用浏览器内存，建议定期关注内存使用情况
2. **数据一致性**: 缓存的数据可能不是最新的，特别是历史数据
3. **网络依赖**: 首次请求仍需要网络，缓存只能减少重复请求
4. **浏览器限制**: 受浏览器内存限制，不适合缓存过大的数据集

## 效果评估

通过实施 K 线缓存优化，预期可以获得以下改善：

- **止损分析速度提升**: 2-5 倍性能提升（取决于数据重复度）
- **网络请求减少**: 减少 70-90%的 K 线数据请求
- **用户体验改善**: 减少等待时间，提供更流畅的分析体验
- **服务器负载降低**: 减少后端 API 调用压力
