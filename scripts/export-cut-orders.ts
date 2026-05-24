import { buildCutOrdersProjection } from '../src/pages/process-factory/cutting/cut-orders-projection.ts'
import { writeFileSync } from 'fs'

;(globalThis as any).localStorage = {
  _data: {} as Record<string, string>,
  getItem(key: string) { return this._data[key] ?? null },
  setItem(key: string, value: string) { this._data[key] = value },
  removeItem(key: string) { delete this._data[key] },
  clear() { this._data = {} },
}
;(globalThis as any).sessionStorage = (globalThis as any).localStorage

const projection = buildCutOrdersProjection()
const rows = projection.viewModel.rows

writeFileSync(
  '../higoods-next/src/lib/mock/cut-orders.json',
  JSON.stringify({ rows, total: rows.length }, null, 2),
)
console.log(`Exported ${rows.length} rows`)
