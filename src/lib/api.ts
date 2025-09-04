export interface FetchParams {
  [key: string]: string | number | boolean | undefined;
}

function buildQuery(params?: FetchParams): string {
  if (!params) return "";
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined) return;
    sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export async function getCryptoJson<T>(
  path: string,
  params?: FetchParams
): Promise<T> {
  const base =
    process.env.NEXT_PUBLIC_CRYPTO_SERVER_ORIGIN || "http://127.0.0.1:3101";
  const url = `${base}/api/crypto${path}${buildQuery(params)}`;

  console.log(`🚀 API Call: ${url}`); // 调试日志

  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(
      `Request failed: ${res.status} ${res.statusText}\n${errorText}`
    );
  }

  return res.json() as Promise<T>;
}

export async function postCryptoJson<T>(
  path: string,
  body: Record<string, unknown>
): Promise<T> {
  const base =
    process.env.NEXT_PUBLIC_CRYPTO_SERVER_ORIGIN || "http://127.0.0.1:3101";
  const url = `${base}/api/crypto${path}`;

  console.log(`🚀 API Call: ${url}`);

  const res = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(
      `Request failed: ${res.status} ${res.statusText}\n${errorText}`
    );
  }

  return (await res.json()) as T;
}

export const cryptoApi = {
  listRoundPnl: <T>(params: FetchParams) =>
    getCryptoJson<T>("/round-pnl", params),
  getCumulativePnl: <T>(params: FetchParams) =>
    getCryptoJson<T>("/cumulative-pnl", params),
  listKlines: <T>(params: FetchParams) => getCryptoJson<T>("/klines", params),
  listUserTrades: <T>(params: FetchParams) =>
    getCryptoJson<T>("/user-trades", params),
  getTradesByIds: <T>(params: FetchParams) =>
    getCryptoJson<T>("/trades-by-ids", params),
  getRiskMatrix: <T>(params: FetchParams) =>
    getCryptoJson<T>("/risk-analysis/matrix", params),
  getRiskTrades: <T>(params: FetchParams) =>
    getCryptoJson<T>("/risk-analysis/trades", params),
  listRiskDetails: <T>(params: FetchParams) =>
    getCryptoJson<T>("/risk-details", params),
  calculateRiskAnalysis: <T>(body: Record<string, unknown>) =>
    postCryptoJson<T>("/risk-analysis/calculate", body),
  
  // Backtest APIs
  listBacktests: <T>(params: FetchParams) =>
    getCryptoJson<T>("/backtest/results", params),
  getBacktestResult: <T>(id: string) =>
    getCryptoJson<T>(`/backtest/results/${id}`),
};
