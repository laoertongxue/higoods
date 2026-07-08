import { createTechnicalDataVersionBootstrapSnapshot } from '../src/data/pcs-technical-data-version-bootstrap.ts'

const legacyStorageKey = 'higood-pcs-technical-data-version-store-v4'
const storage = new Map<string, string>()

globalThis.localStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value)
  },
  removeItem: (key: string) => {
    storage.delete(key)
  },
  clear: () => {
    storage.clear()
  },
  key: (index: number) => Array.from(storage.keys())[index] ?? null,
  get length() {
    return storage.size
  },
} as Storage

const legacySnapshot = createTechnicalDataVersionBootstrapSnapshot(4)
const target = legacySnapshot.records.find((record) => record.styleCode === 'SPU-2024-004')
if (!target) throw new Error('缺少 SPU-2024-004 技术包种子')

legacySnapshot.contents = legacySnapshot.contents.map((content) =>
  content.technicalVersionId === target.technicalVersionId
    ? { ...content, processRouteStatus: 'DRAFT' }
    : content,
)
storage.set(legacyStorageKey, JSON.stringify(legacySnapshot))

const { productionOrders } = await import('../src/data/fcs/production-orders.ts')

if (!productionOrders.some((order) => order.productionOrderId === 'PO-202603-0001')) {
  throw new Error('旧技术包缓存隔离后必须能加载 PO-202603-0001')
}

console.log('check-technical-version-storage-migration: ok')
