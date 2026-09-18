import { appendPmsLog, type PmsActorRole } from './runtime.ts'

export type PmsWarehouseType = '面辅料仓' | '加工仓' | '成衣仓' | '样衣仓' | '中转仓' | '退货仓'

export interface PmsWarehouse {
  warehouseCode: string
  warehouseName: string
  warehouseType: PmsWarehouseType
  warehouseAttribute: '自建' | '第三方' | '合作仓'
  ownerEntity: string
  countryOrRegion: '中国' | '印度尼西亚'
  timezone: string
  city: string
  address: string
  manager: string
  phone: string
  email: string
  postalCode: string
  storageAreaM2: number
  availableForPurchaseRequest: boolean
  availableForPurchaseOrder: boolean
  availableForShipment: boolean
  relatedPurchaseOrderCount: number
  recentUsedTime: string
  status: '启用' | '停用'
  sourceSystem: 'WMS'
  sourceWarehouseCode: string
  syncStatus: '已同步' | '同步异常'
  syncRemark: string
  syncedAt: string
  remark: string
}

const seeds: PmsWarehouse[] = [
  { warehouseCode: 'WH-CN-GZ-01', warehouseName: '广州原料仓', warehouseType: '面辅料仓', warehouseAttribute: '自建', ownerEntity: '深圳市海谷科技有限公司', countryOrRegion: '中国', timezone: 'Asia/Shanghai', city: '广州', address: '广东省广州市白云区物流大道 8 号', manager: '刘仓管', phone: '13800138301', email: 'gz-cang@higood.com', postalCode: '510000', storageAreaM2: 3600, availableForPurchaseRequest: true, availableForPurchaseOrder: true, availableForShipment: true, relatedPurchaseOrderCount: 46, recentUsedTime: '2026-06-16 09:20:00', status: '启用', sourceSystem: 'WMS', sourceWarehouseCode: 'WMS-GZ-001', syncStatus: '已同步', syncRemark: '', syncedAt: '2026-06-12 08:30:00', remark: '面辅料集货主仓' },
  { warehouseCode: 'WH-CN-GZ-02', warehouseName: '广州辅料仓', warehouseType: '面辅料仓', warehouseAttribute: '自建', ownerEntity: '深圳市海谷科技有限公司', countryOrRegion: '中国', timezone: 'Asia/Shanghai', city: '广州', address: '广东省广州市白云区物流大道 9 号 B 区', manager: '陈仓管', phone: '13800138302', email: 'gz-fl@higood.com', postalCode: '510000', storageAreaM2: 1800, availableForPurchaseRequest: true, availableForPurchaseOrder: true, availableForShipment: true, relatedPurchaseOrderCount: 31, recentUsedTime: '2026-06-15 15:40:00', status: '启用', sourceSystem: 'WMS', sourceWarehouseCode: 'WMS-GZ-002', syncStatus: '已同步', syncRemark: '', syncedAt: '2026-06-12 08:30:00', remark: '' },
  { warehouseCode: 'WH-CN-FS-01', warehouseName: '佛山成品仓', warehouseType: '成衣仓', warehouseAttribute: '第三方', ownerEntity: '佛山仓储服务有限公司', countryOrRegion: '中国', timezone: 'Asia/Shanghai', city: '佛山', address: '广东省佛山市南海区工业大道 66 号', manager: '黄仓管', phone: '13800138303', email: 'fs-ck@higood.com', postalCode: '528000', storageAreaM2: 5200, availableForPurchaseRequest: false, availableForPurchaseOrder: false, availableForShipment: true, relatedPurchaseOrderCount: 12, recentUsedTime: '2026-06-14 11:10:00', status: '启用', sourceSystem: 'WMS', sourceWarehouseCode: 'WMS-FS-001', syncStatus: '已同步', syncRemark: '', syncedAt: '2026-06-11 17:00:00', remark: '' },
  { warehouseCode: 'WH-CN-YW-01', warehouseName: '义乌中转仓', warehouseType: '中转仓', warehouseAttribute: '合作仓', ownerEntity: '义乌陆港供应链管理有限公司', countryOrRegion: '中国', timezone: 'Asia/Shanghai', city: '义乌', address: '浙江省义乌市陆港新区 5 号库', manager: '吴仓管', phone: '13800138304', email: 'yw-hub@higood.com', postalCode: '322000', storageAreaM2: 2400, availableForPurchaseRequest: true, availableForPurchaseOrder: true, availableForShipment: true, relatedPurchaseOrderCount: 18, recentUsedTime: '2026-06-15 09:00:00', status: '启用', sourceSystem: 'WMS', sourceWarehouseCode: 'WMS-YW-001', syncStatus: '已同步', syncRemark: '', syncedAt: '2026-06-12 08:30:00', remark: '空卡与卡航集货' },
  { warehouseCode: 'WH-ID-JKT-01', warehouseName: '印尼雅加达面辅料仓', warehouseType: '面辅料仓', warehouseAttribute: '自建', ownerEntity: 'PT. HiGood Indonesia', countryOrRegion: '印度尼西亚', timezone: 'Asia/Jakarta', city: '雅加达', address: 'Jl. Industri Raya No. 12, Jakarta', manager: 'Andi', phone: '081200010301', email: 'jkt-mat@higood.co.id', postalCode: '14140', storageAreaM2: 4800, availableForPurchaseRequest: true, availableForPurchaseOrder: true, availableForShipment: true, relatedPurchaseOrderCount: 28, recentUsedTime: '2026-06-16 08:50:00', status: '启用', sourceSystem: 'WMS', sourceWarehouseCode: 'WMS-JKT-001', syncStatus: '已同步', syncRemark: '', syncedAt: '2026-06-12 09:00:00', remark: '头程到仓主仓' },
  { warehouseCode: 'WH-ID-JKT-02', warehouseName: '印尼雅加达成品仓', warehouseType: '成衣仓', warehouseAttribute: '自建', ownerEntity: 'PT. HiGood Indonesia', countryOrRegion: '印度尼西亚', timezone: 'Asia/Jakarta', city: '雅加达', address: 'Jl. Gudang Peluru No. 8, Jakarta', manager: 'Budi', phone: '081200010302', email: 'jkt-fg@higood.co.id', postalCode: '12950', storageAreaM2: 6200, availableForPurchaseRequest: false, availableForPurchaseOrder: false, availableForShipment: true, relatedPurchaseOrderCount: 9, recentUsedTime: '2026-06-13 16:00:00', status: '启用', sourceSystem: 'WMS', sourceWarehouseCode: 'WMS-JKT-002', syncStatus: '已同步', syncRemark: '', syncedAt: '2026-06-12 09:00:00', remark: '' },
  { warehouseCode: 'WH-ID-BDG-01', warehouseName: '印尼万隆原料仓', warehouseType: '面辅料仓', warehouseAttribute: '合作仓', ownerEntity: 'PT. Bandung Logistics', countryOrRegion: '印度尼西亚', timezone: 'Asia/Jakarta', city: '万隆', address: 'Jl. Soekarno Hatta No. 210, Bandung', manager: 'Dedi', phone: '081200010303', email: 'bdg@higood.co.id', postalCode: '40286', storageAreaM2: 3000, availableForPurchaseRequest: true, availableForPurchaseOrder: true, availableForShipment: true, relatedPurchaseOrderCount: 7, recentUsedTime: '2026-06-09 10:30:00', status: '启用', sourceSystem: 'WMS', sourceWarehouseCode: 'WMS-BDG-001', syncStatus: '同步异常', syncRemark: 'WMS 推送延迟，等待重试', syncedAt: '2026-06-10 16:20:00', remark: '卡航专线目的仓' },
  { warehouseCode: 'WH-ID-SUB-01', warehouseName: '印尼泗水原料仓', warehouseType: '面辅料仓', warehouseAttribute: '合作仓', ownerEntity: 'PT. Surabaya Warehousing', countryOrRegion: '印度尼西亚', timezone: 'Asia/Jakarta', city: '泗水', address: 'Jl. Rungkut Industri No. 45, Surabaya', manager: 'Eko', phone: '081200010304', email: 'sub@higood.co.id', postalCode: '60293', storageAreaM2: 2800, availableForPurchaseRequest: true, availableForPurchaseOrder: true, availableForShipment: true, relatedPurchaseOrderCount: 5, recentUsedTime: '2026-06-08 14:10:00', status: '启用', sourceSystem: 'WMS', sourceWarehouseCode: 'WMS-SUB-001', syncStatus: '已同步', syncRemark: '', syncedAt: '2026-06-10 16:20:00', remark: '' },
  { warehouseCode: 'WH-CN-HZ-01', warehouseName: '杭州样衣仓', warehouseType: '样衣仓', warehouseAttribute: '自建', ownerEntity: '深圳市海谷科技有限公司', countryOrRegion: '中国', timezone: 'Asia/Shanghai', city: '杭州', address: '浙江省杭州市余杭区服装小镇 2 号库', manager: '孙仓管', phone: '13800138305', email: 'hz-sample@higood.com', postalCode: '311100', storageAreaM2: 900, availableForPurchaseRequest: false, availableForPurchaseOrder: false, availableForShipment: true, relatedPurchaseOrderCount: 4, recentUsedTime: '2026-06-07 09:40:00', status: '启用', sourceSystem: 'WMS', sourceWarehouseCode: 'WMS-HZ-001', syncStatus: '已同步', syncRemark: '', syncedAt: '2026-06-09 10:00:00', remark: '样衣开发与展示样管理' },
  { warehouseCode: 'WH-CN-GZ-03', warehouseName: '广州加工仓', warehouseType: '加工仓', warehouseAttribute: '合作仓', ownerEntity: '广州联达加工服务有限公司', countryOrRegion: '中国', timezone: 'Asia/Shanghai', city: '广州', address: '广东省广州市增城区加工产业园 12 号', manager: '梁仓管', phone: '13800138307', email: 'gz-process@higood.com', postalCode: '511300', storageAreaM2: 2100, availableForPurchaseRequest: true, availableForPurchaseOrder: true, availableForShipment: true, relatedPurchaseOrderCount: 6, recentUsedTime: '2026-06-14 09:30:00', status: '启用', sourceSystem: 'WMS', sourceWarehouseCode: 'WMS-GZ-003', syncStatus: '已同步', syncRemark: '', syncedAt: '2026-06-12 08:30:00', remark: '外发加工领料与回货' },
  { warehouseCode: 'WH-ID-RTN-01', warehouseName: '印尼退货仓', warehouseType: '退货仓', warehouseAttribute: '自建', ownerEntity: 'PT. HiGood Indonesia', countryOrRegion: '印度尼西亚', timezone: 'Asia/Jakarta', city: '雅加达', address: 'Jl. Retur Industri No. 3, Jakarta', manager: 'Rina', phone: '081200010305', email: 'rtn@higood.co.id', postalCode: '14140', storageAreaM2: 1100, availableForPurchaseRequest: false, availableForPurchaseOrder: false, availableForShipment: false, relatedPurchaseOrderCount: 2, recentUsedTime: '2026-06-05 11:20:00', status: '启用', sourceSystem: 'WMS', sourceWarehouseCode: 'WMS-RTN-001', syncStatus: '已同步', syncRemark: '', syncedAt: '2026-06-10 16:20:00', remark: '次品与退货暂存' },
  { warehouseCode: 'WH-CN-DG-01', warehouseName: '东莞临时仓', warehouseType: '中转仓', warehouseAttribute: '第三方', ownerEntity: '东莞捷运仓储有限公司', countryOrRegion: '中国', timezone: 'Asia/Shanghai', city: '东莞', address: '广东省东莞市虎门镇临时库 3 号', manager: '周仓管', phone: '13800138306', email: 'dg-tmp@higood.com', postalCode: '523000', storageAreaM2: 1200, availableForPurchaseRequest: false, availableForPurchaseOrder: false, availableForShipment: false, relatedPurchaseOrderCount: 0, recentUsedTime: '2026-05-28 10:00:00', status: '停用', sourceSystem: 'WMS', sourceWarehouseCode: 'WMS-DG-001', syncStatus: '已同步', syncRemark: '', syncedAt: '2026-05-30 09:00:00', remark: '场地到期停用' },
]

export function listPmsWarehouses(): PmsWarehouse[] {
  return seeds
}

export function getPmsWarehouse(warehouseCode: string): PmsWarehouse | undefined {
  return seeds.find((warehouse) => warehouse.warehouseCode === warehouseCode)
}

export function syncPmsWarehouses(actor: { id: string; name: string; role: PmsActorRole }): { count: number; syncedAt: string } {
  const syncedAt = new Date().toISOString()
  seeds.forEach((warehouse) => {
    warehouse.syncedAt = syncedAt
  })
  appendPmsLog({ objectType: 'warehouse', objectId: 'ALL', action: '同步 WMS 仓库档案', beforeValue: '', afterValue: `${seeds.length} 个仓库`, reason: '只读同步', actorId: actor.id, actorName: actor.name, actorRole: actor.role })
  return { count: seeds.length, syncedAt }
}
