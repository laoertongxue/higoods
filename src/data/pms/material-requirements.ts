import { getPublishedPurchaseMaterials, type PurchaseRequirementMaterial } from './canonical-purchase-references.ts'
import { listPmsMaterialInventory } from './material-inventory.ts'
import { listPmsMaterialPurchaseInventoryPostings, listPmsMaterialPurchaseOrders, hydratePmsMaterialPurchaseOrdersFromIdb } from './material-purchase-orders.ts'
import { PMS_STYLE_IMAGES } from './images.ts'
import { PMS_STORES, pmsAll, pmsGetEntityVersion, pmsCommitRecords } from './idb-storage.ts'
import { createPmsOperationLog, publishPmsOperationLog, nextPmsSequence, roundPmsQty } from './runtime.ts'

export type PmsMaterialPushStatus = '待下推' | '已下推'
export type PmsMaterialRequirementStatus = '已生成' | '部分下推' | '已下推'

export interface PmsMaterialRequirementLine {
  unitPrice?:number
  priceConfirmed?:boolean
  printingFactory?:string
  printingProcess?:string
  stockKnown?: boolean
  historicalStockKnown?: boolean
  lineNo: string
  materialCode: string
  materialName: string
  materialType: string
  imageUrl: string
  unit: string
  styleCode: string
  styleName: string
  styleImageUrl: string
  sourceSku: string
  skuQty: number
  usagePerPiece: number
  lossRate: number
  plannedUsage: number
  bomDemand: number
  stockQty: number
  historicalStockQty: number
  idHistoricalStockQty: number
  purchasingQty: number
  suggestedQty: number
  actualQty: number
  supplierName: string
  warehouse: string
  pushStatus: PmsMaterialPushStatus
  generatedPurchaseOrderNo: string
}

export interface PmsMaterialRequirement {
  remark?:string
  purchaseRegion?:string
  buyerName?:string
  rejectedReason?:string
  requirementNo: string
  sourcePurchaseOrderNo: string
  sourceSuggestionNo: string
  spu: string
  productName: string
  styleImageUrl: string
  createdAt: string
  status: PmsMaterialRequirementStatus
  lines: PmsMaterialRequirementLine[]
  // § 2.4.3.6 乐观锁:hydrate 时从 pmsVersionSnapshots 注入;persist 时 pmsPersistEntity 自动检测版本冲突。
  _pmsBaseVersion?: number
}

interface PmsRequirementRuntime {
  requirements: PmsMaterialRequirement[]
}

let runtime: PmsRequirementRuntime | null = null

/**
 * 面辅料需求 IDB hydrate 状态机(同其他 PMS 模块模式)。
 */
let requirementHydrationPromise: Promise<void> | null = null
export function hydratePmsMaterialRequirementsFromIdb(): Promise<void> {
  return requirementHydrationPromise ??= pmsAll<PmsMaterialRequirement>(PMS_STORES.pmsMaterialRequirements).then(rows => {
    for(const saved of rows) { const before = getRuntime().requirements.find(row => row.requirementNo === saved.requirementNo); if(before) Object.assign(before,saved); else getRuntime().requirements.push(saved) }
  }).catch(error => { requirementHydrationPromise = null; throw error })
}

function getRuntime(): PmsRequirementRuntime {
  if (!runtime){runtime = buildInitialRuntime();const links:Record<string,string>={'MREQ-0002-01':'CGF-2026-0001','MREQ-0002-02':'CGF-2026-0002','MREQ-0003-01':'CGF-2026-0003'};for(const requirement of runtime.requirements){for(const line of requirement.lines)if(links[line.lineNo]){line.generatedPurchaseOrderNo=links[line.lineNo];line.pushStatus='已下推'}requirement.status=requirement.lines.every(line=>line.pushStatus==='已下推'||line.suggestedQty<=0)?'已下推':requirement.lines.some(line=>line.pushStatus==='已下推')?'部分下推':'已生成'}}
  return runtime
}

// Existing procurement requirement snapshots remain independent of retired master records.
function buildInitialRuntime(): PmsRequirementRuntime {
  return { requirements: [
  {
    "requirementNo": "MREQ-0003",
    "sourcePurchaseOrderNo": "CG-2026-0021",
    "sourceSuggestionNo": "",
    "spu": "HG-SK-2604",
    "productName": "女款连衣裙",
    "styleImageUrl": "/dress-sample-1.jpg",
    "createdAt": "2026-10-13T12:10:38.703Z",
    "status": "已生成",
    "lines": [
      {
        "lineNo": "MREQ-0003-01",
        "materialCode": "FAB-2026-0001",
        "materialName": "180g 纯棉针织布",
        "materialType": "面料",
        "imageUrl": "/materials/fabric-main.jpg",
        "unit": "米",
        "styleCode": "SK-2604",
        "styleName": "女款连衣裙",
        "styleImageUrl": "/dress-sample-1.jpg",
        "sourceSku": "HG-SK-2604-NV-M / HG-SK-2604-NV-L",
        "skuQty": 1700,
        "usagePerPiece": 1.8,
        "lossRate": 0.06,
        "plannedUsage": 1.908,
        "bomDemand": 3243.6,
        "stockQty": 1200,
        "historicalStockQty": 1308,
        "idHistoricalStockQty": 780,
        "purchasingQty": 600,
        "suggestedQty": 1443.6,
        "actualQty": 1443.6,
        "supplierName": "广州华盛面料有限公司",
        "warehouse": "广州原料仓",
        "pushStatus": "待下推",
        "generatedPurchaseOrderNo": ""
      },
      {
        "lineNo": "MREQ-0003-02",
        "materialCode": "ACC-2026-0001",
        "materialName": "YKK 5号尼龙拉链",
        "materialType": "辅料",
        "imageUrl": "/materials/accessory-zipper.jpg",
        "unit": "个",
        "styleCode": "SK-2604",
        "styleName": "女款连衣裙",
        "styleImageUrl": "/dress-sample-1.jpg",
        "sourceSku": "HG-SK-2604-NV-M / HG-SK-2604-NV-L",
        "skuQty": 1700,
        "usagePerPiece": 1,
        "lossRate": 0.01,
        "plannedUsage": 1.01,
        "bomDemand": 1717,
        "stockQty": 3000,
        "historicalStockQty": 3270,
        "idHistoricalStockQty": 1950,
        "purchasingQty": 1500,
        "suggestedQty": 0,
        "actualQty": 0,
        "supplierName": "东莞宏远辅料有限公司",
        "warehouse": "广州原料仓",
        "pushStatus": "待下推",
        "generatedPurchaseOrderNo": ""
      },
      {
        "lineNo": "MREQ-0003-03",
        "materialCode": "ACC-2026-0003",
        "materialName": "白色织唛",
        "materialType": "辅料",
        "imageUrl": "/materials/accessory-label.jpg",
        "unit": "个",
        "styleCode": "SK-2604",
        "styleName": "女款连衣裙",
        "styleImageUrl": "/dress-sample-1.jpg",
        "sourceSku": "HG-SK-2604-NV-M / HG-SK-2604-NV-L",
        "skuQty": 1700,
        "usagePerPiece": 1,
        "lossRate": 0,
        "plannedUsage": 1,
        "bomDemand": 1700,
        "stockQty": 4000,
        "historicalStockQty": 4360,
        "idHistoricalStockQty": 2600,
        "purchasingQty": 2000,
        "suggestedQty": 0,
        "actualQty": 0,
        "supplierName": "东莞宏远辅料有限公司",
        "warehouse": "广州原料仓",
        "pushStatus": "待下推",
        "generatedPurchaseOrderNo": ""
      },
      {
        "lineNo": "MREQ-0003-04",
        "materialCode": "ACC-2026-0004",
        "materialName": "涤纶缝纫线",
        "materialType": "辅料",
        "imageUrl": "/materials/yarn-stitching.jpg",
        "unit": "卷",
        "styleCode": "SK-2604",
        "styleName": "女款连衣裙",
        "styleImageUrl": "/dress-sample-1.jpg",
        "sourceSku": "HG-SK-2604-NV-M / HG-SK-2604-NV-L",
        "skuQty": 1700,
        "usagePerPiece": 0.04,
        "lossRate": 0.03,
        "plannedUsage": 0.0412,
        "bomDemand": 70.04,
        "stockQty": 50,
        "historicalStockQty": 54,
        "idHistoricalStockQty": 33,
        "purchasingQty": 20,
        "suggestedQty": 0.04,
        "actualQty": 0.04,
        "supplierName": "泉州瑞达服装辅料有限公司",
        "warehouse": "广州原料仓",
        "pushStatus": "待下推",
        "generatedPurchaseOrderNo": ""
      }
    ]
  },
  {
    "requirementNo": "MREQ-0002",
    "sourcePurchaseOrderNo": "CG-2026-0020",
    "sourceSuggestionNo": "",
    "spu": "HG-SH-2607",
    "productName": "商务衬衫",
    "styleImageUrl": "/shirt-sample.jpg",
    "createdAt": "2026-10-13T12:10:38.703Z",
    "status": "已生成",
    "lines": [
      {
        "lineNo": "MREQ-0002-01",
        "materialCode": "FAB-2026-0001",
        "materialName": "180g 纯棉针织布",
        "materialType": "面料",
        "imageUrl": "/materials/fabric-main.jpg",
        "unit": "米",
        "styleCode": "SH-2607",
        "styleName": "商务衬衫",
        "styleImageUrl": "/shirt-sample.jpg",
        "sourceSku": "HG-SH-2607-WH-M / HG-SH-2607-WH-L",
        "skuQty": 1400,
        "usagePerPiece": 1.6,
        "lossRate": 0.05,
        "plannedUsage": 1.68,
        "bomDemand": 2352,
        "stockQty": 1200,
        "historicalStockQty": 1308,
        "idHistoricalStockQty": 780,
        "purchasingQty": 600,
        "suggestedQty": 552,
        "actualQty": 552,
        "supplierName": "广州华盛面料有限公司",
        "warehouse": "广州原料仓",
        "pushStatus": "待下推",
        "generatedPurchaseOrderNo": ""
      },
      {
        "lineNo": "MREQ-0002-02",
        "materialCode": "ACC-2026-0002",
        "materialName": "黑色四眼纽扣",
        "materialType": "辅料",
        "imageUrl": "/materials/accessory-button.jpg",
        "unit": "个",
        "styleCode": "SH-2607",
        "styleName": "商务衬衫",
        "styleImageUrl": "/shirt-sample.jpg",
        "sourceSku": "HG-SH-2607-WH-M / HG-SH-2607-WH-L",
        "skuQty": 1400,
        "usagePerPiece": 7,
        "lossRate": 0.02,
        "plannedUsage": 7.14,
        "bomDemand": 9996,
        "stockQty": 6000,
        "historicalStockQty": 6540,
        "idHistoricalStockQty": 3900,
        "purchasingQty": 3000,
        "suggestedQty": 996,
        "actualQty": 996,
        "supplierName": "东莞宏远辅料有限公司",
        "warehouse": "广州原料仓",
        "pushStatus": "待下推",
        "generatedPurchaseOrderNo": ""
      },
      {
        "lineNo": "MREQ-0002-03",
        "materialCode": "ACC-2026-0004",
        "materialName": "涤纶缝纫线",
        "materialType": "辅料",
        "imageUrl": "/materials/yarn-stitching.jpg",
        "unit": "卷",
        "styleCode": "SH-2607",
        "styleName": "商务衬衫",
        "styleImageUrl": "/shirt-sample.jpg",
        "sourceSku": "HG-SH-2607-WH-M / HG-SH-2607-WH-L",
        "skuQty": 1400,
        "usagePerPiece": 0.03,
        "lossRate": 0.03,
        "plannedUsage": 0.0309,
        "bomDemand": 43.26,
        "stockQty": 50,
        "historicalStockQty": 54,
        "idHistoricalStockQty": 33,
        "purchasingQty": 20,
        "suggestedQty": 0,
        "actualQty": 0,
        "supplierName": "泉州瑞达服装辅料有限公司",
        "warehouse": "广州原料仓",
        "pushStatus": "待下推",
        "generatedPurchaseOrderNo": ""
      },
      {
        "lineNo": "MREQ-0002-04",
        "materialCode": "ACC-2026-0003",
        "materialName": "白色织唛",
        "materialType": "辅料",
        "imageUrl": "/materials/accessory-label.jpg",
        "unit": "个",
        "styleCode": "SH-2607",
        "styleName": "商务衬衫",
        "styleImageUrl": "/shirt-sample.jpg",
        "sourceSku": "HG-SH-2607-WH-M / HG-SH-2607-WH-L",
        "skuQty": 1400,
        "usagePerPiece": 2,
        "lossRate": 0.01,
        "plannedUsage": 2.02,
        "bomDemand": 2828,
        "stockQty": 4000,
        "historicalStockQty": 4360,
        "idHistoricalStockQty": 2600,
        "purchasingQty": 2000,
        "suggestedQty": 0,
        "actualQty": 0,
        "supplierName": "东莞宏远辅料有限公司",
        "warehouse": "广州原料仓",
        "pushStatus": "待下推",
        "generatedPurchaseOrderNo": ""
      }
    ]
  },
  {
    "requirementNo": "MREQ-0001",
    "sourcePurchaseOrderNo": "CG-2026-0018",
    "sourceSuggestionNo": "PSG-2026-0003",
    "spu": "HG-HD-2603",
    "productName": "连帽卫衣",
    "styleImageUrl": "/production-confirmation-demo/grey-zip-hoodie.png",
    "createdAt": "2026-10-13T12:10:38.703Z",
    "status": "已生成",
    "lines": [
      {
        "lineNo": "MREQ-0001-01",
        "materialCode": "FAB-2026-0002",
        "materialName": "220g 涤棉卫衣布",
        "materialType": "面料",
        "imageUrl": "/materials/fei-ticket/fog-grey-sweatshirt-fleece.png",
        "unit": "米",
        "styleCode": "HD-2603",
        "styleName": "连帽卫衣",
        "styleImageUrl": "/production-confirmation-demo/grey-zip-hoodie.png",
        "sourceSku": "HG-HD-2603-GY-M / HG-HD-2603-GY-L / HG-HD-2603-NV-M",
        "skuQty": 3600,
        "usagePerPiece": 1.15,
        "lossRate": 0.07,
        "plannedUsage": 1.2305,
        "bomDemand": 4429.8,
        "stockQty": 900,
        "historicalStockQty": 972,
        "idHistoricalStockQty": 585,
        "purchasingQty": 400,
        "suggestedQty": 3129.8,
        "actualQty": 3129.8,
        "supplierName": "绍兴锦达纺织有限公司",
        "warehouse": "广州原料仓",
        "pushStatus": "待下推",
        "generatedPurchaseOrderNo": ""
      },
      {
        "lineNo": "MREQ-0001-02",
        "materialCode": "ACC-2026-0001",
        "materialName": "YKK 5号尼龙拉链",
        "materialType": "辅料",
        "imageUrl": "/materials/accessory-zipper.jpg",
        "unit": "个",
        "styleCode": "HD-2603",
        "styleName": "连帽卫衣",
        "styleImageUrl": "/production-confirmation-demo/grey-zip-hoodie.png",
        "sourceSku": "HG-HD-2603-GY-M / HG-HD-2603-GY-L / HG-HD-2603-NV-M",
        "skuQty": 3600,
        "usagePerPiece": 1,
        "lossRate": 0.01,
        "plannedUsage": 1.01,
        "bomDemand": 3636,
        "stockQty": 3000,
        "historicalStockQty": 3270,
        "idHistoricalStockQty": 1950,
        "purchasingQty": 1500,
        "suggestedQty": 0,
        "actualQty": 0,
        "supplierName": "东莞宏远辅料有限公司",
        "warehouse": "广州原料仓",
        "pushStatus": "待下推",
        "generatedPurchaseOrderNo": ""
      },
      {
        "lineNo": "MREQ-0001-03",
        "materialCode": "ACC-2026-0003",
        "materialName": "白色织唛",
        "materialType": "辅料",
        "imageUrl": "/materials/accessory-label.jpg",
        "unit": "个",
        "styleCode": "HD-2603",
        "styleName": "连帽卫衣",
        "styleImageUrl": "/production-confirmation-demo/grey-zip-hoodie.png",
        "sourceSku": "HG-HD-2603-GY-M / HG-HD-2603-GY-L / HG-HD-2603-NV-M",
        "skuQty": 3600,
        "usagePerPiece": 2,
        "lossRate": 0,
        "plannedUsage": 2,
        "bomDemand": 7200,
        "stockQty": 4000,
        "historicalStockQty": 4360,
        "idHistoricalStockQty": 2600,
        "purchasingQty": 2000,
        "suggestedQty": 1200,
        "actualQty": 1200,
        "supplierName": "东莞宏远辅料有限公司",
        "warehouse": "广州原料仓",
        "pushStatus": "待下推",
        "generatedPurchaseOrderNo": ""
      },
      {
        "lineNo": "MREQ-0001-04",
        "materialCode": "ACC-2026-0004",
        "materialName": "涤纶缝纫线",
        "materialType": "辅料",
        "imageUrl": "/materials/yarn-stitching.jpg",
        "unit": "卷",
        "styleCode": "HD-2603",
        "styleName": "连帽卫衣",
        "styleImageUrl": "/production-confirmation-demo/grey-zip-hoodie.png",
        "sourceSku": "HG-HD-2603-GY-M / HG-HD-2603-GY-L / HG-HD-2603-NV-M",
        "skuQty": 3600,
        "usagePerPiece": 0.04,
        "lossRate": 0.03,
        "plannedUsage": 0.0412,
        "bomDemand": 148.32,
        "stockQty": 50,
        "historicalStockQty": 54,
        "idHistoricalStockQty": 33,
        "purchasingQty": 20,
        "suggestedQty": 78.32,
        "actualQty": 78.32,
        "supplierName": "泉州瑞达服装辅料有限公司",
        "warehouse": "广州原料仓",
        "pushStatus": "待下推",
        "generatedPurchaseOrderNo": ""
      }
    ]
  }
] }
}

function aggregateMaterials(
  bomMaterials: PurchaseRequirementMaterial[],
  skuLines: Array<{ sku: string; qty: number }>,
): Array<PurchaseRequirementMaterial & { bomDemand: number }> {
  const bomByCode = new Map(bomMaterials.map((material) => [material.materialCode, material]))
  const aggregated = new Map<string, PurchaseRequirementMaterial & { bomDemand: number }>()
  skuLines.forEach((skuLine) => {
    bomMaterials.forEach((material) => {
      if (material.applicableSkuCodes?.length && !material.applicableSkuCodes.includes(skuLine.sku)) return
      const demand = roundPmsQty(skuLine.qty * material.usagePerPiece * (1 + material.lossRate), 2)
      const existing = aggregated.get(material.materialCode)
      if (existing) existing.bomDemand = roundPmsQty(existing.bomDemand + demand, 2)
      else {
        const base = bomByCode.get(material.materialCode) ?? material
        aggregated.set(material.materialCode, { ...base, bomDemand: demand, usagePerPiece: material.usagePerPiece, lossRate: material.lossRate })
      }
    })
  })
  return [...aggregated.values()]
}

export interface PmsRequirementOrderSource {
  purchaseOrderNo: string
  spu: string
  productName: string
  imageUrl: string
  sourceSuggestionNo: string
  lines: Array<{ sku: string; qty: number }>
}

export function getPmsRequirementMaterialBalance(materialCode:string,unit:string):{stockQty:number;stockKnown:boolean;purchasingQty:number} {
  const stocks=listPmsMaterialInventory().filter(row=>row.sku===materialCode && row.unit===unit)
  const purchases=listPmsMaterialPurchaseOrders().filter(row=>row.materialCode===materialCode && row.unit===unit && row.status!=='已关闭' && row.status!=='已到货')
  return {stockQty:roundPmsQty(Math.max(0,stocks.reduce((sum,row)=>sum+row.stockQty,0)-listPmsMaterialPurchaseInventoryPostings().filter(row=>row.materialCode===materialCode&&row.unit===unit&&row.quality==='瑕疵').reduce((sum,row)=>sum+row.qty,0)),2),stockKnown:stocks.length>0,purchasingQty:roundPmsQty(purchases.reduce((sum,row)=>sum+Math.max(0,row.orderedQty-row.receivedQty),0),2)}
}

export function preparePmsMaterialRequirementFromOrder(order: PmsRequirementOrderSource, operationId: string): PmsMaterialRequirement {
  const bomTemplate = getPublishedPurchaseMaterials(order.spu)
  if (!bomTemplate) throw new Error(`当前已发布技术资料不可用: ${order.spu}`)
  const aggregated = aggregateMaterials(bomTemplate.materials, order.lines)
  const requirementNo = `MREQ-${operationId}`
  const lines: PmsMaterialRequirementLine[] = aggregated.map((material, index) => {const balance=getPmsRequirementMaterialBalance(material.materialCode,material.unit);return ({
    lineNo: `${requirementNo}-${String(index + 1).padStart(2, '0')}`,
    materialCode: material.materialCode,
    materialName: material.materialName,
    materialType: material.materialType,
    imageUrl: material.imageUrl,
    unit: material.unit,
    styleCode: bomTemplate.styleCode,
    styleName: bomTemplate.productName,
    styleImageUrl: bomTemplate.imageUrl,
    sourceSku: order.lines.map((line) => line.sku).join(' / '),
    skuQty: order.lines.reduce((sum, line) => sum + line.qty, 0),
    usagePerPiece: material.usagePerPiece,
    lossRate: material.lossRate,
    plannedUsage: roundPmsQty(material.usagePerPiece * (1 + material.lossRate), 4),
    bomDemand: material.bomDemand,
    stockQty: balance.stockQty,
    stockKnown: balance.stockKnown,
    historicalStockKnown: false,
    historicalStockQty: 0,
    idHistoricalStockQty: 0,
    purchasingQty: balance.purchasingQty,
    suggestedQty: roundPmsQty(Math.max(0, material.bomDemand - balance.stockQty - balance.purchasingQty), 2),
    actualQty: roundPmsQty(Math.max(0, material.bomDemand - balance.stockQty - balance.purchasingQty), 2),
    supplierName: material.supplierName,
    warehouse: material.warehouse,
    pushStatus: '待下推',
    generatedPurchaseOrderNo: '',
  })})
  const requirement: PmsMaterialRequirement = {
    requirementNo,
    sourcePurchaseOrderNo: order.purchaseOrderNo,
    sourceSuggestionNo: order.sourceSuggestionNo,
    spu: order.spu,
    productName: order.productName,
    styleImageUrl: order.imageUrl,
    createdAt: new Date().toISOString(),
    status: '已生成',
    lines,
  }
  return requirement
}

export function listPmsMaterialRequirements(): PmsMaterialRequirement[] {
  return getRuntime().requirements
}

export function getPmsMaterialRequirement(requirementNo: string): PmsMaterialRequirement | undefined {
  return getRuntime().requirements.find((requirement) => requirement.requirementNo === requirementNo)
}

/**
 * 注册原型内建、可追溯的 PMS 需求来源。它只负责准备原型初始数据；页面渲染不得调用。
 * 同编号重复注册必须内容一致，避免用字符串假装存在上游需求。
 */
export function registerPmsMaterialRequirementPrototype(requirement: PmsMaterialRequirement): void {
  const existing = getPmsMaterialRequirement(requirement.requirementNo)
  if (existing) {
    if (JSON.stringify(existing) !== JSON.stringify(requirement)) throw new Error(`PMS 面辅料需求 ${requirement.requirementNo} 已存在其他内容。`)
    return
  }
  if (!requirement.requirementNo.trim() || !requirement.sourcePurchaseOrderNo.trim() || !requirement.lines.length) throw new Error('PMS 原型需求必须包含来源生产采购单和至少一条物料行。')
  if (requirement.lines.some((line) => !line.lineNo.trim() || !line.materialCode.trim() || line.actualQty <= 0 || !line.generatedPurchaseOrderNo.trim())) throw new Error('PMS 原型需求行必须包含物料、数量和已生成采购单。')
  getRuntime().requirements.unshift(structuredClone(requirement))

}

export interface PmsRequirementPushInput {
  lineNo: string
  actualQty: number
  purchaseOrderNo: string
}

export function applyPmsMaterialRequirementPush(requirementNo: string, pushedLines: PmsRequirementPushInput[]): PmsMaterialRequirement {
  const before = getPmsMaterialRequirement(requirementNo)
  const requirement = before ? structuredClone(before) : undefined
  if (!requirement) throw new Error(`面辅料需求 ${requirementNo} 不存在`)
  pushedLines.forEach((input) => {
    const line = requirement.lines.find((item) => item.lineNo === input.lineNo)
    if (!line) throw new Error(`面辅料需求行 ${input.lineNo} 不存在`)
    line.actualQty = input.actualQty
    line.pushStatus = '已下推'
    line.generatedPurchaseOrderNo = input.purchaseOrderNo
  })
  const pushedCount = requirement.lines.filter((line) => line.pushStatus === '已下推').length
  requirement.status = requirement.lines.every(line=>line.pushStatus==='已下推'||line.suggestedQty<=0) ? '已下推' : '部分下推'

  return requirement
}

export function listPendingPmsRequirementLines(): PmsMaterialRequirementLine[] {
  return getRuntime().requirements.flatMap((requirement) => requirement.lines.filter((line) => line.pushStatus === '待下推' && line.suggestedQty > 0))
}

export function publishPmsMaterialRequirements(rows: PmsMaterialRequirement[]): void {
  for(const row of rows) { const before = getRuntime().requirements.find(old => old.requirementNo === row.requirementNo); if(before) Object.assign(before,row); else getRuntime().requirements.unshift(row) }
}
export async function createPmsMaterialRequirementFromOrder(order: PmsRequirementOrderSource, operationId: string = crypto.randomUUID()): Promise<{requirementNo:string;lines:PmsMaterialRequirementLine[]}> {
  await Promise.all([hydratePmsMaterialRequirementsFromIdb(),hydratePmsMaterialPurchaseOrdersFromIdb()])
  const candidate = preparePmsMaterialRequirementFromOrder(order,operationId)
  await pmsCommitRecords([{store:PMS_STORES.pmsMaterialRequirements,value:candidate}],{operationId,operationSignature:JSON.stringify(order)})
  publishPmsMaterialRequirements([candidate])
  return candidate
}

export async function updatePmsMaterialRequirement(requirementNo:string,patch:{remark?:string;skuQty?:number;purchaseRegion?:string;buyerName?:string;rejectedReason?:string;associatePurchaseOrderNo?:string;replacement?:{lineNo:string;materialCode:string};lineDetails?:Array<{lineNo:string;supplierName:string;warehouse:string;actualQty:number}>},operationId:string):Promise<PmsMaterialRequirement> {
  await Promise.all([hydratePmsMaterialRequirementsFromIdb(),hydratePmsMaterialPurchaseOrdersFromIdb()])
  const before=getPmsMaterialRequirement(requirementNo)
  if(!before) throw new Error('面辅料需求不存在')
  const row=structuredClone(before)
  if(patch.remark!==undefined) row.remark=patch.remark.trim()
  if(patch.purchaseRegion!==undefined) row.purchaseRegion=patch.purchaseRegion.trim()
  if(patch.buyerName!==undefined) row.buyerName=patch.buyerName.trim()
  if(patch.rejectedReason!==undefined){if(!patch.rejectedReason.trim() || row.status==='已下推') throw new Error('填写驳回原因，已全部下推需求不能驳回');row.rejectedReason=patch.rejectedReason.trim()}
  if(patch.skuQty!==undefined){if(!Number.isInteger(patch.skuQty)||patch.skuQty<=0 || row.lines.some(line=>line.pushStatus==='已下推')) throw new Error('仅未下推需求可以修改数量，件数须为正整数');for(const line of row.lines){line.skuQty=patch.skuQty;line.bomDemand=roundPmsQty(line.skuQty*line.usagePerPiece*(1+line.lossRate),2);line.suggestedQty=roundPmsQty(Math.max(0,line.bomDemand-line.stockQty-line.purchasingQty),2);line.actualQty=line.suggestedQty}}
  if(patch.replacement){const {getPurchaseMaterialReference}=await import('./canonical-purchase-references.ts');const line=row.lines.find(line=>line.lineNo===patch.replacement!.lineNo),reference=getPurchaseMaterialReference(patch.replacement.materialCode);if(!line || line.pushStatus==='已下推' || !reference?.active || !reference.imageUrl || reference.unit!==line.unit) throw new Error('选择同计量单位且已启用的替换物料，已下推行不能替换');const balance=getPmsRequirementMaterialBalance(reference.materialCode,line.unit);const qty=roundPmsQty(Math.max(0,line.bomDemand-balance.stockQty-balance.purchasingQty),2);Object.assign(line,{materialCode:reference.materialCode,materialName:reference.materialName,imageUrl:reference.imageUrl,materialType:reference.category,...balance,historicalStockKnown:false,historicalStockQty:0,idHistoricalStockQty:0,suggestedQty:qty,actualQty:qty})}
  if(patch.lineDetails) for(const input of patch.lineDetails){const line=row.lines.find(line=>line.lineNo===input.lineNo);if(!line || line.pushStatus==='已下推' || !input.supplierName.trim() || !input.warehouse.trim() || !Number.isFinite(input.actualQty) || input.actualQty<0) throw new Error('未下推行须填写供应商、采购仓库和非负数量');Object.assign(line,{supplierName:input.supplierName.trim(),warehouse:input.warehouse.trim(),actualQty:roundPmsQty(input.actualQty,2)})}
  const records:Array<import('./idb-storage.ts').PmsCommitRecord>=[{store:PMS_STORES.pmsMaterialRequirements,value:row}]
  let purchase: import('./material-purchase-orders.ts').PmsMaterialPurchaseOrder | undefined
  if(patch.associatePurchaseOrderNo){const {getPmsMaterialPurchaseOrder}=await import('./material-purchase-orders.ts');const source=getPmsMaterialPurchaseOrder(patch.associatePurchaseOrderNo);const line=row.lines.find(line=>line.materialCode===source?.materialCode && line.pushStatus==='待下推');if(!source || !line || source.requirementNo && source.requirementNo!==requirementNo) throw new Error('选择物料一致且未关联其它需求的采购单');purchase={...structuredClone(source),requirementNo,sourceRequirementLineNo:line.lineNo,sourceProductPurchaseOrderNo:row.sourcePurchaseOrderNo};line.generatedPurchaseOrderNo=source.purchaseOrderNo;line.pushStatus='已下推';line.actualQty=source.orderedQty;row.status=row.lines.every(line=>line.pushStatus==='已下推'||line.suggestedQty<=0)?'已下推':'部分下推';records.push({store:PMS_STORES.pmsMaterialPurchaseOrderDeltas,value:purchase})}
  let product:import('./product-purchase-orders.ts').PmsProductPurchaseOrder|undefined
  if(purchase){const module=await import('./product-purchase-orders.ts');await module.hydratePmsProductPurchaseOrdersFromIdb();const source=module.getPmsProductPurchaseOrder(row.sourcePurchaseOrderNo);if(source){product=structuredClone(source);product.version+=1;product.lines.forEach(line=>line.materialStatus=row.status==='已下推'?'已下推':'已生成');records.push({store:PMS_STORES.pmsProductPurchaseOrders,value:product})}}
  await pmsCommitRecords(records,{operationId,operationSignature:JSON.stringify([requirementNo,patch]),log:{objectType:'material-requirement',objectId:requirementNo,action:patch.rejectedReason?'驳回需求':patch.associatePurchaseOrderNo?'关联采购单':'修改需求',beforeValue:'',afterValue:JSON.stringify(patch),reason:patch.rejectedReason || '',actorId:'USR-PMS-BUYER',actorName:'采购管理',actorRole:'采购员',secondConfirmation:!!patch.rejectedReason}})
  Object.assign(before,row)
  if(product){const module=await import('./product-purchase-orders.ts');module.publishPmsProductPurchaseOrders([product])}
  if(purchase){const {publishPmsMaterialPurchaseOrders}=await import('./material-purchase-orders.ts');publishPmsMaterialPurchaseOrders([purchase])}
  return before
}

export async function batchUpdatePmsMaterialRequirements(nos:string[],field:'buyerName'|'supplierName'|'purchaseRegion'|'remark'|'unitPrice'|'printingFactory'|'printingProcess'|'rejectedReason',value:string,operationId:string):Promise<PmsMaterialRequirement[]>{
 await Promise.all([hydratePmsMaterialRequirementsFromIdb(),hydratePmsMaterialPurchaseOrdersFromIdb()])
 if(!nos.length || new Set(nos).size!==nos.length || !value.trim())throw new Error('选择需求并填写设置内容')
 if(field==='unitPrice'&&(!Number.isFinite(Number(value))||Number(value)<0))throw new Error('实际单价须为非负数')
 const candidates=nos.map(no=>{const before=getPmsMaterialRequirement(no);if(!before)throw new Error('需求已不存在，重新查询');const row=structuredClone(before);if(field==='rejectedReason'&&row.status==='已下推')throw new Error('已全部下推需求不能驳回');if(['buyerName','purchaseRegion','remark','rejectedReason'].includes(field))Object.assign(row,{[field]:value.trim()});else row.lines.forEach(line=>Object.assign(line,{[field]:field==='unitPrice'?Number(value):value.trim(),...(field==='unitPrice'?{priceConfirmed:true}:{})}));return row})
 const {getPmsMaterialPurchaseOrder,publishPmsMaterialPurchaseOrders}=await import('./material-purchase-orders.ts')
 const related=new Map<string,import('./material-purchase-orders.ts').PmsMaterialPurchaseOrder>()
 for(const row of candidates)for(const line of row.lines){if(!line.generatedPurchaseOrderNo || field==='rejectedReason')continue;const source=getPmsMaterialPurchaseOrder(line.generatedPurchaseOrderNo);if(!source)throw new Error('关联采购单不可读，未保存');if(['已关闭','已入库'].includes(source.status))throw new Error('已关闭或已入库的关联采购单不能修改');const next=related.get(source.purchaseOrderNo)||structuredClone(source);Object.assign(next,{[field]:field==='unitPrice'?Number(value):value.trim()});related.set(next.purchaseOrderNo,next)}
 const logs=candidates.map(row=>({...createPmsOperationLog({objectType:'material-requirement',objectId:row.requirementNo,action:field==='rejectedReason'?'批量驳回需求':'批量设置需求',beforeValue:'',afterValue:value,reason:field==='rejectedReason'?value:'',actorId:'USR-PMS-BUYER',actorName:'采购管理',actorRole:'采购员',secondConfirmation:true}),id:`${operationId}:log:${row.requirementNo}`}))
 await pmsCommitRecords([...candidates.map(value=>({store:PMS_STORES.pmsMaterialRequirements,value})),...Array.from(related.values()).map(value=>({store:PMS_STORES.pmsMaterialPurchaseOrderDeltas,value})),...logs.map(value=>({store:PMS_STORES.pmsOperationLogs,value}))],{operationId,operationSignature:JSON.stringify([nos,field,value])})
 logs.forEach(publishPmsOperationLog)
 publishPmsMaterialRequirements(candidates);publishPmsMaterialPurchaseOrders(Array.from(related.values()));return candidates
}

export async function batchAssociatePmsMaterialRequirements(entries:Array<{requirementNo:string;purchaseOrderNo:string}>,operationId:string):Promise<void>{
 await Promise.all([hydratePmsMaterialRequirementsFromIdb(),hydratePmsMaterialPurchaseOrdersFromIdb()]);if(!entries.length || new Set(entries.map(row=>row.requirementNo)).size!==entries.length || new Set(entries.map(row=>row.purchaseOrderNo)).size!==entries.length)throw new Error('选择不重复的需求和采购单')
 const module=await import('./product-purchase-orders.ts');await module.hydratePmsProductPurchaseOrdersFromIdb()
 const requirements:PmsMaterialRequirement[]=[],purchases:import('./material-purchase-orders.ts').PmsMaterialPurchaseOrder[]=[],products=new Map<string,import('./product-purchase-orders.ts').PmsProductPurchaseOrder>()
 for(const entry of entries){const source=getPmsMaterialRequirement(entry.requirementNo),purchase=listPmsMaterialPurchaseOrders().find(row=>row.purchaseOrderNo===entry.purchaseOrderNo);if(!source||source.rejectedReason||!purchase||purchase.requirementNo||purchase.status==='已关闭')throw new Error('需求或采购单不允许关联');const row=structuredClone(source),line=row.lines.find(line=>line.materialCode===purchase.materialCode&&line.unit===purchase.unit&&line.pushStatus==='待下推');if(!line)throw new Error('采购单 SKU 和单位须与未下推的需求行一致');line.pushStatus='已下推';line.actualQty=purchase.orderedQty;line.generatedPurchaseOrderNo=purchase.purchaseOrderNo;row.status=row.lines.every(line=>line.pushStatus==='已下推'||line.suggestedQty<=0)?'已下推':'部分下推';requirements.push(row);purchases.push({...structuredClone(purchase),requirementNo:row.requirementNo,sourceRequirementLineNo:line.lineNo,sourceProductPurchaseOrderNo:row.sourcePurchaseOrderNo});const original=module.getPmsProductPurchaseOrder(row.sourcePurchaseOrderNo);if(original){const product=products.get(original.purchaseOrderNo)||structuredClone(original);product.version=original.version+1;product.lines.forEach(line=>line.materialStatus=row.status==='已下推'?'已下推':'已生成');products.set(product.purchaseOrderNo,product)}}
 const logs=requirements.map(row=>({...createPmsOperationLog({objectType:'material-requirement',objectId:row.requirementNo,action:'批量关联采购单',beforeValue:'',afterValue:row.lines.map(line=>line.generatedPurchaseOrderNo).filter(Boolean).join('、'),reason:'',actorId:'USR-PMS-BUYER',actorName:'采购管理',actorRole:'采购员'}),id:`${operationId}:log:${row.requirementNo}`}))
 await pmsCommitRecords([...requirements.map(value=>({store:PMS_STORES.pmsMaterialRequirements,value})),...purchases.map(value=>({store:PMS_STORES.pmsMaterialPurchaseOrderDeltas,value})),...Array.from(products.values()).map(value=>({store:PMS_STORES.pmsProductPurchaseOrders,value})),...logs.map(value=>({store:PMS_STORES.pmsOperationLogs,value}))],{operationId,operationSignature:JSON.stringify(entries)})
 publishPmsMaterialRequirements(requirements);(await import('./material-purchase-orders.ts')).publishPmsMaterialPurchaseOrders(purchases);module.publishPmsProductPurchaseOrders(Array.from(products.values()));logs.forEach(publishPmsOperationLog)
}
export async function importPmsRequirementQuantities(entries:Array<{requirementNo:string;materialCode:string;quantity:number}>,operationId:string):Promise<void>{
 await hydratePmsMaterialRequirementsFromIdb();if(!entries.length||new Set(entries.map(row=>row.requirementNo+':'+row.materialCode)).size!==entries.length)throw new Error('文件不能为空，需求与SKU不能重复')
 const changed=new Map<string,PmsMaterialRequirement>();for(const entry of entries){const source=getPmsMaterialRequirement(entry.requirementNo);if(!source||source.rejectedReason)throw new Error('需求不存在或已驳回');const row=changed.get(entry.requirementNo)||structuredClone(source),line=row.lines.find(line=>line.materialCode===entry.materialCode);if(!line||line.pushStatus==='已下推'||!Number.isFinite(entry.quantity)||entry.quantity<0)throw new Error('仅未下推需求行可以设置非负实际采购数量');line.actualQty=roundPmsQty(entry.quantity,2);changed.set(row.requirementNo,row)}
 const logs=Array.from(changed.values()).map(row=>({...createPmsOperationLog({objectType:'material-requirement',objectId:row.requirementNo,action:'导入实际采购数量',beforeValue:'',afterValue:row.lines.map(line=>`${line.materialCode}: ${line.actualQty} ${line.unit}`).join('；'),reason:'',actorId:'USR-PMS-BUYER',actorName:'采购管理',actorRole:'采购员'}),id:`${operationId}:log:${row.requirementNo}`}))
 await pmsCommitRecords([...Array.from(changed.values()).map(value=>({store:PMS_STORES.pmsMaterialRequirements,value})),...logs.map(value=>({store:PMS_STORES.pmsOperationLogs,value}))],{operationId,operationSignature:JSON.stringify(entries)});publishPmsMaterialRequirements(Array.from(changed.values()));logs.forEach(publishPmsOperationLog)
}
