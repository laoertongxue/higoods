import { buildLaceProductionGenerationKey } from './lace-production-generation-key.ts'

export type LacePurchaseOrderStatus = '有效' | '已取消' | '已作废'
export type AccessoryMaterialType = '花边' | '拉链' | '织带' | '布包扣' | '其他'

export interface AccessoryFactoryMapping {
  supplierId: string
  supplierName: string
  factoryOrgId: string
  factoryName: string
  factoryType: '花边厂'
  enabled: boolean
}

export interface LacePlannedInputMaterial {
  inputMaterialId: string
  inputMaterialSku: string
  inputMaterialName: string
  specification: string
  color: string
  imageUrl: string
  unit: string
  unitUsage: number
}

export interface AccessoryPurchaseOrderLine {
  purchaseOrderLineId: string
  skuId: string
  skuCode: string
  materialName: string
  materialType: AccessoryMaterialType
  specification: string
  color: string
  materialImageUrl: string
  orderedQty: number
  unit: string
  dueDate: string
  targetWarehouseId: string
  targetWarehouseName: string
  styleId: string
  styleCode: string
  styleName: string
  styleImageUrl: string
  note: string
  plannedInputs?: LacePlannedInputMaterial[]
}

export interface LacePurchaseChangeField {
  field: '采购数量' | 'SKU' | '单位' | '交期' | '目标仓库' | '供应商／工厂' | '款式' | '备注' | '默认加工投入' | '采购状态'
  label: string
  skuId?: string
  beforeValue: string
  afterValue: string
}

export interface LacePurchaseChangeRecord {
  changeId: string
  fromVersion: number
  toVersion: number
  changedById: string
  changedByName: string
  changedAt: string
  fields: LacePurchaseChangeField[]
}

export interface AccessoryPurchaseOrder {
  purchaseOrderId: string
  purchaseOrderNo: string
  supplierId: string
  supplierName: string
  status: LacePurchaseOrderStatus
  version: number
  orderedAt: string
  buyerId: string
  buyerName: string
  lines: AccessoryPurchaseOrderLine[]
  changeHistory: LacePurchaseChangeRecord[]
}

export interface LacePurchaseDemand {
  generationKey: string
  purchaseOrderId: string
  purchaseOrderNo: string
  purchaseOrderVersion: number
  purchaseStatus: LacePurchaseOrderStatus
  supplierId: string
  supplierName: string
  factoryOrgId: string
  factoryName: string
  skuId: string
  skuCode: string
  materialName: string
  materialType: '花边'
  specification: string
  color: string
  materialImageUrl: string
  orderedQty: number
  unit: string
  dueDate: string
  targetWarehouseId: string
  targetWarehouseName: string
  styleId: string
  styleCode: string
  styleName: string
  styleImageUrl: string
  note: string
  sourceLineIds: string[]
  sourceLines: LacePurchaseSourceLine[]
  plannedInputs: LacePlannedInputMaterial[]
  orderedAt: string
  buyerId: string
  buyerName: string
  latestChange?: LacePurchaseChangeRecord
}

export interface LacePurchaseSourceLine {
  purchaseOrderLineId: string
  orderedQty: number
  unit: string
  styleId: string
  styleCode: string
  styleName: string
  styleImageUrl: string
  note: string
}

export interface LacePurchaseProjectionFailure {
  failureId: string
  purchaseOrderId: string
  purchaseOrderNo: string
  purchaseOrderLineId: string
  skuId: string
  skuCode: string
  materialName: string
  materialImageUrl: string
  styleName: string
  styleImageUrl: string
  factoryOrgId: string
  factoryName: string
  reason: string
}

const RENDA_JAYA_MAPPING: AccessoryFactoryMapping = {
  supplierId: 'SUP-RJ-001',
  supplierName: 'Renda Jaya',
  factoryOrgId: 'FAC-RJ-LACE',
  factoryName: 'Renda Jaya 花边厂',
  factoryType: '花边厂',
  enabled: true,
}

export const ACCESSORY_FACTORY_MAPPINGS: readonly AccessoryFactoryMapping[] = [RENDA_JAYA_MAPPING]

const STYLE_IMAGE = '/lace-dress-sample.jpg'
const LACE_IMAGE = '/materials/fabric-contrast.jpg'
const YARN_IMAGE = '/materials/yarn-stitching.jpg'

export type LaceInputMaterialCatalogItem = Omit<LacePlannedInputMaterial, 'unitUsage'>

export const LACE_INPUT_MATERIAL_CATALOG: readonly LaceInputMaterialCatalogItem[] = [
  {
    inputMaterialId: 'MAT-RJ-GREIGE-001',
    inputMaterialSku: 'RJ-GREIGE-LACE-IVORY',
    inputMaterialName: '米白花边胚带',
    specification: '珠点经编胚带',
    color: '米白',
    imageUrl: LACE_IMAGE,
    unit: 'Yard',
  },
  {
    inputMaterialId: 'MAT-RJ-YARN-001',
    inputMaterialSku: 'RJ-YARN-GUIDE-001',
    inputMaterialName: '机台引线',
    specification: '涤纶线',
    color: '黑色',
    imageUrl: YARN_IMAGE,
    unit: 'KG',
  },
  {
    inputMaterialId: 'MAT-RJ-YARN-002',
    inputMaterialSku: 'RJ-YARN-LACE-150D',
    inputMaterialName: '150D 涤纶花边纱',
    specification: '150D/36F',
    color: '米白',
    imageUrl: YARN_IMAGE,
    unit: 'KG',
  },
]

const rendaInputs = (): LacePlannedInputMaterial[] => [
  {
    inputMaterialId: 'MAT-RJ-GREIGE-001',
    inputMaterialSku: 'RJ-GREIGE-LACE-IVORY',
    inputMaterialName: '米白花边胚带',
    specification: '珠点经编胚带',
    color: '米白',
    imageUrl: LACE_IMAGE,
    unit: 'Yard',
    unitUsage: 1,
  },
  {
    inputMaterialId: 'MAT-RJ-YARN-001',
    inputMaterialSku: 'RJ-YARN-GUIDE-001',
    inputMaterialName: '机台引线',
    specification: '涤纶线',
    color: '黑色',
    imageUrl: YARN_IMAGE,
    unit: 'KG',
    unitUsage: 0.02,
  },
]

export function createAccessoryPurchaseOrderSeeds(): AccessoryPurchaseOrder[] {
  return [
    {
      purchaseOrderId: 'PO-338468',
      purchaseOrderNo: '338468',
      supplierId: RENDA_JAYA_MAPPING.supplierId,
      supplierName: RENDA_JAYA_MAPPING.supplierName,
      status: '有效',
      version: 2,
      orderedAt: '2026-08-06T17:59:26+07:00',
      buyerId: 'USR-PMS-XIAOKE',
      buyerName: '小科',
      lines: [
        {
          purchaseOrderLineId: 'POL-338468-001-A',
          skuId: 'SKU-IDFL251050-BLACK-19-4003PT',
          skuCode: 'IDFL251050-BLACK-19-4003PT',
          materialName: '3CM 珠点经编花边',
          materialType: '花边',
          specification: '3CM 珠点双边',
          color: '米白',
          materialImageUrl: LACE_IMAGE,
          orderedQty: 240,
          unit: 'Yard',
          dueDate: '2026-08-14',
          targetWarehouseId: 'WLS-CENTRAL-ACCESSORY',
          targetWarehouseName: '中央仓库·辅料仓',
          styleId: 'STYLE-ASYZC26071557',
          styleCode: 'ASYZC26071557',
          styleName: '米白蕾丝连衣裙',
          styleImageUrl: STYLE_IMAGE,
          note: '首批优先交出 120 Yard',
          plannedInputs: rendaInputs(),
        },
        {
          purchaseOrderLineId: 'POL-338468-001-B',
          skuId: 'SKU-IDFL251050-BLACK-19-4003PT',
          skuCode: 'IDFL251050-BLACK-19-4003PT',
          materialName: '3CM 珠点经编花边',
          materialType: '花边',
          specification: '3CM 珠点双边',
          color: '米白',
          materialImageUrl: LACE_IMAGE,
          orderedQty: 110,
          unit: 'Yard',
          dueDate: '2026-08-14',
          targetWarehouseId: 'WLS-CENTRAL-ACCESSORY',
          targetWarehouseName: '中央仓库·辅料仓',
          styleId: 'STYLE-ASYZC26071557',
          styleCode: 'ASYZC26071557',
          styleName: '米白蕾丝连衣裙',
          styleImageUrl: STYLE_IMAGE,
          note: '同 SKU 追加行，系统合并生成一张生产单',
          plannedInputs: rendaInputs(),
        },
        {
          purchaseOrderLineId: 'POL-338468-002',
          skuId: 'SKU-FLSZ26051153-104-11CM',
          skuCode: 'FLSZ26051153-104-11CM',
          materialName: '11CM 珠点经编花边',
          materialType: '花边',
          specification: '11CM 珠点双边',
          color: '米白',
          materialImageUrl: LACE_IMAGE,
          orderedQty: 600,
          unit: 'Yard',
          dueDate: '2026-08-15',
          targetWarehouseId: 'WLS-CENTRAL-ACCESSORY',
          targetWarehouseName: '中央仓库·辅料仓',
          styleId: 'STYLE-ASYZC26071557',
          styleCode: 'ASYZC26071557',
          styleName: '米白蕾丝连衣裙',
          styleImageUrl: STYLE_IMAGE,
          note: '默认加工投入已由采购用料关系带入',
          plannedInputs: rendaInputs(),
        },
        {
          purchaseOrderLineId: 'POL-338468-003',
          skuId: 'SKU-FLSZ26051153-105-4CM',
          skuCode: 'FLSZ26051153-105-4CM',
          materialName: '4CM 珠点经编花边',
          materialType: '花边',
          specification: '4CM 珠点单边',
          color: '米白',
          materialImageUrl: LACE_IMAGE,
          orderedQty: 420,
          unit: 'Yard',
          dueDate: '2026-08-13',
          targetWarehouseId: 'WLS-CENTRAL-ACCESSORY',
          targetWarehouseName: '中央仓库·辅料仓',
          styleId: 'STYLE-ASYZC26071557',
          styleCode: 'ASYZC26071557',
          styleName: '米白蕾丝连衣裙',
          styleImageUrl: STYLE_IMAGE,
          note: '一次性完工并交出',
          plannedInputs: rendaInputs(),
        },
      ],
      changeHistory: [
        {
          changeId: 'POCHG-338468-V2',
          fromVersion: 1,
          toVersion: 2,
          changedById: 'USR-PMS-XIAOKE',
          changedByName: '小科',
          changedAt: '2026-08-07T09:20:00+07:00',
          fields: [
            {
              field: '采购数量',
              label: '3CM 珠点经编花边采购数量',
              skuId: 'SKU-IDFL251050-BLACK-19-4003PT',
              beforeValue: '320 Yard',
              afterValue: '350 Yard',
            },
            {
              field: '交期',
              label: '计划到货日期',
              beforeValue: '2026-08-12',
              afterValue: '2026-08-14',
            },
            {
              field: '备注',
              label: '采购备注',
              beforeValue: '按计划交货',
              afterValue: '首批优先交出 120 Yard',
            },
          ],
        },
      ],
    },
    {
      purchaseOrderId: 'PO-338501',
      purchaseOrderNo: '338501',
      supplierId: RENDA_JAYA_MAPPING.supplierId,
      supplierName: RENDA_JAYA_MAPPING.supplierName,
      status: '有效',
      version: 1,
      orderedAt: '2026-08-08T08:10:00+07:00',
      buyerId: 'USR-PMS-LIU',
      buyerName: '刘静',
      lines: [
        {
          purchaseOrderLineId: 'POL-338501-001',
          skuId: 'SKU-FLSZ26051153-106-3CM',
          skuCode: 'FLSZ26051153-106-3CM',
          materialName: '3CM 珠点经编花边',
          materialType: '花边',
          specification: '3CM 珠点单边',
          color: '米白',
          materialImageUrl: LACE_IMAGE,
          orderedQty: 180,
          unit: 'Yard',
          dueDate: '2026-08-18',
          targetWarehouseId: 'WLS-CENTRAL-ACCESSORY',
          targetWarehouseName: '中央仓库·辅料仓',
          styleId: 'STYLE-ASYZC26071557',
          styleCode: 'ASYZC26071557',
          styleName: '米白蕾丝连衣裙',
          styleImageUrl: STYLE_IMAGE,
          note: '待确认接收',
          plannedInputs: rendaInputs(),
        },
      ],
      changeHistory: [],
    },
    {
      purchaseOrderId: 'PO-338520',
      purchaseOrderNo: '338520',
      supplierId: RENDA_JAYA_MAPPING.supplierId,
      supplierName: RENDA_JAYA_MAPPING.supplierName,
      status: '有效',
      version: 1,
      orderedAt: '2026-08-08T09:15:00+07:00',
      buyerId: 'USR-PMS-LIU',
      buyerName: '刘静',
      lines: [
        {
          purchaseOrderLineId: 'POL-338520-001',
          skuId: 'SKU-FLSZ26051153-107-2CM',
          skuCode: 'FLSZ26051153-107-2CM',
          materialName: '2CM 珠点经编花边',
          materialType: '花边',
          specification: '2CM 珠点单边',
          color: '米白',
          materialImageUrl: LACE_IMAGE,
          orderedQty: 260,
          unit: 'Yard',
          dueDate: '2026-08-20',
          targetWarehouseId: 'WLS-CENTRAL-ACCESSORY',
          targetWarehouseName: '中央仓库·辅料仓',
          styleId: 'STYLE-ASYZC26071557',
          styleCode: 'ASYZC26071557',
          styleName: '米白蕾丝连衣裙',
          styleImageUrl: STYLE_IMAGE,
          note: '默认加工投入已由采购用料关系带入',
          plannedInputs: rendaInputs(),
        },
      ],
      changeHistory: [],
    },
    {
      purchaseOrderId: 'PO-EXT-001',
      purchaseOrderNo: '338530',
      supplierId: 'SUP-EXT-LACE-001',
      supplierName: 'Surya Lace',
      status: '有效',
      version: 1,
      orderedAt: '2026-08-08T10:00:00+07:00',
      buyerId: 'USR-PMS-LIU',
      buyerName: '刘静',
      lines: [
        {
          purchaseOrderLineId: 'POL-EXT-001',
          skuId: 'SKU-EXT-LACE-001',
          skuCode: 'EXT-LACE-8CM',
          materialName: '8CM 外采珠点经编花边',
          materialType: '花边',
          specification: '8CM 珠点双边',
          color: '米白',
          materialImageUrl: LACE_IMAGE,
          orderedQty: 300,
          unit: 'Yard',
          dueDate: '2026-08-22',
          targetWarehouseId: 'WLS-CENTRAL-ACCESSORY',
          targetWarehouseName: '中央仓库·辅料仓',
          styleId: 'STYLE-ASYZC26071557',
          styleCode: 'ASYZC26071557',
          styleName: '米白蕾丝连衣裙',
          styleImageUrl: STYLE_IMAGE,
          note: '外部供应商采购，不进入花边厂管理',
        },
      ],
      changeHistory: [],
    },
    {
      purchaseOrderId: 'PO-RJ-ZIP-001',
      purchaseOrderNo: '338540',
      supplierId: RENDA_JAYA_MAPPING.supplierId,
      supplierName: RENDA_JAYA_MAPPING.supplierName,
      status: '有效',
      version: 1,
      orderedAt: '2026-08-08T10:30:00+07:00',
      buyerId: 'USR-PMS-LIU',
      buyerName: '刘静',
      lines: [
        {
          purchaseOrderLineId: 'POL-RJ-ZIP-001',
          skuId: 'SKU-ZIPPER-BRASS-18',
          skuCode: 'ZIPPER-BRASS-18',
          materialName: '18CM 铜齿拉链',
          materialType: '拉链',
          specification: '18CM 闭口',
          color: '牛仔蓝',
          materialImageUrl: '/materials/accessory-zipper.jpg',
          orderedQty: 500,
          unit: '条',
          dueDate: '2026-08-24',
          targetWarehouseId: 'WLS-CENTRAL-ACCESSORY',
          targetWarehouseName: '中央仓库·辅料仓',
          styleId: 'STYLE-DENIM-SHORTS',
          styleCode: 'DENIM-SHORTS-2608',
          styleName: '牛仔短裤',
          styleImageUrl: '/denim-shorts-sample.jpg',
          note: '拉链厂业务，不进入花边厂管理',
        },
      ],
      changeHistory: [],
    },
    {
      purchaseOrderId: 'PO-RJ-CANCELLED',
      purchaseOrderNo: '338550',
      supplierId: RENDA_JAYA_MAPPING.supplierId,
      supplierName: RENDA_JAYA_MAPPING.supplierName,
      status: '已取消',
      version: 2,
      orderedAt: '2026-08-07T14:00:00+07:00',
      buyerId: 'USR-PMS-LIU',
      buyerName: '刘静',
      lines: [
        {
          purchaseOrderLineId: 'POL-RJ-CANCELLED-001',
          skuId: 'SKU-CANCELLED-LACE-001',
          skuCode: 'CANCELLED-LACE-5CM',
          materialName: '5CM 已取消花边',
          materialType: '花边',
          specification: '5CM 双边',
          color: '米白',
          materialImageUrl: LACE_IMAGE,
          orderedQty: 200,
          unit: 'Yard',
          dueDate: '2026-08-19',
          targetWarehouseId: 'WLS-CENTRAL-ACCESSORY',
          targetWarehouseName: '中央仓库·辅料仓',
          styleId: 'STYLE-ASYZC26071557',
          styleCode: 'ASYZC26071557',
          styleName: '米白蕾丝连衣裙',
          styleImageUrl: STYLE_IMAGE,
          note: '已取消，不进入生产',
        },
      ],
      changeHistory: [
        {
          changeId: 'POCHG-RJ-CANCELLED-V2',
          fromVersion: 1,
          toVersion: 2,
          changedById: 'USR-PMS-LIU',
          changedByName: '刘静',
          changedAt: '2026-08-08T07:30:00+07:00',
          fields: [{ field: '采购状态', label: '采购状态', beforeValue: '有效', afterValue: '已取消' }],
        },
      ],
    },
  ]
}

function lineValidationReason(line: AccessoryPurchaseOrderLine): string {
  const missing: string[] = []
  if (!line.skuId.trim()) missing.push('SKU ID')
  if (!line.skuCode.trim()) missing.push('SKU 编码')
  if (!line.materialName.trim()) missing.push('物料名称')
  if (!(line.orderedQty > 0)) missing.push('采购数量')
  if (!line.unit.trim()) missing.push('单位')
  if (!line.dueDate.trim()) missing.push('交期')
  if (!line.targetWarehouseId.trim() || !line.targetWarehouseName.trim()) missing.push('目标仓库')
  if (!line.styleId.trim() || !line.styleCode.trim() || !line.styleName.trim()) missing.push('款式')
  if (!line.materialImageUrl.trim()) missing.push('物料图片')
  if (!line.styleImageUrl.trim()) missing.push('款式图片')
  if (!line.plannedInputs?.length) {
    missing.push('默认加工投入')
  } else {
    const invalidInputs = line.plannedInputs.filter((input) => (
      !input.inputMaterialId.trim()
      || !input.inputMaterialSku.trim()
      || !input.inputMaterialName.trim()
      || !input.specification.trim()
      || !input.color.trim()
      || !input.imageUrl.trim()
      || !input.unit.trim()
      || !Number.isFinite(input.unitUsage)
      || input.unitUsage <= 0
    ))
    if (invalidInputs.length > 0) missing.push('默认加工投入 SKU／单位用量')
    if (new Set(line.plannedInputs.map((input) => input.inputMaterialId)).size !== line.plannedInputs.length) {
      missing.push('默认加工投入重复 SKU')
    }
  }
  return missing.length > 0 ? `采购行信息不完整：${missing.join('、')}` : ''
}

function mergePlannedInputs(lines: AccessoryPurchaseOrderLine[]): LacePlannedInputMaterial[] {
  const grouped = new Map<string, LacePlannedInputMaterial>()
  for (const line of lines) {
    for (const input of line.plannedInputs ?? []) {
      if (!grouped.has(input.inputMaterialId)) grouped.set(input.inputMaterialId, { ...input })
    }
  }
  return [...grouped.values()]
}

function skuGroupConsistencyReason(lines: AccessoryPurchaseOrderLine[]): string {
  const first = lines[0]
  const identityFields: Array<[string, (line: AccessoryPurchaseOrderLine) => string]> = [
    ['SKU 编码', (line) => line.skuCode],
    ['物料名称', (line) => line.materialName],
    ['物料类型', (line) => line.materialType],
    ['规格', (line) => line.specification],
    ['颜色', (line) => line.color],
    ['单位', (line) => line.unit],
    ['交期', (line) => line.dueDate],
    ['目标仓库', (line) => `${line.targetWarehouseId}::${line.targetWarehouseName}`],
    ['物料图片', (line) => line.materialImageUrl],
  ]
  const inconsistent = identityFields
    .filter(([, read]) => lines.some((line) => read(line) !== read(first)))
    .map(([label]) => label)
  const inputSignature = (line: AccessoryPurchaseOrderLine) => (line.plannedInputs ?? [])
    .map((input) => `${input.inputMaterialId}::${input.inputMaterialSku}::${input.unit}::${input.unitUsage}`)
    .sort()
    .join('|')
  if (lines.some((line) => inputSignature(line) !== inputSignature(first))) inconsistent.push('默认加工投入')
  return inconsistent.length > 0 ? `同一采购单 SKU 来源行不一致：${inconsistent.join('、')}` : ''
}

export function projectLacePurchaseDemands(
  purchaseOrders: readonly AccessoryPurchaseOrder[],
  mappings: readonly AccessoryFactoryMapping[] = ACCESSORY_FACTORY_MAPPINGS,
): { demands: LacePurchaseDemand[]; failures: LacePurchaseProjectionFailure[] } {
  const enabledMappings = new Map(mappings.filter((item) => item.enabled).map((item) => [item.supplierId, item]))
  const demands: LacePurchaseDemand[] = []
  const failures: LacePurchaseProjectionFailure[] = []

  for (const purchaseOrder of purchaseOrders) {
    if (purchaseOrder.status !== '有效') continue
    const mapping = enabledMappings.get(purchaseOrder.supplierId)
    if (!mapping || mapping.factoryType !== '花边厂') continue

    const bySku = new Map<string, AccessoryPurchaseOrderLine[]>()
    for (const line of purchaseOrder.lines) {
      const group = bySku.get(line.skuId) ?? []
      group.push(line)
      bySku.set(line.skuId, group)
    }

    for (const [skuId, lines] of bySku) {
      if (!lines.some((line) => line.materialType === '花边')) continue
      const first = lines[0]
      const invalidLines = lines
        .map((line) => ({ line, reason: lineValidationReason(line) }))
        .filter((item) => item.reason)
      if (invalidLines.length > 0) {
        invalidLines.forEach(({ line, reason }) => failures.push({
          failureId: `${purchaseOrder.purchaseOrderId}::${line.purchaseOrderLineId}`,
          purchaseOrderId: purchaseOrder.purchaseOrderId,
          purchaseOrderNo: purchaseOrder.purchaseOrderNo,
          purchaseOrderLineId: line.purchaseOrderLineId,
          skuId: line.skuId,
          skuCode: line.skuCode,
          materialName: line.materialName,
          materialImageUrl: line.materialImageUrl,
          styleName: line.styleName,
          styleImageUrl: line.styleImageUrl,
          factoryOrgId: mapping.factoryOrgId,
          factoryName: mapping.factoryName,
          reason: `${reason}；同一采购单 SKU 必须全部修复后再生成`,
        }))
        continue
      }
      const consistencyReason = skuGroupConsistencyReason(lines)
      if (consistencyReason) {
        failures.push({
          failureId: `${purchaseOrder.purchaseOrderId}::${skuId}::GROUP`,
          purchaseOrderId: purchaseOrder.purchaseOrderId,
          purchaseOrderNo: purchaseOrder.purchaseOrderNo,
          purchaseOrderLineId: lines.map((line) => line.purchaseOrderLineId).join('、'),
          skuId,
          skuCode: first.skuCode,
          materialName: first.materialName,
          materialImageUrl: first.materialImageUrl,
          styleName: first.styleName,
          styleImageUrl: first.styleImageUrl,
          factoryOrgId: mapping.factoryOrgId,
          factoryName: mapping.factoryName,
          reason: consistencyReason,
        })
        continue
      }
      const orderedQty = Math.round(lines.reduce((sum, line) => sum + line.orderedQty, 0) * 100) / 100
      const latestChange = purchaseOrder.changeHistory
        .filter((record) => record.toVersion === purchaseOrder.version)
        .sort((left, right) => left.changedAt.localeCompare(right.changedAt))
        .at(-1)
      demands.push({
        generationKey: buildLaceProductionGenerationKey(purchaseOrder.purchaseOrderId, skuId),
        purchaseOrderId: purchaseOrder.purchaseOrderId,
        purchaseOrderNo: purchaseOrder.purchaseOrderNo,
        purchaseOrderVersion: purchaseOrder.version,
        purchaseStatus: purchaseOrder.status,
        supplierId: purchaseOrder.supplierId,
        supplierName: purchaseOrder.supplierName,
        factoryOrgId: mapping.factoryOrgId,
        factoryName: mapping.factoryName,
        skuId,
        skuCode: first.skuCode,
        materialName: first.materialName,
        materialType: '花边',
        specification: first.specification,
        color: first.color,
        materialImageUrl: first.materialImageUrl,
        orderedQty,
        unit: first.unit,
        dueDate: first.dueDate,
        targetWarehouseId: first.targetWarehouseId,
        targetWarehouseName: first.targetWarehouseName,
        styleId: first.styleId,
        styleCode: first.styleCode,
        styleName: first.styleName,
        styleImageUrl: first.styleImageUrl,
        note: [...new Set(lines.map((line) => line.note).filter(Boolean))].join('；'),
        sourceLineIds: lines.map((line) => line.purchaseOrderLineId),
        sourceLines: lines.map((line) => ({
          purchaseOrderLineId: line.purchaseOrderLineId,
          orderedQty: line.orderedQty,
          unit: line.unit,
          styleId: line.styleId,
          styleCode: line.styleCode,
          styleName: line.styleName,
          styleImageUrl: line.styleImageUrl,
          note: line.note,
        })),
        plannedInputs: mergePlannedInputs(lines),
        orderedAt: purchaseOrder.orderedAt,
        buyerId: purchaseOrder.buyerId,
        buyerName: purchaseOrder.buyerName,
        latestChange,
      })
    }
  }

  return {
    demands: demands.sort((left, right) => `${left.purchaseOrderNo}-${left.skuCode}`.localeCompare(`${right.purchaseOrderNo}-${right.skuCode}`)),
    failures,
  }
}
