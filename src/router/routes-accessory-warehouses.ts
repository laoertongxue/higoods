import type { RouteRegistry } from './route-types.ts'
import { prepareAccessoryWarehouseSources } from '../data/wls/accessory-warehouse-sources.ts'
import { withAccessoryWarehouseRecords } from '../data/wls/accessory-warehouse-records.ts'
import { renderGtpPreparationPage } from '../pages/wls/accessory-warehouses/gtp-preparation.ts'
import { renderAccessoryLocations } from '../pages/wls/accessory-warehouses/locations.ts'
import { renderAccessoryTransfersPage } from '../pages/wls/accessory-warehouses/transfers.ts'
import { prepareAccessorySewing } from '../data/wls/accessory-warehouse-sewing.ts'
import { renderAccessorySewingPickupPage } from '../pages/wls/accessory-warehouses/pickups.ts'

/** 本任务页面自行读取必要来源，避免冷入口先加载其他仓库/工艺的演示状态。 */
export const routes: RouteRegistry = {
  exactRoutes: {
    '/wls/accessory-warehouses/gtp/preparation': () => withAccessoryWarehouseRecords(renderGtpPreparationPage, prepareAccessoryWarehouseSources),
    '/wls/accessory-warehouses/gtp/locations': () => renderAccessoryLocations('gtp'),
    '/wls/accessory-warehouses/hilon/locations': () => renderAccessoryLocations('hilon'),
    '/wls/accessory-warehouses/mahameru/locations': () => renderAccessoryLocations('mahameru'),
    ...Object.fromEntries((['gtp', 'hilon', 'mahameru'] as const).flatMap(key => (['transfers', 'receipts', 'stock'] as const)
      .filter(view => key !== 'gtp' || view !== 'receipts')
      .map(view => [`/wls/accessory-warehouses/${key}/${view}`, () => withAccessoryWarehouseRecords(() => renderAccessoryTransfersPage(key, view))]))),
    ...Object.fromEntries((['hilon', 'mahameru'] as const).map(key => [`/wls/accessory-warehouses/${key}/pickups`,
      () => withAccessoryWarehouseRecords(() => renderAccessorySewingPickupPage(key), prepareAccessorySewing)])),
  },
  dynamicRoutes: [],
}
