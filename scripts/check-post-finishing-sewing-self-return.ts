import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  FULL_CAPABILITY_FACTORY_ID,
  FULL_CAPABILITY_FACTORY_NAME,
  SEWING_SELF_RETURN_DEFAULT_AREA_NAME,
  SEWING_SELF_RETURN_DEFAULT_LOCATION_CODE,
  confirmPostFinishingSewingSelfReturnReceipt,
  ensurePostFinishingSewingSelfReturnMockRecords,
  getPostFinishingSewingSelfReturnDemoScanValue,
  getPostFinishingWaitProcessReceiptConfirmStatus,
  listPostFinishingSewingSelfReturnRecords,
  listPostFinishingWaitProcessWarehouseRecords,
  rejectPostFinishingSewingSelfReturnReceipt,
  resetPostFinishingSewingSelfReturnDemoRecords,
  resolvePostFinishingSewingSelfReturnScan,
} from '../src/data/fcs/post-finishing-domain.ts'
import {
  createPostFinishingSewingSelfReturnAndSyncHandover,
  getPdaHandoutHeads,
  getPdaHandoverRecordsByHead,
  getPdaPickupRecordsByHead,
  getPdaPostFinishingPickupHeads,
  syncAllPostFinishingSewingSelfReturnHandoverRecords,
} from '../src/data/fcs/pda-handover-events.ts'
import {
  PDA_SEWING_SELF_RETURN_MODE_ROUTE,
  activatePdaSewingSelfReturnMode,
  clearPdaSewingSelfReturnMode,
  isPdaSewingSelfReturnModeLocked,
  shouldBlockPdaRouteBySewingSelfReturnMode,
} from '../src/data/fcs/pda-sewing-self-return-mode.ts'
import { renderPostFinishingWaitProcessWarehousePage } from '../src/pages/process-factory/post-finishing/warehouse.ts'

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

function assertThrows(fn: () => unknown, expected: string): void {
  try {
    fn()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    assert(message.includes(expected), `异常信息应包含「${expected}」，实际为「${message}」`)
    return
  }
  throw new Error(`预期抛出异常：${expected}`)
}

function readProjectFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

function renderWaitProcessWarehouseWithQuery(query: string): string {
  const previousWindow = (globalThis as { window?: unknown }).window
  const storage: Record<string, string> = {}
  ;(globalThis as { window?: unknown }).window = {
    location: { search: query },
    localStorage: {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => {
        storage[key] = value
      },
      removeItem: (key: string) => {
        delete storage[key]
      },
    },
  }
  try {
    return renderPostFinishingWaitProcessWarehousePage()
  } finally {
    if (previousWindow === undefined) {
      delete (globalThis as { window?: unknown }).window
    } else {
      ;(globalThis as { window?: unknown }).window = previousWindow
    }
  }
}

resetPostFinishingSewingSelfReturnDemoRecords()
clearPdaSewingSelfReturnMode()

const demoScanValue = getPostFinishingSewingSelfReturnDemoScanValue()
const scanResult = resolvePostFinishingSewingSelfReturnScan(demoScanValue)
assert(scanResult.sourceFactoryType === '车缝厂', '生产确认单应识别到车缝工厂来源')
assert(scanResult.items.length >= 2, '演示生产确认单应包含至少两个颜色尺码明细')
assert(scanResult.defaultAreaName === SEWING_SELF_RETURN_DEFAULT_AREA_NAME, '默认库区必须是车缝自助交货暂存区')
assert(scanResult.defaultLocationCode === SEWING_SELF_RETURN_DEFAULT_LOCATION_CODE, '默认库位必须是默认库位')

assertThrows(
  () => resolvePostFinishingSewingSelfReturnScan(JSON.stringify({ documentType: 'TASK_DELIVERY_CARD', sourceType: 'HANDOVER_RECORD', sourceId: 'HDR-001' })),
  '不是生产确认单',
)
assertThrows(
  () => resolvePostFinishingSewingSelfReturnScan(JSON.stringify({ documentType: 'PRODUCTION_CONFIRMATION', sourceType: 'PRODUCTION_ORDER', sourceId: scanResult.productionOrderId, isVoid: true })),
  '已作废',
)
assertThrows(
  () => resolvePostFinishingSewingSelfReturnScan(JSON.stringify({ documentType: 'PRODUCTION_CONFIRMATION', sourceType: 'PRODUCTION_ORDER', sourceId: 'PO-NOT-TARGET' })),
  '车缝任务或后道工厂',
)

const created = createPostFinishingSewingSelfReturnAndSyncHandover({
  scanValue: demoScanValue,
  deliveryPersonName: '车缝送货员 A',
  deliveryPersonPhone: '0812-0000-0001',
  evidenceText: '纸质生产确认单随货，现场签名。',
  deviceFactoryId: FULL_CAPABILITY_FACTORY_ID,
  deviceFactoryName: FULL_CAPABILITY_FACTORY_NAME,
  deviceUserName: '后道管理员',
  items: scanResult.items.slice(0, 2).map((item, index) => ({
    skuLineId: item.skuLineId,
    submittedQty: index === 0 ? 12 : 8,
  })),
})

assert(created.status === '待后道确认', '自助回货主记录提交后应为待后道确认')
assert(created.items.length === 2, '自助回货主记录必须保留 items 明细')
assert(created.productionConfirmationNo && created.productionOrderNo && created.sourceTaskNo, '主记录必须保留生产确认单、生产单和车缝任务')
assert(created.sourceFactoryName && created.deviceFactoryName && created.submittedByName, '主记录必须保留车缝工厂、后道公共 PDA 和送货人')
assert(created.defaultAreaName === SEWING_SELF_RETURN_DEFAULT_AREA_NAME, '主记录默认库区必须写死为自助交货暂存区')
assert(created.defaultLocationCode === SEWING_SELF_RETURN_DEFAULT_LOCATION_CODE, '主记录默认库位必须写死为默认库位')
assert(created.handoverRecordNos.length === created.items.length, '主记录必须关联车缝侧交出记录号')
assert(created.warehouseRecordNos.length === created.items.length, '主记录必须关联后道入库记录号')

const persistedRecords = listPostFinishingSewingSelfReturnRecords()
assert(persistedRecords.some((record) => record.recordId === created.recordId), '自助回货主记录应写入记录列表')

const handoutHeads = getPdaHandoutHeads(created.sourceFactoryId)
const handoutHead = handoutHeads.find((head) => head.handoverId === created.handoverOrderId)
assert(handoutHead, '车缝厂 PDA 待交出单下应新增交出单')
const handoutRecords = getPdaHandoverRecordsByHead(created.handoverOrderId)
assert(handoutRecords.length === created.items.length, '车缝厂 PDA 交出单下应新增交出记录')
assert(handoutRecords.every((record) => record.factorySubmittedBy?.includes('后道公共 PDA 现场登记')), '车缝侧交出记录应标记来源为后道公共 PDA 现场登记')

let warehouseRows = listPostFinishingWaitProcessWarehouseRecords().filter((record) => record.selfReturnRecordId === created.recordId)
assert(warehouseRows.length === created.items.length, '后道待加工仓应生成同数量的待确认入库记录')
assert(warehouseRows.every((record) => record.postSourceLabel === '车缝自助回货'), '后道入库记录来源应为车缝自助回货')
assert(warehouseRows.every((record) => getPostFinishingWaitProcessReceiptConfirmStatus(record) === '待后道确认'), '自助回货入库记录初始应待后道确认')
assert(warehouseRows.every((record) => record.availableGarmentQty === 0), '待后道确认记录不能计入可用库存')
assert(warehouseRows.every((record) => record.areaName === SEWING_SELF_RETURN_DEFAULT_AREA_NAME && record.locationCode === SEWING_SELF_RETURN_DEFAULT_LOCATION_CODE), '自助回货记录必须进入写死默认库位')

const confirmed = confirmPostFinishingSewingSelfReturnReceipt({
  recordId: created.recordId,
  confirmerName: '后道仓管员',
  remark: '现场核对无差异。',
  lines: created.items.map((item) => ({
    itemId: item.itemId,
    confirmedQty: item.submittedQty,
  })),
})
assert(confirmed.status === '已确认入库', '确认数量一致时主记录应为已确认入库')
warehouseRows = listPostFinishingWaitProcessWarehouseRecords().filter((record) => record.selfReturnRecordId === created.recordId)
assert(warehouseRows.every((record) => getPostFinishingWaitProcessReceiptConfirmStatus(record) === '已确认入库'), '确认数量一致时仓库记录应为已确认入库')
assert(warehouseRows.every((record) => record.availableGarmentQty === record.confirmedGarmentQty), '确认后可用数量应等于确认数量')

const diffCreated = createPostFinishingSewingSelfReturnAndSyncHandover({
  scanValue: demoScanValue,
  deliveryPersonName: '车缝送货员 B',
  deviceFactoryId: FULL_CAPABILITY_FACTORY_ID,
  deviceFactoryName: FULL_CAPABILITY_FACTORY_NAME,
  deviceUserName: '后道管理员',
  items: [scanResult.items[0]].map((item) => ({
    skuLineId: item.skuLineId,
    submittedQty: 10,
  })),
})
const diffConfirmed = confirmPostFinishingSewingSelfReturnReceipt({
  recordId: diffCreated.recordId,
  confirmerName: '后道仓管员',
  remark: '现场实点少 2 件。',
  lines: [{
    itemId: diffCreated.items[0].itemId,
    confirmedQty: 8,
  }],
})
assert(diffConfirmed.status === '数量差异待处理', '确认数量不一致时主记录应为数量差异待处理')
const diffWarehouseRow = listPostFinishingWaitProcessWarehouseRecords().find((record) => record.selfReturnRecordId === diffCreated.recordId)
assert(diffWarehouseRow, '差异确认后应仍保留仓库记录')
assert(getPostFinishingWaitProcessReceiptConfirmStatus(diffWarehouseRow!) === '数量差异待处理', '差异确认后仓库记录应为数量差异待处理')
assert(diffWarehouseRow!.availableGarmentQty === 8, '差异确认后可用数量应按后道确认数量计算')

const rejectedCreated = createPostFinishingSewingSelfReturnAndSyncHandover({
  scanValue: demoScanValue,
  deliveryPersonName: '车缝送货员 C',
  deviceFactoryId: FULL_CAPABILITY_FACTORY_ID,
  deviceFactoryName: FULL_CAPABILITY_FACTORY_NAME,
  deviceUserName: '后道管理员',
  items: [scanResult.items[0]].map((item) => ({
    skuLineId: item.skuLineId,
    submittedQty: 6,
  })),
})
const rejected = rejectPostFinishingSewingSelfReturnReceipt({
  recordId: rejectedCreated.recordId,
  rejectReason: '纸质单据与实物不一致，退回车缝工厂。',
  rejectedBy: '后道仓管员',
})
assert(rejected.status === '已驳回', '驳回后主记录应为已驳回')
const rejectedWarehouseRow = listPostFinishingWaitProcessWarehouseRecords().find((record) => record.selfReturnRecordId === rejectedCreated.recordId)
assert(rejectedWarehouseRow?.availableGarmentQty === 0, '驳回后不能产生可用库存')

resetPostFinishingSewingSelfReturnDemoRecords()
const mockRecords = ensurePostFinishingSewingSelfReturnMockRecords()
syncAllPostFinishingSewingSelfReturnHandoverRecords()
const mockRecordIds = new Set(mockRecords.map((record) => record.recordId))
const mockWarehouseRows = listPostFinishingWaitProcessWarehouseRecords().filter((record) => record.selfReturnRecordId && mockRecordIds.has(record.selfReturnRecordId))
assert(mockRecords.length >= 2, '后道普通交接页必须能展示车缝自助回货 mock 数据')
assert(mockRecords.every((record) => record.status === '待后道确认'), '车缝自助回货 mock 数据应为待后道确认状态')
assert(mockWarehouseRows.length >= mockRecords.length, '车缝自助回货 mock 数据应同步生成后道待确认入库记录')
const webWaitProcessWarehouseHtml = renderPostFinishingWaitProcessWarehousePage()
assert(webWaitProcessWarehouseHtml.includes('待确认的车缝自助回货'), '管理端后道待加工仓必须新增待确认的车缝自助回货 tab')
assert(!webWaitProcessWarehouseHtml.includes(mockRecords[0].recordNo), '管理端后道待加工仓库存 tab 不应混入待确认自助回货记录')
const webPendingSelfReturnHtml = renderWaitProcessWarehouseWithQuery('?tab=pending-self-return')
assert(webPendingSelfReturnHtml.includes('待确认的车缝自助回货') && webPendingSelfReturnHtml.includes(mockRecords[0].recordNo), '管理端待确认自助回货 tab 必须展示待确认记录')
assert(webPendingSelfReturnHtml.includes('确认入库') && webPendingSelfReturnHtml.includes('open-self-return-confirm') && webPendingSelfReturnHtml.includes('待后道确认'), '管理端待确认自助回货 tab 必须支持直接确认入库')
assert(!webPendingSelfReturnHtml.includes('去 PDA 待领料确认'), '管理端待确认自助回货 tab 不应再跳转到 PDA 确认')
const pdaPostFinishingPickupHeads = getPdaPostFinishingPickupHeads()
const selfReturnPickupHead = pdaPostFinishingPickupHeads.find((head) => head.pickupSourceType === 'SEWING_SELF_RETURN')
assert(selfReturnPickupHead, 'PDA 后道待领料列表必须包含车缝自助回货领料单')
const selfReturnPickupRecords = selfReturnPickupHead ? getPdaPickupRecordsByHead(selfReturnPickupHead.handoverId) : []
assert(selfReturnPickupRecords.length >= mockRecords[0].items.length, 'PDA 后道待领料自助回货领料单必须包含 SKU 级记录')
assert(selfReturnPickupRecords.every((record) => record.qrCodeValue.startsWith('POST_FINISHING_SELF_RETURN_PICKUP|')), 'PDA 自助回货领料记录必须有独立识别标记')

activatePdaSewingSelfReturnMode({
  factoryId: FULL_CAPABILITY_FACTORY_ID,
  factoryName: FULL_CAPABILITY_FACTORY_NAME,
  openedBy: '后道管理员',
})
assert(isPdaSewingSelfReturnModeLocked(), '开启车缝现场交货登记模式后必须写入 PDA 锁态')
assert(shouldBlockPdaRouteBySewingSelfReturnMode('/fcs/pda/exec'), '锁定模式下必须拦截执行页')
assert(shouldBlockPdaRouteBySewingSelfReturnMode('/fcs/pda/handover'), '锁定模式下必须拦截普通交接页')
assert(!shouldBlockPdaRouteBySewingSelfReturnMode(PDA_SEWING_SELF_RETURN_MODE_ROUTE), '锁定模式下必须允许自助回货锁定页')
clearPdaSewingSelfReturnMode()
assert(!isPdaSewingSelfReturnModeLocked(), '管理员退出后必须清除 PDA 锁态')

const pdaRouteSource = readProjectFile('src/router/routes-pda.ts')
const pdaRendererSource = readProjectFile('src/router/route-renderers.ts')
const pdaHandlerSource = readProjectFile('src/main-handlers/pda-handlers.ts')
const handoverPageSource = readProjectFile('src/pages/pda-handover.ts')
const handoverDetailSource = readProjectFile('src/pages/pda-handover-detail.ts')
const handoverEventsSource = readProjectFile('src/data/fcs/pda-handover-events.ts')
const lockedPageSource = readProjectFile('src/pages/pda-sewing-self-return.ts')
const pdaWarehousePageSource = readProjectFile('src/pages/pda-warehouse-wait-process.ts')
const webWarehouseEventSource = readProjectFile('src/pages/process-factory/post-finishing/events.ts')
const webWarehousePageSource = readProjectFile('src/pages/process-factory/post-finishing/warehouse.ts')
const pdaShellSource = readProjectFile('src/pages/pda-shell.ts')
const lockSource = readProjectFile('src/data/fcs/pda-sewing-self-return-mode.ts')

assert(pdaRouteSource.includes('/fcs/pda/handover/sewing-self-return'), 'PDA 路由必须包含车缝现场交货登记模式')
assert(pdaRendererSource.includes('renderPdaSewingSelfReturnPage'), '路由渲染器必须注册锁定页')
assert(pdaHandlerSource.includes('handlePdaSewingSelfReturnEvent'), 'PDA 事件分发必须接入锁定页')
assert(handoverPageSource.includes('车缝现场交货登记模式') && handoverPageSource.includes('车缝自助回货记录'), '正常交接页必须有入口和记录概览')
assert(handoverPageSource.includes('ensurePostFinishingSewingSelfReturnMockRecords'), '正常交接页必须注入车缝自助回货 mock 数据')
assert(handoverPageSource.includes('canManageSewingSelfReturnMode && state.activeTab') && handoverPageSource.includes("runtime.roleId === 'ROLE_ADMIN'"), '车缝自助回货模式入口只能由后道管理员在待领料 tab 看到')
assert(handoverPageSource.includes('车缝自助回货') && handoverPageSource.includes('正常领料') && handoverPageSource.includes('确认回货'), 'PDA 待领料列表必须区分正常领料和车缝自助回货')
assert(!handoverPageSource.includes('后道管理员开启后，公共 PDA 只保留车缝厂扫码回货和管理员退出；下方保留车缝自助回货记录。'), '正常交接页不得展示占高度的模式说明长文案')
assert(handoverPageSource.includes('来源车缝厂') && handoverPageSource.includes('后道工厂'), '后道领料卡片必须展示为车缝厂到后道工厂')
assert(webWarehousePageSource.includes('ensurePostFinishingSewingSelfReturnMockRecords'), '管理端后道待加工仓必须注入车缝自助回货 mock 数据')
assert(webWarehousePageSource.includes('pending-self-return') && webWarehousePageSource.includes('待确认的车缝自助回货'), '管理端后道待加工仓必须有待确认自助回货独立 tab')
assert(webWarehousePageSource.includes('getInventoryRecords') && webWarehousePageSource.includes('getVisibleFlowRecords') && webWarehousePageSource.includes("flow.flowType === '后道确认入库'"), '管理端库存和流水必须只接收确认后的自助回货数量')
assert(webWarehousePageSource.includes('open-self-return-confirm') && webWarehousePageSource.includes('确认入库'), '管理端待确认自助回货列表必须提供直接确认入库入口')
assert(webWarehouseEventSource.includes('openPostFinishingSelfReturnConfirmDialog') && webWarehouseEventSource.includes('confirmPostFinishingSewingSelfReturnReceipt'), '管理端待确认自助回货确认必须复用自助回货整单确认逻辑')
assert(
  handoverDetailSource.includes('来源车缝厂')
    && handoverDetailSource.includes('车缝厂交付数量')
    && handoverDetailSource.includes('车缝厂送达的领料记录')
    && handoverDetailSource.includes('后道确认对象固定为领料记录'),
  '后道领料详情必须展示为车缝厂交付口径',
)
assert(handoverDetailSource.includes('confirmPostFinishingSewingSelfReturnWarehouseRecord') && handoverDetailSource.includes('POST_FINISHING_SELF_RETURN_PICKUP'), 'PDA 领料确认必须能回写车缝自助回货入库记录')
assert(handoverEventsSource.includes('车缝厂送达到厂') && handoverEventsSource.includes('SEWING_SELF_RETURN') && handoverEventsSource.includes('POST_FINISHING_SELF_RETURN_PICKUP'), '后道 PDA 待领料必须生成车缝自助回货记录投影')
assert(!lockedPageSource.includes('当前 PDA 已锁定为车缝厂自助回货，只保留扫码提交和管理员退出'), '锁定页不得再展示顶部锁定提示文案')
assert(lockedPageSource.includes("runtime.roleId !== 'ROLE_ADMIN'") && lockedPageSource.includes('只有当前后道工厂管理员可以开启'), '锁定页直接访问也必须校验后道管理员身份')
assert(!lockedPageSource.includes('仅支持纸质生产确认单二维码，其他单据会被拦截'), '扫码区不得再展示占高度的提示文案')
assert(lockedPageSource.includes('退出车缝厂回货模式') && lockedPageSource.includes('open-exit-modal'), '锁定页右上角必须有退出车缝厂回货模式入口')
assert(lockedPageSource.includes('exitModalOpen') && lockedPageSource.includes('管理员账号或密码错误'), '退出车缝厂回货模式必须通过弹窗验证管理员账号密码')
assert(lockedPageSource.includes('已识别生产确认单') && lockedPageSource.includes('reset-scan'), '扫码识别成功后必须展示紧凑确认单摘要并支持重新扫码')
assert(!lockedPageSource.includes('填入计划数') && !lockedPageSource.includes('fill-planned-qty'), '交货信息区不得再展示填入计划数按钮')
assert(lockedPageSource.includes('type="file"') && lockedPageSource.includes('accept="image/*"') && lockedPageSource.includes('evidenceImages'), '现场凭证必须支持上传真实图片')
assert(lockedPageSource.includes('open-evidence-image-picker') && lockedPageSource.includes("document.getElementById('pda-sewing-self-return-evidence-images')?.click()"), '上传图片按钮必须真正触发文件选择器')
assert(!lockedPageSource.includes('data-pda-sewing-self-return-field="evidenceText"'), '现场凭证不得再使用文本说明输入框')
assert(lockedPageSource.includes('activatePdaSewingSelfReturnMode') && lockedPageSource.includes('clearPdaSewingSelfReturnMode'), '锁定页必须负责开启和退出 PDA 锁态')
assert(pdaShellSource.includes('shouldBlockPdaRouteBySewingSelfReturnMode'), 'PDA 外壳必须拦截锁定模式下的普通页面')
assert(lockSource.includes('PDA_SEWING_SELF_RETURN_MODE_ROUTE') && lockSource.includes('shouldBlockPdaRouteBySewingSelfReturnMode'), '必须存在车缝现场交货登记模式锁态模块')
assert(pdaWarehousePageSource.includes('确认车缝自助回货入库') && pdaWarehousePageSource.includes('后道确认数量'), '后道待加工仓必须提供自助回货确认能力')

console.log('post-finishing sewing self-return acceptance passed')
