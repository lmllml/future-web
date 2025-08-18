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
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok)
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}
