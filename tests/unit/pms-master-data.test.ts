import assert from 'node:assert/strict'
import test from 'node:test'

import {
  advancePmsSupplierStatus,
  createPmsSupplier,
  getPmsSupplier,
  type PmsSupplierInput,
} from '../../src/data/pms/suppliers.ts'
import {
  computePmsSupplyConversion,
  convertPmsSupplyQty,
  listPmsSupplyArchives,
  updatePmsSupplyArchive,
} from '../../src/data/pms/supplier-supply-archives.ts'
import { getPmsMaterial, listPmsMaterials, updatePmsMaterialComplianceInfo, updatePmsMaterialProcurementInfo } from '../../src/data/pms/materials.ts'
import { listPmsProductSkus } from '../../src/data/pms/product-skus.ts'
import { listPmsWarehouses, syncPmsWarehouses } from '../../src/data/pms/warehouses.ts'
import { createPmsUnit, listPmsUnits, togglePmsUnitStatus, updatePmsUnit, type PmsUnitInput } from '../../src/data/pms/units.ts'
import { getPmsBomDetail, submitPmsBomTemplate, updatePmsBomDetail } from '../../src/data/pms/bom-detail.ts'
import { getPmsBomTemplate, updatePmsBomMaterialUsage } from '../../src/data/pms/bom-templates.ts'
import {
  advancePmsProductPurchaseOrderStatus,
  checkPmsGenerateMaterialRequirement,
  generatePmsMaterialRequirement,
  getPmsProductPurchaseOrder,
} from '../../src/data/pms/product-purchase-orders.ts'
import { PMS_BUYER_ACTOR, PMS_MANAGER_ACTOR, PmsDomainError } from '../../src/data/pms/runtime.ts'

test('供应商从草稿到启用遵循状态机，名称唯一', () => {
  const input: PmsSupplierInput = {
    supplierName: '单元测试供应商',
    shortName: '测试供应商',
    category: '面料供应商',
    country: '中国',
    city: '广东广州',
    defaultDeliveryMethod: '供应商直发海外仓',
    contactName: '测试人',
    contactPhone: '13800000001',
    email: '',
    level: 'C级',
    paymentMethod: '月结',
    currency: 'RMB',
    leadTimeDays: 10,
    address: '',
    remark: '',
  }
  const supplier = createPmsSupplier(input, PMS_BUYER_ACTOR)
  assert.equal(supplier.status, '草稿')
  assert.throws(() => createPmsSupplier(input, PMS_BUYER_ACTOR), PmsDomainError)
  advancePmsSupplierStatus(supplier.supplierCode, '待审核', PMS_BUYER_ACTOR)
  advancePmsSupplierStatus(supplier.supplierCode, '已启用', PMS_BUYER_ACTOR)
  assert.equal(getPmsSupplier(supplier.supplierCode)?.status, '已启用')
  assert.throws(() => advancePmsSupplierStatus(supplier.supplierCode, '已驳回', PMS_BUYER_ACTOR, ''), PmsDomainError)
})

test('供货档案包装换算与快照版本', () => {
  const archive = listPmsSupplyArchives()[0]
  const conversion = computePmsSupplyConversion(archive, 250)
  assert.equal(conversion.packageCount, 3)
  assert.equal(conversion.boxCount, 1)
  assert.equal(convertPmsSupplyQty(archive, 2, 'box', 'base'), 800)
  const version = archive.version
  const snapshotCount = archive.snapshots.length
  updatePmsSupplyArchive(archive.archiveId, { boxQty: 5 }, PMS_BUYER_ACTOR)
  assert.equal(archive.version, version + 1)
  assert.equal(archive.snapshots.length, snapshotCount + 1)
  assert.equal(archive.snapshots.at(-1)?.boxQty, 5)
})

test('物料全部有真实图片，采购补充信息可更新且不新增删除', () => {
  const materials = listPmsMaterials()
  assert.equal(materials.length, 14)
  assert.ok(materials.every((material) => material.imageUrl.startsWith('/')))
  updatePmsMaterialProcurementInfo('ACC-2026-0002', { purchaseLeadTimeDays: 9 }, PMS_BUYER_ACTOR)
  assert.equal(getPmsMaterial('ACC-2026-0002')?.purchaseLeadTimeDays, 9)
  assert.throws(() => updatePmsMaterialProcurementInfo('ACC-2026-0002', { purchaseLeadTimeDays: 0 }, PMS_BUYER_ACTOR))
  updatePmsMaterialComplianceInfo('ACC-2026-0002', { declaration: { weavingMethod: 'knitted' }, customs: { domesticSourcePlace: '广东东莞' } }, PMS_BUYER_ACTOR)
  assert.equal(getPmsMaterial('ACC-2026-0002')?.declarationInfo?.weavingMethod, 'knitted')
  assert.equal(getPmsMaterial('ACC-2026-0002')?.customsInfo?.domesticSourcePlace, '广东东莞')
  assert.throws(() => updatePmsMaterialComplianceInfo('ACC-2026-0002', { declaration: { chineseClearanceName: '' } }, PMS_BUYER_ACTOR))
})

test('成衣与样衣 SKU 只读列表数据完整', () => {
  assert.equal(listPmsProductSkus('garment').length, 7)
  assert.equal(listPmsProductSkus('sample').length, 2)
  assert.ok(listPmsProductSkus('garment').every((row) => row.skuItems.length > 0 && row.imageUrl.startsWith('/')))
})

test('仓库同步更新时间，单位字典唯一且不可删除只可启停', () => {
  const warehouses = listPmsWarehouses()
  const before = warehouses[1].syncedAt
  syncPmsWarehouses(PMS_BUYER_ACTOR)
  assert.notEqual(warehouses[1].syncedAt, before)

  const input: PmsUnitInput = { unitName: '单元测试单位', symbol: 'UT', category: '数量', precision: 0, baseUnitCode: '', conversionRate: '', remark: '' }
  const unit = createPmsUnit(input, PMS_BUYER_ACTOR)
  assert.throws(() => createPmsUnit(input, PMS_BUYER_ACTOR), PmsDomainError)
  updatePmsUnit(unit.unitCode, { ...input, symbol: 'UT2' }, PMS_BUYER_ACTOR)
  assert.equal(togglePmsUnitStatus(unit.unitCode, PMS_BUYER_ACTOR).status, '停用')
  assert.equal(listPmsUnits().some((row) => row.unitCode === unit.unitCode), true)
})

test('BOM 用量可修改，说明可保存，发布后可生成面辅料需求', () => {
  updatePmsBomMaterialUsage('HG-TS-2601', 'FAB-2026-0001', { usagePerPiece: 0.4, lossRate: 0.06 }, PMS_BUYER_ACTOR)
  const line = getPmsBomTemplate('HG-TS-2601')?.materials.find((material) => material.materialCode === 'FAB-2026-0001')
  assert.equal(line?.usagePerPiece, 0.4)
  assert.equal(line?.lossRate, 0.06)
  updatePmsBomDetail('HG-TS-2601', { craftNotes: '单元测试工艺备注' }, PMS_BUYER_ACTOR)
  assert.equal(getPmsBomDetail('HG-TS-2601')?.craftNotes, '单元测试工艺备注')

  assert.equal(getPmsBomTemplate('HG-JK-2605')?.status, '未匹配')
  assert.equal(checkPmsGenerateMaterialRequirement('CG-2026-0019').ok, false)
  submitPmsBomTemplate('HG-JK-2605', PMS_MANAGER_ACTOR)
  assert.equal(getPmsBomTemplate('HG-JK-2605')?.status, '已发布')
  advancePmsProductPurchaseOrderStatus('CG-2026-0019', '待采购', PMS_BUYER_ACTOR)
  assert.equal(checkPmsGenerateMaterialRequirement('CG-2026-0019').ok, true)
  const result = generatePmsMaterialRequirement('CG-2026-0019', PMS_BUYER_ACTOR)
  assert.ok(result.lines.length > 0)
  assert.equal(getPmsProductPurchaseOrder('CG-2026-0019')?.lines.every((item) => !item.needBom || item.materialStatus === '已生成'), true)
})
