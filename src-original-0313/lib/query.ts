/**
 * 最小 parseQuery 实现
 */
export function parseQuery(searchParams: URLSearchParams): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {}
  searchParams.forEach((value, key) => {
    result[key] = value
  })
  return result
}

export function buildQuery(params: Record<string, string | undefined>): string {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      searchParams.set(key, value)
    }
  })
  const str = searchParams.toString()
  return str ? `?${str}` : ''
}
