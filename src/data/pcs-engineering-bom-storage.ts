// Compact repeated BOM field names and string values within one atomic storage value.
// This changes only the persisted representation; snapshots retain their existing shape.
const FORMAT = 'higood-bom-dictionary-v1'

export function serializeEngineeringBomSnapshot(snapshot: object): string {
  const strings: string[] = []
  const indices = new Map<string, number>()
  const encodedStrings: Array<[number, number]> = []
  const encodedObjects = new WeakMap<object, unknown[]>()
  const intern = (value: string): number => {
    const existing = indices.get(value)
    if (existing !== undefined) return existing
    const index = strings.length
    strings.push(value)
    indices.set(value, index)
    return index
  }
  const encode = (value: unknown): unknown => {
    if (typeof value === 'string') {
      const index = intern(value)
      return encodedStrings[index] ||= [2, index]
    }
    if (value && typeof value === 'object') {
      const cached = encodedObjects.get(value)
      if (cached) return cached
    }
    if (Array.isArray(value)) {
      const result: unknown[] = [1]
      encodedObjects.set(value, result)
      for (const item of value) result.push(encode(item))
      return result
    }
    if (value && typeof value === 'object') {
      const result: unknown[] = [0]
      encodedObjects.set(value, result)
      for (const key of Object.keys(value)) {
        const item = (value as Record<string, unknown>)[key]
        if (item !== undefined) result.push(intern(key), encode(item))
      }
      return result
    }
    return value
  }
  // BOM snapshots contain plain data. Omit optional object fields; JSON handles
  // undefined array entries and non-finite numbers as null in both encodings.
  const plain = JSON.stringify(snapshot)
  const data = encode(snapshot)
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
