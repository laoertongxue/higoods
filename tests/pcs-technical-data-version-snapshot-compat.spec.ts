import assert from 'node:assert/strict'

import { createTechnicalDataVersionBootstrapSnapshot } from '../src/data/pcs-technical-data-version-bootstrap.ts'
import type { EngineeringBomPricingSnapshot } from '../src/data/pcs-engineering-bom-types.ts'
import type { TechnicalBomItem } from '../src/data/pcs-technical-data-version-types.ts'

class MemoryStorage {
  private readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }
}

const storage = new MemoryStorage()
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })

const bootstrap = createTechnicalDataVersionBootstrapSnapshot(5)
const sourceContent = bootstrap.contents.find((content) => content.bomItems.length >= 2)
assert.ok(sourceContent)
assert.ok(sourceContent.patternFiles[0])
const patternSourceDataUrl = 'data:application/octet-stream;base64,SElHT09ELVBSQg=='

function makeBomItem(id: string, materialSkuId: string, usage: number): TechnicalBomItem {
  return {
    ...structuredClone(sourceContent.bomItems[0]!),
    id,
    materialSkuId,
    unit: '米',
    unitConsumption: usage,
    sampleQuantity: 1,
    lossRate: 0.05,
  }
}

function makeLegacySnapshot(bomItems: TechnicalBomItem[]): EngineeringBomPricingSnapshot {
  const materialLines = bomItems.map((item) => ({
    bomItemId: undefined,
    materialSkuId: item.materialSkuId!,
    usage: item.unitConsumption,
    sampleQuantity: item.sampleQuantity ?? 1,
    usageUnit: item.unit || '',
    lossRate: item.lossRate,
    materialCode: item.materialSkuId!,
    materialSkuCode: item.materialSkuId!,
    materialName: item.name,
    pricingUnit: '米',
    conversionToPricingUnit: 1,
    standardUnitPriceCny: 10,
    standardUnitPriceCurrency: 'CNY' as const,
    priceStatus: '有效' as const,
    materialCostCny: 10.5,
  }))
  return {
    snapshotVersion: 1,
    frozenAt: '2026-08-01 10:00',
    frozenBy: '历史迁移',
    exchangeRateIdrPerCny: 2300,
    exchangeRateSource: '系统最新汇率',
    materialLines,
    customCosts: [],
    cost: {
      materialCostCny: 21,
      customCostIdr: 0,
      comprehensiveCostCny: 21,
      comprehensiveCostIdr: 48300,
      exchangeRateIdrPerCny: 2300,
    },
    bomItems,
    // 模拟旧存储：当时没有 materialPriceSnapshots 字段。
    materialPriceSnapshots: undefined as unknown as EngineeringBomPricingSnapshot['materialPriceSnapshots'],
    customCostsIdr: [],
    materialCostCny: 21,
    comprehensiveCostCny: 21,
    comprehensiveCostIdr: 48300,
    linkedPartTemplateVersions: [],
  }
}

const mappableVersionId = sourceContent.technicalVersionId
const ambiguousSourceContent = bootstrap.contents.find((content) => content.technicalVersionId !== mappableVersionId)
assert.ok(ambiguousSourceContent)
const ambiguousVersionId = ambiguousSourceContent.technicalVersionId

const mappableBomItems = [makeBomItem('BOM-COMPAT-A', 'MAT-COMPAT-A', 1), makeBomItem('BOM-COMPAT-B', 'MAT-COMPAT-B', 2)]
const ambiguousBomItems = [makeBomItem('BOM-AMB-A', 'MAT-AMB', 1), makeBomItem('BOM-AMB-B', 'MAT-AMB', 1)]
const storedSnapshot = {
  ...bootstrap,
  records: bootstrap.records.map((record) => (
    record.technicalVersionId === mappableVersionId
      ? {
          ...record,
          versionStatus: 'PUBLISHED' as const,
          merchandiserReview: { ...record.merchandiserReview, status: '审核-已通过' as const },
        }
      : record
  )),
  contents: bootstrap.contents.map((content) => {
    if (content.technicalVersionId === mappableVersionId) {
      return {
        ...content,
        bomItems: mappableBomItems.map((item, index) => (
          index === 0
            ? {
                ...item,
                printRequirement: '正面印花',
                printSideMode: 'SINGLE' as const,
                frontPatternDesignId: undefined,
                frontPatternDesignIds: undefined,
              }
            : item
        )),
        patternDesigns: [],
        patternFiles: [
          {
            ...sourceContent.patternFiles[0]!,
            prjFile: {
              fileName: 'STYLE-COMPAT.prj',
              fileType: '.prj',
              fileSize: 16,
              uploadedAt: '2026-08-01 09:00',
              uploadedBy: '版师团队',
              dataUrl: patternSourceDataUrl,
            },
          },
        ],
        bomPricingSnapshot: makeLegacySnapshot(mappableBomItems),
      }
    }
    if (content.technicalVersionId === ambiguousVersionId) {
      return { ...content, bomItems: ambiguousBomItems, bomPricingSnapshot: makeLegacySnapshot(ambiguousBomItems) }
    }
    return content
  }),
}
storage.setItem('higood-pcs-technical-data-version-store-v5', JSON.stringify(storedSnapshot))

const repository = await import(`../src/data/pcs-technical-data-version-repository.ts?compat=${Date.now()}`)
const mappable = repository.getTechnicalDataVersionContent(mappableVersionId)?.bomPricingSnapshot
assert.deepEqual(
  mappable?.materialPriceSnapshots.map((line) => line.bomItemId),
  ['BOM-COMPAT-A', 'BOM-COMPAT-B'],
  '只有能按物料与用量事实唯一映射到 BOM 行的旧 materialLines 才能补齐 bomItemId',
)
assert.equal(
  repository.getTechnicalDataVersionContent(ambiguousVersionId)?.bomPricingSnapshot,
  undefined,
  '无法唯一映射 bomItemId 的旧数据必须丢弃无效正式快照，不能伪造 materialPriceSnapshots',
)
assert.deepEqual(
  repository.getTechnicalDataVersionContent(mappableVersionId)?.patternDesigns,
  [],
  '已发布的旧数据缺少设计稿时也不得自动生成假文件或假缩略图',
)
const firstPatternRead = repository.getTechnicalDataVersionContent(mappableVersionId)?.patternFiles[0]
assert.equal(firstPatternRead?.prjFile?.dataUrl, patternSourceDataUrl)
if (firstPatternRead?.prjFile) firstPatternRead.prjFile.dataUrl = 'tampered'
assert.equal(
  repository.getTechnicalDataVersionContent(mappableVersionId)?.patternFiles[0]?.prjFile?.dataUrl,
  patternSourceDataUrl,
  '正式技术包中的真实纸样文件必须按快照隔离，外部读取不得修改已保存原文件',
)

console.log('pcs-technical-data-version-snapshot-compat.spec.ts PASS')
