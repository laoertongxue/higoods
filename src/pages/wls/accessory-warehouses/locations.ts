// @page-pattern: list
// @list-pagination: none — 每仓固定6个演示库位，一次展示完整归属便于核对。
import { renderStandardListPage } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { getAccessoryWarehouse, listAccessoryWarehouseLocations, type AccessoryWarehouseKey, type AccessoryWarehouseLocation } from '../../../data/wls/accessory-warehouse-master.ts'
import { escapeHtml } from '../../../utils.ts'

const columns: StandardListColumn<AccessoryWarehouseLocation>[] = [
  { key: 'code', title: '库位', width: 180, required: true, render: row => escapeHtml(row.locationCode) },
  { key: 'warehouse', title: '仓库', width: 220, required: true, render: row => escapeHtml(row.warehouseName) },
  { key: 'zone', title: '库区', width: 180, render: row => escapeHtml(row.zoneName) },
  { key: 'enabled', title: '状态', width: 100, render: row => row.enabled ? '启用' : '停用' },
]
export function renderAccessoryLocations(key: AccessoryWarehouseKey): string {
  const warehouse = getAccessoryWarehouse(key)
  return `<div data-accessory-locations="${escapeHtml(key)}">${renderStandardListPage({
    title: `${warehouse.name} · 库区库位`,
    filtersHtml: '', listTitle: '固定演示库位',
    tableHtml: renderStandardListTable({ columns, rows: listAccessoryWarehouseLocations(warehouse.code), preferences: { order: columns.map(column => column.key), visibleKeys: columns.map(column => column.key), frozenKeys: [], pageSize: 10 }, sort: null, eventPrefix: 'accessory' }),
    paginationHtml: '',
  })}</div>`
}
