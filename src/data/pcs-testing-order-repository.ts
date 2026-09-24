import { createStyleArchiveDirect, getStyleArchiveById, listStyleArchives, updateStyleArchive } from './pcs-style-archive-repository.ts'
import { applyArchiveWriteback } from './pcs-archive-writeback-contract.ts'
import { createTestingOrderChannelProducts, listProjectChannelProducts } from './pcs-channel-product-project-repository.ts'
import { PCS_CHANNEL_OPTIONS } from './pcs-channel-options.ts'
import { createSkuArchive, listSkuArchives } from './pcs-sku-archive-repository.ts'
import { getMaterialArchiveById, getMaterialSkuRecordById } from './pcs-material-archive-repository.ts'
import { buildSkuFixture, localizeProductFixtureImageUrl } from './pcs-product-archive-fixtures.ts'
import type { SkuArchiveRecord } from './pcs-sku-archive-types.ts'

export type TestingOrderStatus = '进行中' | '已结束'
export type TestingBulkDecision = '是' | '否' | '待定'
export type TestingSampleShipMethod = '人头' | '空运'
export type TestingPurchaseLink = string

export type TestingOrderStepKey =
  | 'archive'
  | 'purchase-link'
  | 'logistics'
  | 'sample-inbound'
  | 'label'
  | 'buyer-confirm'
  | 'pricing'
  | 'channel-listing'
  | 'live-testing'
  | 'bulk-decision'

export interface TestingOrderStep {
  key: TestingOrderStepKey
  index: number
  title: string
  description: string
  done: boolean
}

export interface TestingOrderPricing {
  initialBomCost: number
  processCost: number
  targetPrice: number
  note: string
}

export interface TestingOrderRecord {
  testingOrderId: string
  orderCode: string
  buyerName?: string
  styleId: string
  styleCode: string
  styleName: string
  styleImageUrl: string
  spuCode: string
  skuCodes: string[]
  archiveMode?: 'created' | 'linked'
  status: TestingOrderStatus
  currentStepKey: TestingOrderStepKey
  purchaseLinks: TestingPurchaseLink[]
  logisticsCarrier: string
  logisticsTrackingNo: string
  logisticsEta: string
  sampleInboundAt: string
  sampleInboundNote: string
  labeledAt: string
  labeledSkuCode: string
  buyerDecision: '' | '淘汰' | '通过'
  buyerDecisionNote: string
  pricing: TestingOrderPricing
  shipMethod: TestingSampleShipMethod
  channelCodes: string[]
  channelPrices?: Record<string, number>
  liveSessionNote: string
  bulkDecision: '' | TestingBulkDecision
  bulkDecisionNote: string
  endedAt: string
  endReason: string
  history: Array<{ time: string; action: string; actor: string; note?: string }>
  createdAt: string
  updatedAt: string
}

export interface TestingOrderCreateResult {
  ok: boolean
  order?: TestingOrderRecord
  message?: string
}

export interface TestingOrderNewArchiveInput {
  styleName: string
  styleImageUrl: string
  colorName: string
  sizeName: string
  materialSkuId: string
  expectedQuantity: number
}

export const TESTING_ORDER_STEPS: Array<Pick<TestingOrderStep, 'key' | 'title' | 'description'>> = [
  { key: 'archive', title: '①系统建档', description: '核对关联商品档案及本次测款 SKU。' },
  { key: 'purchase-link', title: '②采购下单', description: '记录采购链接与下单事实；链接只挂本测款单，不写入档案 SKU。' },
  { key: 'logistics', title: '③快递信息', description: '记录寄件快递、运单号与预计到达。' },
  { key: 'sample-inbound', title: '④样衣入库', description: '样衣模块确认样品入库成功后推进。' },
  { key: 'label', title: '⑤打标', description: '已贴码且码值等于 SKU 编码后方可完成本步。' },
  { key: 'buyer-confirm', title: '⑥买手确认', description: '通过→⑦核价；淘汰→测款单结束并保留淘汰事实。' },
  { key: 'pricing', title: '⑦核价', description: '记录初步 BOM、用量、工艺成本与定价；淘汰则结束。' },
  { key: 'channel-listing', title: '⑧寄样+渠道上架', description: '寄样方式（人头/空运）记录；创建渠道商品并推送 TikTok/Shopee。' },
  { key: 'live-testing', title: '⑨直播测款', description: '记录测款执行事实。' },
  { key: 'bulk-decision', title: '⑩大货判断', description: '是/否/待定三态；待定保持进行中。' },
]

export const TESTING_ORDER_STEP_TEAMS: Record<TestingOrderStepKey, string> = {
  archive: '买手',
  'purchase-link': '买手',
  logistics: '买手',
  'sample-inbound': '仓储/现场',
  label: '仓储/现场',
  'buyer-confirm': '买手',
  pricing: '买手',
  'channel-listing': '买手',
  'live-testing': '买手',
  'bulk-decision': '买手',
}

const STEP_BY_KEY = new Map(TESTING_ORDER_STEPS.map((step, index) => [step.key, { ...step, index, done: false }]))

function now(): string {
  return new Date().toISOString().slice(0, 16).replace('T', ' ')
}

let seq = 0
const store = new Map<string, TestingOrderRecord>()
let initialized = false

function ensureTestingOrders(): void {
  if (!initialized) bootstrapTestingOrders()
}
const STORAGE_KEY = 'higood-pcs-testing-orders-v1'

function persistStore(): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify([...store.values()]))
  } catch {
    // 浏览器禁用存储时仍可继续当前会话的原型演示。
  }
}

function buildSteps(doneUntil: TestingOrderStepKey): TestingOrderStep[] {
  const targetIndex = STEP_BY_KEY.get(doneUntil)!.index
  return TESTING_ORDER_STEPS.map((step, index) => ({
    ...STEP_BY_KEY.get(step.key)!,
    index,
    done: index <= targetIndex,
  }))
}

function defaultPricing(): TestingOrderPricing {
  return { initialBomCost: 0, processCost: 0, targetPrice: 0, note: '' }
}

export function createTestingOrder(input: {
  styleId?: string
  buyerName?: string
  newArchive?: TestingOrderNewArchiveInput
  skuCodes?: string[]
  purchaseLinks?: string[]
  shipMethod?: TestingSampleShipMethod
  channelCodes?: string[]
}): TestingOrderCreateResult {
  ensureTestingOrders()
  if (Boolean(input.styleId) === Boolean(input.newArchive)) {
    return { ok: false, message: '请选择已有款式，或填写新款建档信息。' }
  }
  const archive = input.newArchive
  if (archive) {
    if (!archive.styleName.trim() || !archive.colorName.trim() || !archive.sizeName.trim()) {
      return { ok: false, message: '请填写款式名称、颜色和尺码。' }
    }
    if (!/^(https?:\/\/|\/(?!\/))/i.test(archive.styleImageUrl.trim())) {
      return { ok: false, message: '请提供与新款对应、可访问的真实图片地址或站内图片路径。' }
    }
    if (!Number.isFinite(archive.expectedQuantity) || archive.expectedQuantity <= 0) {
      return { ok: false, message: '请填写大于 0 的预计用料数量。' }
    }
    const materialSku = getMaterialSkuRecordById(archive.materialSkuId)
    if (!materialSku) {
      return { ok: false, message: '请选择有效的预计用料物料 SKU。' }
    }
    if (!materialSku.skuImageUrl) {
      return { ok: false, message: '所选物料 SKU 缺少对应图片，请先补齐物料档案。' }
    }
  }
  let style = input.styleId ? listStyleArchives().find((item) => item.styleId === input.styleId) : undefined
  if (input.styleId && !style) return { ok: false, message: '未找到对应款式档案。' }
  if (style && !style.mainImageUrl) return { ok: false, message: '所选款式缺少对应图片，请先补齐商品档案。' }
  const active = [...store.values()].find(
    (item) => item.styleId === input.styleId && item.status === '进行中',
  )
  if (active) {
    return { ok: false, message: `同一 SPU 至多 1 张进行中测款单，已存在 ${active.orderCode}。` }
  }
  if (archive) {
    const created = createStyleArchiveDirect({ styleName: archive.styleName.trim() })
    style = updateStyleArchive(created.styleId, {
      mainImageUrl: archive.styleImageUrl.trim(),
      imageSource: '测款单建档',
      baseInfoStatus: '已建档',
    }) || created
    const materialSku = getMaterialSkuRecordById(archive.materialSkuId)!
    const material = getMaterialArchiveById(materialSku.materialId)
    const color = archive.colorName.trim()
    const size = archive.sizeName.trim()
    const fixture = buildSkuFixture(style.styleCode, style.styleName, color, size)
    const stamp = now()
    const codePart = (value: string) => value.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9一-龥-]/g, '').toUpperCase()
    const skuCode = `${style.styleCode}-${codePart(color)}-${codePart(size)}`
    const sku: SkuArchiveRecord = {
      skuId: `sku_testing_${style.styleId}`,
      skuCode, styleId: style.styleId, styleCode: style.styleCode, styleName: style.styleName,
      skuName: fixture.skuName, skuNameEn: fixture.skuNameEn, colorName: color, sizeName: size,
      printName: '基础款', barcode: skuCode, channelTitle: fixture.channelTitle,
      skuImageUrl: archive.styleImageUrl.trim(), archiveStatus: 'ACTIVE', mappingHealth: 'MISSING',
      channelMappingCount: 0, listedChannelCount: 0, techPackVersionId: '', techPackVersionCode: '',
      techPackVersionLabel: '', legacySystem: '', legacyCode: '', costPrice: fixture.costPrice,
      freightCost: fixture.freightCost, suggestedRetailPrice: fixture.suggestedRetailPrice,
      currency: fixture.currency, pricingUnit: fixture.pricingUnit, weightKg: fixture.weightKg,
      lengthCm: fixture.lengthCm, widthCm: fixture.widthCm, heightCm: fixture.heightCm,
      packagingInfo: fixture.packagingInfo, weightText: `${fixture.weightKg}kg`,
      volumeText: `${fixture.lengthCm}*${fixture.widthCm}*${fixture.heightCm}cm`, lastListingAt: '',
      createdAt: stamp, createdBy: '当前用户', updatedAt: stamp, updatedBy: '当前用户', remark: '',
      expectedMaterials: [{
        materialSkuId: materialSku.materialSkuId, materialSkuCode: materialSku.materialSkuCode,
        materialName: materialSku.materialName, quantity: archive.expectedQuantity,
        unit: material?.mainUnit || materialSku.pricingUnit,
      }],
    }
    createSkuArchive(sku)
  }
  if (!style) return { ok: false, message: '款式建档失败。' }
  if (input.styleId && !style.buyerName?.trim()) return { ok: false, message: '商品尚未绑定买手，请先完善商品档案的买手关系。' }
  const availableSkus = listSkuArchives().filter((item) => item.styleId === style!.styleId)
  if (input.skuCodes && (!input.skuCodes.length || input.skuCodes.some((code) => !availableSkus.some((sku) => sku.skuCode === code)))) return { ok: false, message: '请选择该商品档案下的有效 SKU。' }
  if (!availableSkus.length) return { ok: false, message: '商品档案尚无 SKU，请先维护规格档案。' }
  seq += 1
  const orderCode = `TO-${String(seq).padStart(4, '0')}`
  const skuCodes = input.skuCodes || listSkuArchives().filter((item) => item.styleId === style.styleId).map((item) => item.skuCode)
  const record: TestingOrderRecord = {
    testingOrderId: `to_${Date.now().toString(36)}_${seq}`,
    orderCode,
    buyerName: style.buyerName || '商品未绑定买手',
    styleId: style.styleId,
    styleCode: style.styleCode,
    styleName: style.styleName,
    styleImageUrl: localizeProductFixtureImageUrl(style.mainImageUrl || ''),
    spuCode: style.styleCode,
    skuCodes,
    archiveMode: archive ? 'created' : 'linked',
    status: '进行中',
    currentStepKey: 'archive',
    purchaseLinks: input.purchaseLinks || [],
    logisticsCarrier: '',
    logisticsTrackingNo: '',
    logisticsEta: '',
    sampleInboundAt: '',
    sampleInboundNote: '',
    labeledAt: '',
    labeledSkuCode: '',
    buyerDecision: '',
    buyerDecisionNote: '',
    pricing: defaultPricing(),
    shipMethod: input.shipMethod || '人头',
    channelCodes: input.channelCodes || [PCS_CHANNEL_OPTIONS[0].code],
    channelPrices: {},
    liveSessionNote: '',
    bulkDecision: '',
    bulkDecisionNote: '',
    endedAt: '',
    endReason: '',
    history: [{ time: now(), action: archive ? '创建测款单并完成系统建档' : '创建测款单并关联已有 SPU/SKU', actor: '系统' }],
    createdAt: now(),
    updatedAt: now(),
  }
  store.set(record.testingOrderId, record)
  persistStore()
  applyArchiveWriteback({
    styleId: style.styleId,
    stylePatch: {},
    source: '测款单-建档',
    actor: '系统',
  })
  return { ok: true, order: record }
}

export function getTestingOrderBuyerName(order: Pick<TestingOrderRecord, 'styleId'>): string {
  return getStyleArchiveById(order.styleId)?.buyerName || '商品未绑定买手'
}

export function listTestingOrders(): TestingOrderRecord[] {
  ensureTestingOrders()
  const buyers = new Map(listStyleArchives().map((style) => [style.styleId, style.buyerName]))
  return [...store.values()].map((order) => ({ ...order, buyerName: buyers.get(order.styleId) || '商品未绑定买手' })).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** 生产准备只接受已结束且最终大货判断通过的测款事实。 */
export function hasPassedTestingOrder(styleId: string): boolean {
  return listTestingOrders().some((order) =>
    order.styleId === styleId && order.status === '已结束' && order.bulkDecision === '是')
}

export function getTestingOrderById(testingOrderId: string): TestingOrderRecord | null {
  ensureTestingOrders()
  return store.get(testingOrderId) || null
}

export function getTestingOrderByCode(orderCode: string): TestingOrderRecord | null {
  return listTestingOrders().find((item) => item.orderCode === orderCode) || null
}

export function updateTestingOrder(
  testingOrderId: string,
  patch: Partial<TestingOrderRecord>,
  actor = '当前用户',
  actionLabel = '更新测款单',
): TestingOrderRecord | null {
  ensureTestingOrders()
  const record = store.get(testingOrderId)
  if (!record) return null
  Object.assign(record, patch, { updatedAt: now() })
  record.history.unshift({ time: now(), action: actionLabel, actor })
  persistStore()
  return record
}

export function advanceTestingOrder(
  testingOrderId: string,
  nextStep: TestingOrderStepKey,
  actor = '当前用户',
): { ok: boolean; record?: TestingOrderRecord; message?: string } {
  ensureTestingOrders()
  const record = store.get(testingOrderId)
  if (!record) return { ok: false, message: '测款单不存在。' }
  if (record.status === '已结束') return { ok: false, message: '测款单已结束，不能继续推进。' }
  const order = TESTING_ORDER_STEPS.findIndex((step) => step.key === nextStep)
  const current = TESTING_ORDER_STEPS.findIndex((step) => step.key === record.currentStepKey)
  if (order < current) return { ok: false, message: '不能回退到已完成步骤。' }

  const labelIndex = TESTING_ORDER_STEPS.findIndex((step) => step.key === 'label')
  if (order >= labelIndex) {
    if (!record.sampleInboundAt) {
      return { ok: false, message: '样衣尚未入库：请先完成④样衣入库。' }
    }
  }
  if (nextStep === 'sample-inbound' && !record.logisticsTrackingNo && !record.logisticsCarrier) {
    return { ok: false, message: '请先填写快递信息再确认样衣入库。' }
  }

  record.currentStepKey = nextStep
  record.updatedAt = now()
  record.history.unshift({ time: now(), action: `推进到 ${TESTING_ORDER_STEPS[order].title}`, actor })
  persistStore()

  if (nextStep === 'channel-listing' || nextStep === 'live-testing' || nextStep === 'bulk-decision') {
    applyArchiveWriteback({
      styleId: record.styleId,
      lastTestingConclusion: record.bulkDecision === '是' ? '已通过' : record.bulkDecision === '否' ? '未通过' : undefined,
      source: '测款单-步骤回写',
      actor,
    })
  }
  return { ok: true, record }
}

export function setBulkDecision(
  testingOrderId: string,
  decision: TestingBulkDecision,
  note: string,
  actor = '当前用户',
): { ok: boolean; record?: TestingOrderRecord; message?: string } {
  ensureTestingOrders()
  const record = store.get(testingOrderId)
  if (!record) return { ok: false, message: '测款单不存在。' }
  if (record.status === '已结束') return { ok: false, message: '测款单已结束。' }
  if (decision === '待定') {
    record.bulkDecision = '待定'
    record.bulkDecisionNote = note
    record.status = '进行中'
    record.history.unshift({ time: now(), action: '大货判断：待定，保持进行中', actor, note })
    record.updatedAt = now()
    persistStore()
    return { ok: true, record }
  }
  record.bulkDecision = decision
  record.bulkDecisionNote = note
  record.status = '已结束'
  record.endedAt = now()
  record.endReason = decision === '是' ? '大货判断通过' : '大货判断不通过'
  record.currentStepKey = 'bulk-decision'
  record.history.unshift({ time: now(), action: `大货判断：${decision}，测款结束`, actor, note })
  record.updatedAt = now()
  persistStore()
    applyArchiveWriteback({
      styleId: record.styleId,
      lastTestingConclusion: decision === '是' ? '已通过' : '未通过',
      bulkGoodsConclusion: decision,
      source: '测款单-大货判断',
      actor,
    })
  return { ok: true, record }
}

export function completeLabelStep(
  testingOrderId: string,
  skuCode: string,
  actor = '当前用户',
): { ok: boolean; record?: TestingOrderRecord; message?: string } {
  ensureTestingOrders()
  const record = store.get(testingOrderId)
  if (!record) return { ok: false, message: '测款单不存在。' }
  if (record.status === '已结束') return { ok: false, message: '测款单已结束，不能继续推进。' }
  if (!record.sampleInboundAt) {
    return { ok: false, message: '样衣尚未入库：请先完成④样衣入库。' }
  }
  if (!record.skuCodes.includes(skuCode)) {
    return { ok: false, message: '码值必须等于本单 SKU 编码之一。' }
  }
  const current = TESTING_ORDER_STEPS.findIndex((step) => step.key === record.currentStepKey)
  const labelIndex = TESTING_ORDER_STEPS.findIndex((step) => step.key === 'label')
  if (current > labelIndex) {
    return { ok: false, message: '当前已超过⑤打标步骤。' }
  }
  record.labeledSkuCode = skuCode
  record.labeledAt = now()
  record.history.unshift({ time: now(), action: `完成打标，码值 ${skuCode}`, actor })
  record.currentStepKey = 'buyer-confirm'
  record.updatedAt = now()
  persistStore()
  return { ok: true, record }
}

export function completeSampleInbound(
  testingOrderId: string,
  note: string,
  actor = '当前用户',
): { ok: boolean; record?: TestingOrderRecord; message?: string } {
  ensureTestingOrders()
  const record = store.get(testingOrderId)
  if (!record) return { ok: false, message: '测款单不存在。' }
  if (record.status === '已结束') return { ok: false, message: '测款单已结束，不能继续推进。' }
  const order = TESTING_ORDER_STEPS.findIndex((step) => step.key === 'sample-inbound')
  const current = TESTING_ORDER_STEPS.findIndex((step) => step.key === record.currentStepKey)
  if (order < current) return { ok: false, message: '不能回退到已完成步骤。' }
  if (current !== order) {
    return { ok: false, message: '当前不在④样衣入库步骤，无法确认入库。' }
  }
  if (!record.logisticsTrackingNo && !record.logisticsCarrier) {
    return { ok: false, message: '请先填写快递信息再确认样衣入库。' }
  }
  record.sampleInboundAt = now()
  record.sampleInboundNote = note
  record.currentStepKey = 'label'
  record.updatedAt = now()
  record.history.unshift({ time: now(), action: '完成 ④样衣入库', actor, note })
  persistStore()
  return { ok: true, record }
}

export function rejectBuyerConfirm(
  testingOrderId: string,
  note: string,
  actor = '当前用户',
): { ok: boolean; record?: TestingOrderRecord; message?: string } {
  ensureTestingOrders()
  const record = store.get(testingOrderId)
  if (!record) return { ok: false, message: '测款单不存在。' }
  record.buyerDecision = '淘汰'
  record.buyerDecisionNote = note
  record.status = '已结束'
  record.endedAt = now()
  record.endReason = '买手确认淘汰'
  record.history.unshift({ time: now(), action: '买手确认淘汰，测款结束', actor, note })
  record.updatedAt = now()
  persistStore()
  applyArchiveWriteback({
    styleId: record.styleId,
    lastTestingConclusion: '未通过',
    source: '测款单-买手淘汰',
    actor,
  })
  return { ok: true, record }
}

export function rejectPricing(
  testingOrderId: string,
  note: string,
  actor = '当前用户',
): { ok: boolean; record?: TestingOrderRecord; message?: string } {
  ensureTestingOrders()
  const record = store.get(testingOrderId)
  if (!record) return { ok: false, message: '测款单不存在。' }
  record.status = '已结束'
  record.endedAt = now()
  record.endReason = '核价淘汰'
  record.history.unshift({ time: now(), action: '核价淘汰，测款结束', actor, note })
  record.updatedAt = now()
  persistStore()
  applyArchiveWriteback({
    styleId: record.styleId,
    lastTestingConclusion: '未通过',
    source: '测款单-核价淘汰',
    actor,
  })
  return { ok: true, record }
}

export function pushChannelProducts(
  testingOrderId: string,
  actor = '当前用户',
): { ok: boolean; message?: string; pushed?: string[] } {
  ensureTestingOrders()
  const record = store.get(testingOrderId)
  if (!record) return { ok: false, message: '测款单不存在。' }
  if (record.status !== '进行中' || record.currentStepKey !== 'channel-listing' || !record.sampleInboundAt) {
    return { ok: false, message: '请先完成前序步骤，再执行⑧渠道推送。' }
  }
  let products: ReturnType<typeof createTestingOrderChannelProducts>
  try {
    products = createTestingOrderChannelProducts({
      testingOrderId, styleId: record.styleId, skuCodes: record.skuCodes,
      channelCodes: record.channelCodes, channelPrices: record.channelPrices || {}, actor,
    })
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : '渠道商品创建失败。' }
  }
  const ids = products.map((item) => item.channelProductId)
  applyArchiveWriteback({
    styleId: record.styleId,
    stylePatch: { channelProductCount: listProjectChannelProducts().filter((item) => item.styleId === record.styleId).length },
    source: '测款单-渠道推送',
    actor,
  })
  record.history.unshift({
    time: now(),
    action: `推送测款渠道 ${record.channelCodes.join('、')}`,
    actor,
    note: `关联渠道商品 ${ids.length} 条`,
  })
  record.updatedAt = now()
  record.currentStepKey = 'live-testing'
  record.history.unshift({ time: now(), action: '推进到 ⑨直播测款', actor })
  persistStore()
  return { ok: true, pushed: ids, message: `原型模拟推送 ${ids.length} 条本单渠道商品，已回写档案。` }
}

export function resetTestingOrderRepository(): void {
  initialized = true
  store.clear()
  seq = 0
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 测试环境可能没有浏览器存储。
  }
}

function seed(
  partial: Partial<TestingOrderRecord> & Pick<
    TestingOrderRecord,
    'testingOrderId' | 'styleId' | 'styleCode' | 'styleName' | 'styleImageUrl' | 'spuCode' | 'skuCodes'
  >,
): TestingOrderRecord {
  seq += 1
  const base = {
    orderCode: `TO-${String(seq).padStart(4, '0')}`,
    buyerName: ['陈买手', '林买手', '王买手'][(seq - 1) % 3],
    status: '进行中' as TestingOrderRecord['status'],
    currentStepKey: 'archive' as TestingOrderRecord['currentStepKey'],
    purchaseLinks: [] as string[],
    logisticsCarrier: '',
    logisticsTrackingNo: '',
    logisticsEta: '',
    sampleInboundAt: '',
    sampleInboundNote: '',
    labeledAt: '',
    labeledSkuCode: '',
    buyerDecision: '' as TestingOrderRecord['buyerDecision'],
    buyerDecisionNote: '',
    pricing: defaultPricing(),
    shipMethod: '人头' as TestingOrderRecord['shipMethod'],
    channelCodes: ['tiktok', 'shopee'],
    channelPrices: {} as Record<string, number>,
    liveSessionNote: '',
    bulkDecision: '' as TestingOrderRecord['bulkDecision'],
    bulkDecisionNote: '',
    endedAt: '',
    endReason: '',
    history: [] as TestingOrderRecord['history'],
    createdAt: now(),
    updatedAt: now(),
  }
  const record: TestingOrderRecord = {
    ...base,
    ...partial,
    testingOrderId: partial.testingOrderId,
    styleId: partial.styleId,
    styleCode: partial.styleCode,
    styleName: partial.styleName,
    styleImageUrl: localizeProductFixtureImageUrl(partial.styleImageUrl),
    spuCode: partial.spuCode,
    skuCodes: partial.skuCodes,
    history: partial.history ?? [],
    createdAt: partial.createdAt ?? base.createdAt,
    updatedAt: partial.updatedAt ?? base.updatedAt,
    pricing: partial.pricing ?? base.pricing,
    purchaseLinks: partial.purchaseLinks ?? [],
    logisticsCarrier: partial.logisticsCarrier ?? '',
    logisticsTrackingNo: partial.logisticsTrackingNo ?? '',
    logisticsEta: partial.logisticsEta ?? '',
    sampleInboundAt: partial.sampleInboundAt ?? '',
    sampleInboundNote: partial.sampleInboundNote ?? '',
    labeledAt: partial.labeledAt ?? '',
    labeledSkuCode: partial.labeledSkuCode ?? '',
    buyerDecision: partial.buyerDecision ?? '',
    buyerDecisionNote: partial.buyerDecisionNote ?? '',
    shipMethod: partial.shipMethod ?? base.shipMethod,
    channelCodes: partial.channelCodes ?? base.channelCodes,
    channelPrices: partial.channelPrices ?? base.channelPrices,
    liveSessionNote: partial.liveSessionNote ?? '',
    bulkDecision: partial.bulkDecision ?? '',
    bulkDecisionNote: partial.bulkDecisionNote ?? '',
    endedAt: partial.endedAt ?? '',
    endReason: partial.endReason ?? '',
    status: partial.status ?? base.status,
    currentStepKey: partial.currentStepKey ?? base.currentStepKey,
  }
  if (record.history.length === 0) {
    record.history = [{ time: record.createdAt, action: '创建测款单', actor: '系统' }]
  }
  store.set(record.testingOrderId, record)
  return record
}

export function bootstrapTestingOrders(): void {
  initialized = true
  if (store.size > 0) return
  let saved: TestingOrderRecord[] = []
  try {
    if (typeof localStorage !== 'undefined') {
      const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
      if (Array.isArray(parsed)) saved = parsed.filter((item): item is TestingOrderRecord =>
        Boolean(item && typeof item.testingOrderId === 'string' && typeof item.orderCode === 'string'),
      )
    }
  } catch {
    // 损坏的本地演示数据回退到种子数据。
  }
  const styles = listStyleArchives()
  // 演示单绑定固定商品，不随档案修改时间或列表排序变化。
  const normal = styles.find((style) => style.styleId === 'style_demand_SPU_QC_001')
  const buyerKill = styles.find((style) => style.styleId === 'style_demand_SPU_QC_002')
  const pricingKill = styles.find((style) => style.styleId === 'style_demand_SPU_QC_003')
  const pending = styles.find((style) => style.styleId === 'style_demand_PRJ_202603_012')
  const historyEnded = styles.find((style) => style.styleId === 'style_demand_PRJ_202603_011')

  if (normal) {
    const record = seed({
      testingOrderId: 'to_seed_normal',
      styleId: normal.styleId,
      styleCode: normal.styleCode,
      styleName: normal.styleName,
      styleImageUrl: normal.mainImageUrl || '',
      spuCode: normal.styleCode,
      skuCodes: listSkuArchives().filter((item) => item.styleId === normal.styleId).map((item) => item.skuCode).slice(0, 2),
      status: '进行中',
      currentStepKey: 'live-testing',
      purchaseLinks: ['https://example.com/purchase/to-seed-normal'],
      logisticsCarrier: '顺丰',
      logisticsTrackingNo: 'SF-TO-0001',
      logisticsEta: '2026-04-20',
      sampleInboundAt: '2026-04-11 09:30',
      sampleInboundNote: '样衣已入样衣仓，关联库存台账。',
      labeledAt: '2026-04-12 10:00',
      labeledSkuCode: listSkuArchives().find((item) => item.styleId === normal.styleId)?.skuCode || '',
      shipMethod: '空运',
      channelCodes: ['tiktok', 'shopee'],
      liveSessionNote: 'TikTok 直播 2 小时，加购 38。',
      history: [
        { time: now(), action: '推进到 ⑨直播测款', actor: '运营' },
        { time: now(), action: '完成打标', actor: '仓管' },
        { time: now(), action: '完成 ④样衣入库', actor: '仓管' },
        { time: now(), action: '创建测款单并完成系统建档', actor: '系统' },
      ],
    })
    record.orderCode = 'TO-0001'
  }
  if (buyerKill) {
    const record = seed({
      testingOrderId: 'to_seed_buyer_kill',
      styleId: buyerKill.styleId,
      styleCode: buyerKill.styleCode,
      styleName: buyerKill.styleName,
      styleImageUrl: buyerKill.mainImageUrl || '',
      spuCode: buyerKill.styleCode,
      skuCodes: ['SKU-BUYER-KILL'],
      status: '已结束',
      currentStepKey: 'buyer-confirm',
      buyerDecision: '淘汰',
      buyerDecisionNote: '版型不符合目标人群。',
      endedAt: '2026-04-10 16:00',
      endReason: '买手确认淘汰',
      history: [
        { time: '2026-04-10 16:00', action: '买手确认淘汰，测款结束', actor: '买手' },
        { time: now(), action: '创建测款单', actor: '系统' },
      ],
    })
    record.orderCode = 'TO-0002'
  }
  if (pricingKill) {
    const record = seed({
      testingOrderId: 'to_seed_pricing_kill',
      styleId: pricingKill.styleId,
      styleCode: pricingKill.styleCode,
      styleName: pricingKill.styleName,
      styleImageUrl: pricingKill.mainImageUrl || '',
      spuCode: pricingKill.styleCode,
      skuCodes: ['SKU-PRICING-KILL'],
      status: '已结束',
      currentStepKey: 'pricing',
      pricing: { initialBomCost: 42, processCost: 8, targetPrice: 55, note: '核价高于渠道可接受区间。' },
      endedAt: '2026-04-09 11:30',
      endReason: '核价淘汰',
      history: [
        { time: '2026-04-09 11:30', action: '核价淘汰，测款结束', actor: '核价' },
        { time: now(), action: '创建测款单', actor: '系统' },
      ],
    })
    record.orderCode = 'TO-0003'
  }
  if (pending) {
    const record = seed({
      testingOrderId: 'to_seed_pending',
      styleId: pending.styleId,
      styleCode: pending.styleCode,
      styleName: pending.styleName,
      styleImageUrl: pending.mainImageUrl || '',
      spuCode: pending.styleCode,
      skuCodes: ['SKU-PENDING'],
      status: '进行中',
      currentStepKey: 'bulk-decision',
      bulkDecision: '待定',
      bulkDecisionNote: '再观察一周转化。',
      history: [
        { time: now(), action: '大货判断：待定，保持进行中', actor: '运营' },
        { time: now(), action: '创建测款单', actor: '系统' },
      ],
    })
    record.orderCode = 'TO-0004'
  }
  if (historyEnded) {
    const record = seed({
      testingOrderId: 'to_seed_history',
      styleId: historyEnded.styleId,
      styleCode: historyEnded.styleCode,
      styleName: historyEnded.styleName,
      styleImageUrl: historyEnded.mainImageUrl || '',
      spuCode: historyEnded.styleCode,
      skuCodes: ['SKU-HISTORY'],
      status: '已结束',
      currentStepKey: 'bulk-decision',
      bulkDecision: '是',
      bulkDecisionNote: '历史已结束单，可再开新单。',
      endedAt: '2026-03-28 18:00',
      endReason: '大货判断通过',
      history: [
        { time: '2026-03-28 18:00', action: '大货判断：是，测款结束', actor: '运营' },
        { time: now(), action: '创建测款单', actor: '系统' },
      ],
    })
    record.orderCode = 'TO-0005'
  }
  saved.forEach((item) => store.set(item.testingOrderId, {
    ...item,
    buyerName: item.buyerName?.trim() || '待分配',
    styleImageUrl: localizeProductFixtureImageUrl(item.styleImageUrl || ''),
  }))
  seq = Math.max(seq, ...[...store.values()].map((item) => Number(item.orderCode.match(/^TO-(\d+)$/)?.[1] || 0)))
}
