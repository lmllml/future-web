export interface QueryObject {
  [key: string]: string | number | boolean | undefined | null
}

export function toQueryString(query: QueryObject): string {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null) return
    params.set(key, String(value))
  })
  const s = params.toString()
  return s ? `?${s}` : ''
}


