import {
  POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS,
  type PostFinishingAcceptanceSku,
} from './post-finishing-full-flow.ts'

const STORAGE_KEY = 'higood-fcs-post-finishing-spu-technical-parameters-v1'

export interface PostFinishingSpuOption {
  spuCode: string
  spuName: string
  imageUrl: string
  colors: string[]
  sizes: string[]
  skus: PostFinishingAcceptanceSku[]
  suggestedSizeRows: PostFinishingSpuSizeParameter[]
}

export interface PostFinishingSpuSizeParameter {
  sizeName: string
  backLength: string
  shoulderWidth: string
  bust: string
  sleeveLength: string
  cuff: string
  imageUrl?: string
}

export interface PostFinishingSpuTechnicalParameter {
  spuCode: string
  spuName: string
  productImageUrl: string
  colorReferenceImageUrl: string
  colorReferenceNote: string
  sizeRows: PostFinishingSpuSizeParameter[]
  updatedBy: string
  updatedAt: string
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function buildSpuOptions(): PostFinishingSpuOption[] {
  return POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS.map((order) => {
    const firstSku = order.skus[0]!
    return {
      spuCode: firstSku.spuCode,
      spuName: firstSku.spuName,
      imageUrl: firstSku.imageUrl,
      colors: [...new Set(order.skus.map((sku) => sku.colorName))],
      sizes: [...new Set(order.skus.map((sku) => sku.sizeName))],
      skus: clone(order.skus),
      suggestedSizeRows: order.qcPrintSizeRows.map((row) => ({ ...row })),
    }
  })
}

const SPU_OPTIONS = buildSpuOptions()

function buildDefaultRecords(): PostFinishingSpuTechnicalParameter[] {
  const order = POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS[0]!
  const option = SPU_OPTIONS[0]!
  return [{
    spuCode: option.spuCode,
    spuName: option.spuName,
    productImageUrl: option.imageUrl,
    colorReferenceImageUrl: '/materials/fabric-contrast.jpg',
    colorReferenceNote: '买手确认：以实物色卡与颜色对照图共同判断，灯箱下核对。',
    sizeRows: order.qcPrintSizeRows.map((row) => ({ ...row })),
    updatedBy: order.buyerName,
    updatedAt: '2026-08-25T08:30:00.000Z',
  }]
}

let runtimeRecords = buildDefaultRecords()

function readRecords(): PostFinishingSpuTechnicalParameter[] {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return clone(parsed)
    }
  } catch {
    // 原型无 localStorage 时使用运行期数据。
  }
  return clone(runtimeRecords)
}

function writeRecords(records: PostFinishingSpuTechnicalParameter[]): void {
  runtimeRecords = clone(records)
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(records))
  } catch {
    // 原型无 localStorage 时保留运行期数据。
  }
}

export function listPostFinishingSpuOptions(): PostFinishingSpuOption[] {
  return clone(SPU_OPTIONS)
}

export function getPostFinishingSpuOption(spuCode: string): PostFinishingSpuOption | undefined {
  const option = SPU_OPTIONS.find((item) => item.spuCode === spuCode.trim())
  return option ? clone(option) : undefined
}

export function listPostFinishingSpuTechnicalParameters(): PostFinishingSpuTechnicalParameter[] {
  return readRecords()
}

export function getPostFinishingSpuTechnicalParameter(spuCode: string): PostFinishingSpuTechnicalParameter | undefined {
  const record = readRecords().find((item) => item.spuCode === spuCode.trim())
  return record ? clone(record) : undefined
}

export function isPostFinishingSpuTechnicalParameterMaintained(
  record: PostFinishingSpuTechnicalParameter | undefined,
): boolean {
  if (!record?.colorReferenceImageUrl.trim()) return false
  const option = SPU_OPTIONS.find((item) => item.spuCode === record.spuCode)
  if (!option) return false
  return option.sizes.every((sizeName) => {
    const row = record.sizeRows.find((item) => item.sizeName === sizeName)
    if (!row) return false
    const hasMeasurements = [row.backLength, row.shoulderWidth, row.bust, row.sleeveLength, row.cuff]
      .every((value) => value.trim().length > 0)
    return hasMeasurements || Boolean(row.imageUrl?.trim())
  })
}

export function upsertPostFinishingSpuTechnicalParameter(input: {
  spuCode: string
  colorReferenceImageUrl: string
  colorReferenceNote?: string
  sizeRows: PostFinishingSpuSizeParameter[]
  updatedBy: string
  nowMs?: number
}): PostFinishingSpuTechnicalParameter {
  const option = getPostFinishingSpuOption(input.spuCode)
  if (!option) throw new Error('请选择列表中的完整 SPU。')
  if (!input.colorReferenceImageUrl.trim()) throw new Error('请上传或填写颜色对照图。')
  const sizeRows = option.sizes.map((sizeName) => {
    const row = input.sizeRows.find((item) => item.sizeName === sizeName)
    if (!row) throw new Error(`请维护 ${sizeName} 码的尺寸参数或尺寸图。`)
    const normalized: PostFinishingSpuSizeParameter = {
      sizeName,
      backLength: row.backLength.trim(),
      shoulderWidth: row.shoulderWidth.trim(),
      bust: row.bust.trim(),
      sleeveLength: row.sleeveLength.trim(),
      cuff: row.cuff.trim(),
      imageUrl: row.imageUrl?.trim() || undefined,
    }
    const hasMeasurements = [normalized.backLength, normalized.shoulderWidth, normalized.bust, normalized.sleeveLength, normalized.cuff]
      .every(Boolean)
    if (!hasMeasurements && !normalized.imageUrl) {
      throw new Error(`请维护 ${sizeName} 码的完整尺寸参数，或上传该尺码尺寸图。`)
    }
    return normalized
  })
  const record: PostFinishingSpuTechnicalParameter = {
    spuCode: option.spuCode,
    spuName: option.spuName,
    productImageUrl: option.imageUrl,
    colorReferenceImageUrl: input.colorReferenceImageUrl.trim(),
    colorReferenceNote: input.colorReferenceNote?.trim() || '',
    sizeRows,
    updatedBy: input.updatedBy.trim() || '当前操作人',
    updatedAt: new Date(input.nowMs ?? Date.now()).toISOString(),
  }
  const records = readRecords().filter((item) => item.spuCode !== record.spuCode)
  records.push(record)
  writeRecords(records)
  return clone(record)
}

export function resetPostFinishingSpuTechnicalParameters(): void {
  runtimeRecords = buildDefaultRecords()
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY)
  } catch {
    // 忽略原型存储不可用。
  }
}
