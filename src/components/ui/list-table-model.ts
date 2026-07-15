export type StandardListSortDirection = 'asc' | 'desc'

export interface StandardListSortState {
  key: string
  direction: StandardListSortDirection
}

export interface StandardListColumnRule {
  key: string
  required?: boolean
  freezeable?: boolean
  actionColumn?: boolean
}

export interface StandardListColumnPreferences {
  order: string[]
  visibleKeys: string[]
  frozenKeys: string[]
  pageSize: number
}

export interface StandardListPageSlice<T> {
  rows: T[]
  total: number
  currentPage: number
  totalPages: number
  pageSize: number
  from: number
  to: number
}

interface StandardListStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): unknown
  removeItem(key: string): unknown
}

function uniqueKnownKeys(value: unknown, knownKeys: Set<string>): string[] {
  if (!Array.isArray(value)) return []

  const seen = new Set<string>()
  return value.filter((key): key is string => {
    if (typeof key !== 'string' || !knownKeys.has(key) || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function normalizeListColumnPreferences(
  rules: StandardListColumnRule[],
  raw: Partial<StandardListColumnPreferences> | null | undefined,
  allowedPageSizes: number[],
): StandardListColumnPreferences {
  const knownKeys = new Set(rules.map((rule) => rule.key))
  const actionKeys = new Set(rules.filter((rule) => rule.actionColumn).map((rule) => rule.key))
  const regularKeys = rules.filter((rule) => !rule.actionColumn).map((rule) => rule.key)
  const orderedRegularKeys = uniqueKnownKeys(raw?.order, knownKeys).filter(
    (key) => !actionKeys.has(key),
  )
  for (const key of regularKeys) {
    if (!orderedRegularKeys.includes(key)) orderedRegularKeys.push(key)
  }

  const visibleKeys = uniqueKnownKeys(raw?.visibleKeys, knownKeys)
  for (const rule of rules) {
    if ((rule.required || rule.actionColumn) && !visibleKeys.includes(rule.key)) {
      visibleKeys.push(rule.key)
    }
  }

  const freezeableKeys = new Set(
    rules
      .filter((rule) => rule.freezeable && !rule.actionColumn)
      .map((rule) => rule.key),
  )
  const frozenKeys = uniqueKnownKeys(raw?.frozenKeys, knownKeys).filter((key) =>
    freezeableKeys.has(key),
  )

  const safePageSizes = allowedPageSizes.filter(
    (size, index) => Number.isInteger(size) && size > 0 && allowedPageSizes.indexOf(size) === index,
  )
  const pageSize =
    typeof raw?.pageSize === 'number' && safePageSizes.includes(raw.pageSize)
      ? raw.pageSize
      : (safePageSizes[0] ?? 10)

  return {
    order: [...orderedRegularKeys, ...rules.filter((rule) => rule.actionColumn).map((rule) => rule.key)],
    visibleKeys,
    frozenKeys,
    pageSize,
  }
}

function isEmptySortValue(value: unknown): boolean {
  return value === null || value === undefined || value === '' ||
    (typeof value === 'number' && Number.isNaN(value))
}

export function sortStandardListRows<T>(
  rows: readonly T[],
  sort: StandardListSortState | null,
  getValue: (row: T, key: string) => unknown,
): T[] {
  if (!sort) return [...rows]

  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const leftValue = getValue(left.row, sort.key)
      const rightValue = getValue(right.row, sort.key)
      const leftEmpty = isEmptySortValue(leftValue)
      const rightEmpty = isEmptySortValue(rightValue)

      if (leftEmpty || rightEmpty) {
        if (leftEmpty && rightEmpty) return left.index - right.index
        return leftEmpty ? 1 : -1
      }

      const comparison =
        typeof leftValue === 'number' && typeof rightValue === 'number'
          ? leftValue - rightValue
          : String(leftValue).localeCompare(String(rightValue), 'zh-CN')
      if (comparison === 0) return left.index - right.index
      return sort.direction === 'asc' ? comparison : -comparison
    })
    .map(({ row }) => row)
}

export function paginateStandardListRows<T>(
  rows: readonly T[],
  currentPage: number,
  pageSize: number,
): StandardListPageSlice<T> {
  const safePageSize = Number.isFinite(pageSize) ? Math.max(1, Math.floor(pageSize)) : 1
  const total = rows.length
  const totalPages = Math.max(1, Math.ceil(total / safePageSize))
  const requestedPage = Number.isFinite(currentPage) ? Math.max(1, Math.floor(currentPage)) : 1
  const safeCurrentPage = Math.min(requestedPage, totalPages)
  const start = (safeCurrentPage - 1) * safePageSize
  const pageRows = rows.slice(start, start + safePageSize)

  return {
    rows: pageRows,
    total,
    currentPage: safeCurrentPage,
    totalPages,
    pageSize: safePageSize,
    from: total === 0 ? 0 : start + 1,
    to: total === 0 ? 0 : start + pageRows.length,
  }
}

export function loadListColumnPreferences(
  storage: Pick<StandardListStorage, 'getItem'>,
  storageKey: string,
  rules: StandardListColumnRule[],
  defaults: StandardListColumnPreferences,
  allowedPageSizes: number[],
): StandardListColumnPreferences {
  const normalizedDefaults = normalizeListColumnPreferences(rules, defaults, allowedPageSizes)

  try {
    const storedValue = storage.getItem(storageKey)
    if (storedValue === null) return normalizedDefaults
    return normalizeListColumnPreferences(rules, JSON.parse(storedValue), allowedPageSizes)
  } catch {
    return normalizedDefaults
  }
}

export function saveListColumnPreferences(
  storage: Pick<StandardListStorage, 'setItem'>,
  storageKey: string,
  preferences: StandardListColumnPreferences,
): void {
  try {
    storage.setItem(storageKey, JSON.stringify(preferences))
  } catch {
    // 本地偏好保存失败不应阻断列表操作。
  }
}

export function clearListColumnPreferences(
  storage: Pick<StandardListStorage, 'removeItem'>,
  storageKey: string,
): void {
  try {
    storage.removeItem(storageKey)
  } catch {
    // 本地偏好清除失败不应阻断列表操作。
  }
}
