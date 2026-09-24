// Compact repeated BOM field names and string values within one atomic storage value.
// This changes only the persisted representation; snapshots retain their existing shape.
const FORMAT = 'higood-bom-dictionary-v1'

export function serializeEngineeringBomSnapshot(snapshot: object): string {
  const strings: string[] = []
  const indices = new Map<string, number>()
  const intern = (value: string): number => {
    const existing = indices.get(value)
    if (existing !== undefined) return existing
    const index = strings.length
    strings.push(value)
    indices.set(value, index)
    return index
  }
  const encode = (value: unknown): unknown => {
    if (typeof value === 'string') return [2, intern(value)]
    if (Array.isArray(value)) return [1, ...value.map(encode)]
    if (value && typeof value === 'object') {
      return [0, ...Object.entries(value).flatMap(([key, item]) => [intern(key), encode(item)])]
    }
    return value
  }
  // Match JSON's handling of optional fields and non-finite values before encoding.
  const plain = JSON.stringify(snapshot)
  const data = encode(JSON.parse(plain))
  const compact = JSON.stringify({ format: FORMAT, strings, data })
  return compact.length < plain.length ? compact : plain
}

export function parseEngineeringBomSnapshot(raw: string): unknown {
  const value = JSON.parse(raw)
  if (value?.format !== FORMAT) return value
  const strings = value.strings
  if (!Array.isArray(strings) || strings.some(item => typeof item !== 'string')) throw new Error('BOM 存储字典不完整')
  const stringAt = (index: unknown): string => {
    if (!Number.isInteger(index) || Number(index) < 0 || Number(index) >= strings.length) throw new Error('BOM 存储引用缺失')
    return strings[Number(index)]
  }
  const decode = (item: unknown): unknown => {
    if (!Array.isArray(item)) {
      if (item !== null && typeof item !== 'number' && typeof item !== 'boolean') throw new Error('BOM 存储值无效')
      return item
    }
    if (item[0] === 2 && item.length === 2) return stringAt(item[1])
    if (item[0] === 1) return item.slice(1).map(decode)
    if (item[0] === 0 && item.length % 2 === 1) {
      const entries: Array<[string, unknown]> = []
      for (let i = 1; i < item.length; i += 2) entries.push([stringAt(item[i]), decode(item[i + 1])])
      return Object.fromEntries(entries)
    }
    throw new Error('BOM 存储结构无效')
  }
  return decode(value.data)
}
