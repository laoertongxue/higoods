export type CuttingMaterialRole =
  | '面料A'
  | '面料B'
  | '面料C'
  | '里布'
  | '衬'
  | '罗纹'
  | '纽扣'
  | '未识别属性'

export type CuttingAbMaterialGapStatus = '有缺口' | '已送够' | '超送'
export type CuttingAbMaterialDetailStatus = '齐套' | '少裁' | '未裁' | '未识别属性'

export interface CuttingMaterialRoleInput {
  explicitRole?: string
  materialAlias?: string
  materialName?: string
  materialType?: string
  roleSequence?: number
}

export interface CuttingAbMaterialFilters {
  keyword?: string
  spuCode?: string
  productionOrderNo?: string
  color?: string
  role?: CuttingMaterialRole | '全部'
  gapStatus?: CuttingAbMaterialGapStatus | '全部'
  detailStatus?: CuttingAbMaterialDetailStatus | '全部'
  abnormalOnly?: boolean
  windowDays?: number
  page?: number
  pageSize?: number
}

export interface CuttingAbShipmentDemandRow {
  spuCode: string
  styleCode: string
  styleName: string
  spuImageUrl: string
  productionOrderNo: string
  color: string
  plannedShipDate: string
  shipmentQty: number
}

export interface CuttingAbSentFactoryRow {
  spuCode: string
  productionOrderNo: string
  color: string
  sentQty: number
  returnedQty: number
  sourceObjectNo: string
  receiverFactoryName: string
  latestHandoverAt: string
}

export interface CuttingAbCutPieceInventoryRow {
  spuCode: string
  warehouseName: string
  currentStockQty: number
  updatedAt: string
}

export interface CuttingAbMaterialSourceRow extends CuttingMaterialRoleInput {
  spuCode: string
  styleCode: string
  styleName: string
  spuImageUrl: string
  productionOrderNo: string
  color: string
  materialSku: string
  materialName: string
  materialImageUrl: string
  plannedQty: number
  actualCutQty: number | null
  latestCutAt: string
  cuttingTableName: string
  cutOrderNo: string
  spreadingOrderNo: string
  handoverOrderNo: string
}

export interface CuttingAbMaterialSummaryRow {
  rank: number
  spuCode: string
  styleCode: string
  styleName: string
  spuImageUrl: string
  shipmentQtyInWindow: number
  currentStockQty: number
  sentSewingFactoryNotReturnedQty: number
  cutCompletedNotSentSewingFactoryQty: number
  pendingCutPieceGapQty: number
  productionOrderCount: number
  colorCount: number
  abnormalRoleLineCount: number
  latestHandoverAt: string
  updatedAt: string
  status: CuttingAbMaterialGapStatus
}

export interface CuttingAbMaterialDetailRow {
  spuCode: string
  styleCode: string
  styleName: string
  spuImageUrl: string
  productionOrderNo: string
  color: string
  cuttingMaterialRole: CuttingMaterialRole
  materialSku: string
  materialName: string
  materialImageUrl: string
  techPackVersionNo: string
  patternName: string
  plannedQty: number
  actualCutQty: number | null
  groupMaxActualCutQty: number
  actualMinusGroupMaxQty: number
  status: CuttingAbMaterialDetailStatus
  latestCutAt: string
  cuttingTableName: string
  cutOrderNo: string
  spreadingOrderNo: string
  handoverOrderNo: string
  updatedAt: string
}

export interface CuttingAbMaterialReport {
  statDate: string
  windowDays: number
  lastUpdatedAt: string
  summaryRows: CuttingAbMaterialSummaryRow[]
  detailRows: CuttingAbMaterialDetailRow[]
  totals: {
    shipmentQtyInWindow: number
    currentStockQty: number
    sentSewingFactoryNotReturnedQty: number
    cutCompletedNotSentSewingFactoryQty: number
    pendingCutPieceGapQty: number
    gapSpuCount: number
    overSentSpuCount: number
    abnormalRoleLineCount: number
  }
  sourceLabels: {
    shipmentQtyInWindow: string
    currentStockQty: string
    sentSewingFactoryNotReturnedQty: string
    cutCompletedNotSentSewingFactoryQty: string
    actualCutQty: string
    cuttingMaterialRole: string
  }
}

const STAT_DATE = '2026-06-12'

const explicitRoleMap: Record<string, CuttingMaterialRole> = {
  面料A: '面料A',
  面料B: '面料B',
  面料C: '面料C',
  里布: '里布',
  衬: '衬',
  衬布: '衬',
  罗纹: '罗纹',
  螺纹: '罗纹',
  螺纹罗纹C: '罗纹',
  纽扣: '纽扣',
}

const aliasRoleRules: Array<{ keywords: string[]; role: CuttingMaterialRole }> = [
  { keywords: ['面料A', '主面料', '主身面料', '大身面料', 'main fabric'], role: '面料A' },
  { keywords: ['面料B', '拼接面料', '配色面料', '撞色面料', 'contrast fabric'], role: '面料B' },
  { keywords: ['面料C', '第三面料'], role: '面料C' },
  { keywords: ['里布', 'lining'], role: '里布' },
  { keywords: ['衬布', '衬', 'interlining'], role: '衬' },
  { keywords: ['罗纹', '螺纹', 'rib'], role: '罗纹' },
  { keywords: ['纽扣', 'button'], role: '纽扣' },
]

const fabricSequenceRoles: CuttingMaterialRole[] = ['面料A', '面料B', '面料C']

function includesKeyword(text: string, keyword: string): boolean {
  return text.toLowerCase().includes(keyword.toLowerCase())
}

export function resolveCuttingMaterialRole(input: CuttingMaterialRoleInput): CuttingMaterialRole {
  const explicit = String(input.explicitRole || '').trim()
  if (explicit && explicitRoleMap[explicit]) return explicitRoleMap[explicit]

  const mergedText = [
    input.explicitRole,
    input.materialAlias,
    input.materialName,
    input.materialType,
  ].filter(Boolean).join(' / ')
  const matchedRule = aliasRoleRules.find((rule) =>
    rule.keywords.some((keyword) => includesKeyword(mergedText, keyword)),
  )
  if (matchedRule) return matchedRule.role

  if (String(input.materialType || '').includes('面料') && input.roleSequence) {
    return fabricSequenceRoles[input.roleSequence - 1] || '未识别属性'
  }
  return '未识别属性'
}

const shipmentDemandRows: CuttingAbShipmentDemandRow[] = [
  { spuCode: 'CHCKL26040280', styleCode: 'CHCKL-0280', styleName: 'Light Utility Jacket', spuImageUrl: '/jacket-sample.jpg', productionOrderNo: 'PO13571', color: 'yellow', plannedShipDate: '2026-06-18', shipmentQty: 5000 },
  { spuCode: 'CHCKL26040280', styleCode: 'CHCKL-0280', styleName: 'Light Utility Jacket', spuImageUrl: '/jacket-sample.jpg', productionOrderNo: 'PO13679', color: 'yellow', plannedShipDate: '2026-06-20', shipmentQty: 618 },
  { spuCode: 'CHCKL26040280', styleCode: 'CHCKL-0280', styleName: 'Light Utility Jacket', spuImageUrl: '/jacket-sample.jpg', productionOrderNo: 'PO13694', color: 'blue', plannedShipDate: '2026-06-24', shipmentQty: 2386 },
  { spuCode: 'FADUU260327137', styleCode: 'FADUU-7137', styleName: 'Two Tone Utility Pants', spuImageUrl: '/pants-sample.jpg', productionOrderNo: 'PO13582', color: 'black', plannedShipDate: '2026-06-16', shipmentQty: 900 },
  { spuCode: 'FADUU260327137', styleCode: 'FADUU-7137', styleName: 'Two Tone Utility Pants', spuImageUrl: '/pants-sample.jpg', productionOrderNo: 'PO13630', color: 'black', plannedShipDate: '2026-06-19', shipmentQty: 600 },
  { spuCode: 'FADUU260327137', styleCode: 'FADUU-7137', styleName: 'Two Tone Utility Pants', spuImageUrl: '/pants-sample.jpg', productionOrderNo: 'PO13700', color: 'white', plannedShipDate: '2026-06-27', shipmentQty: 1216 },
  { spuCode: 'CHCZZ26042217', styleCode: 'CHCZZ-2217', styleName: 'Lined Work Shirt', spuImageUrl: '/shirt-sample.jpg', productionOrderNo: 'PO13705', color: 'white', plannedShipDate: '2026-06-17', shipmentQty: 3800 },
  { spuCode: 'CHCZZ26042217', styleCode: 'CHCZZ-2217', styleName: 'Lined Work Shirt', spuImageUrl: '/shirt-sample.jpg', productionOrderNo: 'PO13741', color: 'white', plannedShipDate: '2026-06-25', shipmentQty: 1838 },
  { spuCode: 'FADSS26042841', styleCode: 'FADSS-2841', styleName: 'Patchwork Dress', spuImageUrl: '/dress-sample-1.jpg', productionOrderNo: 'PO13802', color: 'green', plannedShipDate: '2026-06-23', shipmentQty: 4552 },
  { spuCode: 'CHCXX26040882', styleCode: 'CHCXX-0882', styleName: 'Compact Button Top', spuImageUrl: '/tshirt-sample.jpg', productionOrderNo: 'PO14069', color: 'ct', plannedShipDate: '2026-06-30', shipmentQty: 251 },
]

const sentFactoryRows: CuttingAbSentFactoryRow[] = [
  { spuCode: 'CHCZZ26042217', productionOrderNo: 'PO13741', color: 'white', sentQty: 600, returnedQty: 0, sourceObjectNo: 'HO-CUT-260611-017', receiverFactoryName: '车缝二组', latestHandoverAt: '2026-06-11 15:40' },
  { spuCode: 'FADSS26042841', productionOrderNo: 'PO13802', color: 'green', sentQty: 600, returnedQty: 0, sourceObjectNo: 'HO-CUT-260611-021', receiverFactoryName: '车缝三组', latestHandoverAt: '2026-06-11 16:20' },
  { spuCode: 'CHCXX26040882', productionOrderNo: 'PO14069', color: 'ct', sentQty: 486, returnedQty: 0, sourceObjectNo: 'HO-CUT-260611-034', receiverFactoryName: '车缝一组', latestHandoverAt: '2026-06-11 17:05' },
]

const cutPieceInventoryRows: CuttingAbCutPieceInventoryRow[] = [
  { spuCode: 'CHCKL26040280', warehouseName: '裁床成品暂存仓', currentStockQty: 1200, updatedAt: '2026-06-12 09:20' },
  { spuCode: 'FADUU260327137', warehouseName: '裁床成品暂存仓', currentStockQty: 320, updatedAt: '2026-06-12 09:20' },
  { spuCode: 'CHCZZ26042217', warehouseName: '裁床成品暂存仓', currentStockQty: 800, updatedAt: '2026-06-12 09:25' },
  { spuCode: 'FADSS26042841', warehouseName: '裁床成品暂存仓', currentStockQty: 400, updatedAt: '2026-06-12 09:25' },
  { spuCode: 'CHCXX26040882', warehouseName: '裁床成品暂存仓', currentStockQty: 120, updatedAt: '2026-06-12 09:30' },
]

const materialSourceRows: CuttingAbMaterialSourceRow[] = [
  { spuCode: 'CHCKL26040280', styleCode: 'CHCKL-0280', styleName: 'Light Utility Jacket', spuImageUrl: '/jacket-sample.jpg', productionOrderNo: 'PO13571', color: 'yellow', explicitRole: '面料A', materialAlias: '主面料', materialType: '面料', materialSku: 'CHCKL0280-FAB-A-YEL', materialName: '斜纹主面料 / Yellow / 150cm', materialImageUrl: '/materials/fabric-main.jpg', plannedQty: 5000, actualCutQty: null, latestCutAt: '', cuttingTableName: '裁床一号台', cutOrderNo: 'CUT-260611-13571-A', spreadingOrderNo: 'SP-260611-13571-A', handoverOrderNo: '' },
  { spuCode: 'CHCKL26040280', styleCode: 'CHCKL-0280', styleName: 'Light Utility Jacket', spuImageUrl: '/jacket-sample.jpg', productionOrderNo: 'PO13571', color: 'yellow', explicitRole: '面料B', materialAlias: '拼接面料', materialType: '面料', materialSku: 'CHCKL0280-FAB-B-YEL', materialName: '拼接面料 / Yellow / 150cm', materialImageUrl: '/materials/fabric-contrast.jpg', plannedQty: 5000, actualCutQty: null, latestCutAt: '', cuttingTableName: '裁床一号台', cutOrderNo: 'CUT-260611-13571-B', spreadingOrderNo: 'SP-260611-13571-B', handoverOrderNo: '' },
  { spuCode: 'CHCKL26040280', styleCode: 'CHCKL-0280', styleName: 'Light Utility Jacket', spuImageUrl: '/jacket-sample.jpg', productionOrderNo: 'PO13571', color: 'yellow', explicitRole: '里布', materialAlias: '里布', materialType: '面料', materialSku: 'CHCKL0280-LIN-YEL', materialName: '薄里布 / Yellow / 145cm', materialImageUrl: '/materials/fabric-lining.jpg', plannedQty: 5000, actualCutQty: null, latestCutAt: '', cuttingTableName: '裁床二号台', cutOrderNo: 'CUT-260611-13571-L', spreadingOrderNo: 'SP-260611-13571-L', handoverOrderNo: '' },
  { spuCode: 'CHCKL26040280', styleCode: 'CHCKL-0280', styleName: 'Light Utility Jacket', spuImageUrl: '/jacket-sample.jpg', productionOrderNo: 'PO13694', color: 'blue', explicitRole: '衬', materialAlias: '衬布', materialType: '面料', materialSku: 'CHCKL0280-INT-BLU', materialName: 'Blue 轻薄衬布 / 140cm', materialImageUrl: '/materials/fabric-lining.jpg', plannedQty: 767, actualCutQty: null, latestCutAt: '', cuttingTableName: '裁床二号台', cutOrderNo: 'CUT-260611-13694-INT', spreadingOrderNo: 'SP-260611-13694-INT', handoverOrderNo: '' },
  { spuCode: 'FADUU260327137', styleCode: 'FADUU-7137', styleName: 'Two Tone Utility Pants', spuImageUrl: '/pants-sample.jpg', productionOrderNo: 'PO13630', color: 'black', explicitRole: '面料A', materialAlias: '主面料', materialType: '面料', materialSku: 'FADUU7137-FAB-A-BLK', materialName: 'Black 主面料 / 150cm', materialImageUrl: '/materials/fabric-main.jpg', plannedQty: 508, actualCutQty: 510, latestCutAt: '2026-06-11 10:20', cuttingTableName: '裁床三号台', cutOrderNo: 'CUT-260611-13630-A', spreadingOrderNo: 'SP-260611-13630-A', handoverOrderNo: '' },
  { spuCode: 'FADUU260327137', styleCode: 'FADUU-7137', styleName: 'Two Tone Utility Pants', spuImageUrl: '/pants-sample.jpg', productionOrderNo: 'PO13630', color: 'black', explicitRole: '面料B', materialAlias: '撞色面料', materialType: '面料', materialSku: 'FADUU7137-FAB-B-BLK', materialName: 'Black 撞色面料 / 150cm', materialImageUrl: '/materials/fabric-contrast.jpg', plannedQty: 508, actualCutQty: 520, latestCutAt: '2026-06-11 10:40', cuttingTableName: '裁床三号台', cutOrderNo: 'CUT-260611-13630-B', spreadingOrderNo: 'SP-260611-13630-B', handoverOrderNo: '' },
  { spuCode: 'FADUU260327137', styleCode: 'FADUU-7137', styleName: 'Two Tone Utility Pants', spuImageUrl: '/pants-sample.jpg', productionOrderNo: 'PO13700', color: 'white', explicitRole: '面料A', materialAlias: '主面料', materialType: '面料', materialSku: 'FADUU7137-FAB-A-WHT', materialName: 'White 主面料 / 150cm', materialImageUrl: '/materials/fabric-main.jpg', plannedQty: 215, actualCutQty: 232, latestCutAt: '2026-06-11 11:20', cuttingTableName: '裁床二号台', cutOrderNo: 'CUT-260611-13700-A', spreadingOrderNo: 'SP-260611-13700-A', handoverOrderNo: '' },
  { spuCode: 'FADUU260327137', styleCode: 'FADUU-7137', styleName: 'Two Tone Utility Pants', spuImageUrl: '/pants-sample.jpg', productionOrderNo: 'PO13700', color: 'white', explicitRole: '面料B', materialAlias: '撞色面料', materialType: '面料', materialSku: 'FADUU7137-FAB-B-WHT', materialName: 'White 撞色面料 / 150cm', materialImageUrl: '/materials/fabric-contrast.jpg', plannedQty: 215, actualCutQty: 168, latestCutAt: '2026-06-11 11:35', cuttingTableName: '裁床二号台', cutOrderNo: 'CUT-260611-13700-B', spreadingOrderNo: 'SP-260611-13700-B', handoverOrderNo: '' },
  { spuCode: 'CHCZZ26042217', styleCode: 'CHCZZ-2217', styleName: 'Lined Work Shirt', spuImageUrl: '/shirt-sample.jpg', productionOrderNo: 'PO13741', color: 'white', explicitRole: '面料A', materialAlias: '主面料', materialType: '面料', materialSku: 'CHCZZ2217-FAB-A-WHT', materialName: 'White 衬衫主面料 / 150cm', materialImageUrl: '/materials/fabric-main.jpg', plannedQty: 1200, actualCutQty: 1210, latestCutAt: '2026-06-11 13:10', cuttingTableName: '裁床四号台', cutOrderNo: 'CUT-260611-13741-A', spreadingOrderNo: 'SP-260611-13741-A', handoverOrderNo: 'HO-CUT-260611-017' },
  { spuCode: 'CHCZZ26042217', styleCode: 'CHCZZ-2217', styleName: 'Lined Work Shirt', spuImageUrl: '/shirt-sample.jpg', productionOrderNo: 'PO13741', color: 'white', explicitRole: '里布', materialAlias: '里布', materialType: '面料', materialSku: 'CHCZZ2217-LIN-WHT', materialName: 'White 里布 / 145cm', materialImageUrl: '/materials/fabric-lining.jpg', plannedQty: 600, actualCutQty: 605, latestCutAt: '2026-06-11 13:25', cuttingTableName: '裁床四号台', cutOrderNo: 'CUT-260611-13741-L', spreadingOrderNo: 'SP-260611-13741-L', handoverOrderNo: 'HO-CUT-260611-017' },
  { spuCode: 'FADSS26042841', styleCode: 'FADSS-2841', styleName: 'Patchwork Dress', spuImageUrl: '/dress-sample-1.jpg', productionOrderNo: 'PO13802', color: 'green', explicitRole: '面料A', materialAlias: '主面料', materialType: '面料', materialSku: 'FADSS2841-FAB-A-GRN', materialName: 'Green 主面料 / 150cm', materialImageUrl: '/materials/fabric-main.jpg', plannedQty: 1520, actualCutQty: 1520, latestCutAt: '2026-06-10 16:10', cuttingTableName: '裁床五号台', cutOrderNo: 'CUT-260610-13802-A', spreadingOrderNo: 'SP-260610-13802-A', handoverOrderNo: 'HO-CUT-260611-021' },
  { spuCode: 'FADSS26042841', styleCode: 'FADSS-2841', styleName: 'Patchwork Dress', spuImageUrl: '/dress-sample-1.jpg', productionOrderNo: 'PO13802', color: 'green', explicitRole: '面料B', materialAlias: '拼接面料', materialType: '面料', materialSku: 'FADSS2841-FAB-B-GRN', materialName: 'Green 拼接面料 / 150cm', materialImageUrl: '/materials/fabric-contrast.jpg', plannedQty: 1520, actualCutQty: 1490, latestCutAt: '2026-06-10 16:40', cuttingTableName: '裁床五号台', cutOrderNo: 'CUT-260610-13802-B', spreadingOrderNo: 'SP-260610-13802-B', handoverOrderNo: 'HO-CUT-260611-021' },
  { spuCode: 'FADSS26042841', styleCode: 'FADSS-2841', styleName: 'Patchwork Dress', spuImageUrl: '/dress-sample-1.jpg', productionOrderNo: 'PO13802', color: 'green', explicitRole: '面料C', materialAlias: '第三面料', materialType: '面料', materialSku: 'FADSS2841-FAB-C-GRN', materialName: 'Green 第三拼接面料 / 150cm', materialImageUrl: '/materials/fabric-contrast.jpg', plannedQty: 1512, actualCutQty: 1520, latestCutAt: '2026-06-10 17:10', cuttingTableName: '裁床五号台', cutOrderNo: 'CUT-260610-13802-C', spreadingOrderNo: 'SP-260610-13802-C', handoverOrderNo: 'HO-CUT-260611-021' },
  { spuCode: 'CHCXX26040882', styleCode: 'CHCXX-0882', styleName: 'Compact Button Top', spuImageUrl: '/tshirt-sample.jpg', productionOrderNo: 'PO14069', color: 'ct', explicitRole: '面料A', materialAlias: '主面料', materialType: '面料', materialSku: 'CHCXX0882-FAB-A-CT', materialName: 'CT 主面料 / 150cm', materialImageUrl: '/materials/fabric-main.jpg', plannedQty: 542, actualCutQty: 573, latestCutAt: '2026-06-11 09:10', cuttingTableName: '裁床一号台', cutOrderNo: 'CUT-260611-14069-A', spreadingOrderNo: 'SP-260611-14069-A', handoverOrderNo: 'HO-CUT-260611-034' },
  { spuCode: 'CHCXX26040882', styleCode: 'CHCXX-0882', styleName: 'Compact Button Top', spuImageUrl: '/tshirt-sample.jpg', productionOrderNo: 'PO14069', color: 'ct', explicitRole: '面料B', materialAlias: '拼接面料', materialType: '面料', materialSku: 'CHCXX0882-FAB-B-CT', materialName: 'CT 拼接面料 / 150cm', materialImageUrl: '/materials/fabric-contrast.jpg', plannedQty: 542, actualCutQty: 532, latestCutAt: '2026-06-11 09:25', cuttingTableName: '裁床一号台', cutOrderNo: 'CUT-260611-14069-B', spreadingOrderNo: 'SP-260611-14069-B', handoverOrderNo: 'HO-CUT-260611-034' },
  { spuCode: 'CHCXX26040882', styleCode: 'CHCXX-0882', styleName: 'Compact Button Top', spuImageUrl: '/tshirt-sample.jpg', productionOrderNo: 'PO14069', color: 'ct', explicitRole: '罗纹', materialAlias: '罗纹', materialType: '面料', materialSku: 'CHCXX0882-RIB-CT', materialName: 'CT 罗纹 / 1x1 rib', materialImageUrl: '/materials/yarn-stitching.jpg', plannedQty: 58, actualCutQty: 520, latestCutAt: '2026-06-11 09:40', cuttingTableName: '裁床一号台', cutOrderNo: 'CUT-260611-14069-RIB', spreadingOrderNo: 'SP-260611-14069-RIB', handoverOrderNo: 'HO-CUT-260611-034' },
  { spuCode: 'CHCXX26040882', styleCode: 'CHCXX-0882', styleName: 'Compact Button Top', spuImageUrl: '/tshirt-sample.jpg', productionOrderNo: 'PO14069', color: 'ct', explicitRole: '纽扣', materialAlias: '纽扣', materialType: '辅料', materialSku: 'CHCXX0882-BTN-CT', materialName: 'CT 纽扣 / 18L', materialImageUrl: '/materials/accessory-button.jpg', plannedQty: 58, actualCutQty: null, latestCutAt: '', cuttingTableName: '辅料核对台', cutOrderNo: 'CUT-260611-14069-BTN', spreadingOrderNo: '', handoverOrderNo: 'HO-CUT-260611-034' },
  { spuCode: 'CHCXX26040882', styleCode: 'CHCXX-0882', styleName: 'Compact Button Top', spuImageUrl: '/tshirt-sample.jpg', productionOrderNo: 'PO14069', color: 'ct', explicitRole: '', materialAlias: '旧版BOM未维护用途', materialType: '面料', roleSequence: 4, materialSku: 'CHCXX0882-WEISHIBIE-CT', materialName: '旧版未识别裁剪物料 / CT', materialImageUrl: '/materials/fabric-main.jpg', plannedQty: 20, actualCutQty: 0, latestCutAt: '', cuttingTableName: '待维护', cutOrderNo: 'CUT-260611-14069-WEISHIBIE', spreadingOrderNo: '', handoverOrderNo: '' },
]

function sum(values: number[]): number {
  return values.reduce((total, value) => total + Number(value || 0), 0)
}

function uniqueCount(values: string[]): number {
  return new Set(values.filter(Boolean)).size
}

function latestText(values: string[]): string {
  return values.filter(Boolean).sort((left, right) => right.localeCompare(left, 'zh-CN'))[0] || ''
}

function getGroupKey(row: Pick<CuttingAbMaterialSourceRow, 'spuCode' | 'productionOrderNo' | 'color'>): string {
  return [row.spuCode, row.productionOrderNo, row.color].join('::')
}

const techPackVersionBySpu: Record<string, string> = {
  CHCKL26040280: 'TP-CHCKL0280-V3.2',
  FADUU260327137: 'TP-FADUU7137-V2.4',
  CHCZZ26042217: 'TP-CHCZZ2217-V1.8',
  FADSS26042841: 'TP-FADSS2841-V2.1',
  CHCXX26040882: 'TP-CHCXX0882-V1.5',
}

const patternNameByRole: Record<CuttingMaterialRole, string> = {
  面料A: '主身纸样',
  面料B: '拼接纸样',
  面料C: '第三拼接纸样',
  里布: '里布纸样',
  衬: '衬布纸样',
  罗纹: '罗纹纸样',
  纽扣: '辅料定位纸样',
  未识别属性: '待维护纸样',
}

export function listCuttingAbMaterialDetailRows(): CuttingAbMaterialDetailRow[] {
  const groupMaxMap = new Map<string, number>()
  materialSourceRows.forEach((row) => {
    const actual = Number(row.actualCutQty || 0)
    const key = getGroupKey(row)
    groupMaxMap.set(key, Math.max(groupMaxMap.get(key) || 0, actual))
  })

  return materialSourceRows.map((row) => {
    const groupMaxActualCutQty = groupMaxMap.get(getGroupKey(row)) || 0
    const actualValue = Number(row.actualCutQty || 0)
    const actualMinusGroupMaxQty = groupMaxActualCutQty > 0 ? actualValue - groupMaxActualCutQty : 0
    const cuttingMaterialRole = resolveCuttingMaterialRole(row)
    const status: CuttingAbMaterialDetailStatus =
      cuttingMaterialRole === '未识别属性'
        ? '未识别属性'
        : row.actualCutQty === null || actualValue <= 0
          ? '未裁'
          : actualMinusGroupMaxQty < 0
            ? '少裁'
            : '齐套'

    return {
      spuCode: row.spuCode,
      styleCode: row.styleCode,
      styleName: row.styleName,
      spuImageUrl: row.spuImageUrl,
      productionOrderNo: row.productionOrderNo,
      color: row.color,
      cuttingMaterialRole,
      materialSku: row.materialSku,
      materialName: row.materialName,
      materialImageUrl: row.materialImageUrl,
      techPackVersionNo: techPackVersionBySpu[row.spuCode] || '待关联技术包版本',
      patternName: patternNameByRole[cuttingMaterialRole],
      plannedQty: row.plannedQty,
      actualCutQty: row.actualCutQty,
      groupMaxActualCutQty,
      actualMinusGroupMaxQty,
      status,
      latestCutAt: row.latestCutAt,
      cuttingTableName: row.cuttingTableName,
      cutOrderNo: row.cutOrderNo,
      spreadingOrderNo: row.spreadingOrderNo,
      handoverOrderNo: row.handoverOrderNo,
      updatedAt: latestText([row.latestCutAt]) || '2026-06-12 09:30',
    }
  })
}

function getSentSewingFactoryNotReturnedQty(rows: CuttingAbSentFactoryRow[]): number {
  return sum(rows.map((row) => Math.max(0, row.sentQty - row.returnedQty)))
}

function getCutCompletedNotSentSewingFactoryQty(
  demandRows: CuttingAbShipmentDemandRow[],
  detailRows: CuttingAbMaterialDetailRow[],
  sentRows: CuttingAbSentFactoryRow[],
): number {
  return sum(demandRows.map((demand) => {
    const matchedDetailRows = detailRows.filter((row) =>
      row.spuCode === demand.spuCode &&
      row.productionOrderNo === demand.productionOrderNo &&
      row.color === demand.color,
    )
    const cutCompletedQty = Math.max(...matchedDetailRows.map((row) => Number(row.actualCutQty || 0)), 0)
    if (cutCompletedQty <= 0) return 0
    const sentQty = sum(sentRows
      .filter((row) =>
        row.spuCode === demand.spuCode &&
        row.productionOrderNo === demand.productionOrderNo &&
        row.color === demand.color,
      )
      .map((row) => row.sentQty))
    return Math.max(0, cutCompletedQty - sentQty)
  }))
}

export function listCuttingAbMaterialSummaryRows(): CuttingAbMaterialSummaryRow[] {
  const details = listCuttingAbMaterialDetailRows()
  const rowsBySpu = new Map<string, CuttingAbMaterialSummaryRow>()
  shipmentDemandRows.forEach((demand) => {
    const spuDemandRows = shipmentDemandRows.filter((item) => item.spuCode === demand.spuCode)
    const sentRows = sentFactoryRows.filter((item) => item.spuCode === demand.spuCode)
    const detailRows = details.filter((item) => item.spuCode === demand.spuCode)
    const inventoryRows = cutPieceInventoryRows.filter((item) => item.spuCode === demand.spuCode)
    const current = rowsBySpu.get(demand.spuCode) || {
      rank: 0,
      spuCode: demand.spuCode,
      styleCode: demand.styleCode,
      styleName: demand.styleName,
      spuImageUrl: demand.spuImageUrl,
      shipmentQtyInWindow: 0,
      currentStockQty: sum(inventoryRows.map((item) => item.currentStockQty)),
      sentSewingFactoryNotReturnedQty: getSentSewingFactoryNotReturnedQty(sentRows),
      cutCompletedNotSentSewingFactoryQty: getCutCompletedNotSentSewingFactoryQty(spuDemandRows, detailRows, sentRows),
      pendingCutPieceGapQty: 0,
      productionOrderCount: 0,
      colorCount: 0,
      abnormalRoleLineCount: detailRows.filter((item) => item.actualMinusGroupMaxQty < 0).length,
      latestHandoverAt: latestText(sentRows.map((item) => item.latestHandoverAt)),
      updatedAt: latestText([
        ...inventoryRows.map((item) => item.updatedAt),
        ...sentRows.map((item) => item.latestHandoverAt),
        ...detailRows.map((item) => item.updatedAt),
      ]) || '2026-06-12 09:30',
      status: '已送够' as CuttingAbMaterialGapStatus,
    }
    current.shipmentQtyInWindow += demand.shipmentQty
    current.productionOrderCount = uniqueCount(shipmentDemandRows.filter((item) => item.spuCode === demand.spuCode).map((item) => item.productionOrderNo))
    current.colorCount = uniqueCount(shipmentDemandRows.filter((item) => item.spuCode === demand.spuCode).map((item) => item.color))
    rowsBySpu.set(demand.spuCode, current)
  })

  return Array.from(rowsBySpu.values())
    .map((row) => {
      const pendingCutPieceGapQty =
        row.shipmentQtyInWindow -
        row.currentStockQty -
        row.sentSewingFactoryNotReturnedQty -
        row.cutCompletedNotSentSewingFactoryQty
      const status: CuttingAbMaterialGapStatus =
        pendingCutPieceGapQty > 0 ? '有缺口' : pendingCutPieceGapQty < 0 ? '超送' : '已送够'
      return { ...row, pendingCutPieceGapQty, status }
    })
    .sort((left, right) => right.pendingCutPieceGapQty - left.pendingCutPieceGapQty)
    .map((row, index) => ({ ...row, rank: index + 1 }))
}

function matchesText(value: string, keyword: string): boolean {
  if (!keyword) return true
  return value.toLowerCase().includes(keyword.toLowerCase())
}

function normalizeFilters(filters: CuttingAbMaterialFilters = {}): Required<CuttingAbMaterialFilters> {
  return {
    keyword: filters.keyword || '',
    spuCode: filters.spuCode || '',
    productionOrderNo: filters.productionOrderNo || '',
    color: filters.color || '',
    role: filters.role || '全部',
    gapStatus: filters.gapStatus || '全部',
    detailStatus: filters.detailStatus || '全部',
    abnormalOnly: Boolean(filters.abnormalOnly),
    windowDays: Number(filters.windowDays || 20),
    page: Math.max(1, Number(filters.page || 1)),
    pageSize: Math.max(1, Number(filters.pageSize || 10)),
  }
}

export function buildCuttingAbMaterialReport(filters: CuttingAbMaterialFilters = {}): CuttingAbMaterialReport {
  const normalized = normalizeFilters(filters)
  const filteredDetailRows = listCuttingAbMaterialDetailRows().filter((row) => {
    const keywordText = [row.spuCode, row.styleCode, row.styleName, row.productionOrderNo, row.color, row.cuttingMaterialRole, row.materialSku, row.materialName].join(' / ')
    if (!matchesText(keywordText, normalized.keyword)) return false
    if (normalized.spuCode && row.spuCode !== normalized.spuCode) return false
    if (normalized.productionOrderNo && row.productionOrderNo !== normalized.productionOrderNo) return false
    if (normalized.color && row.color !== normalized.color) return false
    if (normalized.role !== '全部' && row.cuttingMaterialRole !== normalized.role) return false
    if (normalized.detailStatus !== '全部' && row.status !== normalized.detailStatus) return false
    if (normalized.abnormalOnly && row.actualMinusGroupMaxQty >= 0 && row.status !== '未识别属性') return false
    return true
  })
  const detailSpuSet = new Set(filteredDetailRows.map((row) => row.spuCode))
  const hasDetailLinkedFilter = Boolean(
    normalized.keyword ||
    normalized.spuCode ||
    normalized.productionOrderNo ||
    normalized.color ||
    normalized.role !== '全部' ||
    normalized.detailStatus !== '全部' ||
    normalized.abnormalOnly,
  )
  const summaryRows = listCuttingAbMaterialSummaryRows().filter((row) => {
    const keywordText = [row.spuCode, row.styleCode, row.styleName].join(' / ')
    if (!matchesText(keywordText, normalized.keyword)) return false
    if (normalized.spuCode && row.spuCode !== normalized.spuCode) return false
    if (normalized.gapStatus !== '全部' && row.status !== normalized.gapStatus) return false
    if (normalized.abnormalOnly && row.abnormalRoleLineCount <= 0) return false
    if (hasDetailLinkedFilter && !detailSpuSet.has(row.spuCode)) return false
    return true
  })
  const lastUpdatedAt = latestText([
    ...summaryRows.map((row) => row.updatedAt),
    ...filteredDetailRows.map((row) => row.updatedAt),
  ]) || '2026-06-12 09:30'

  return {
    statDate: STAT_DATE,
    windowDays: normalized.windowDays,
    lastUpdatedAt,
    summaryRows,
    detailRows: filteredDetailRows,
    totals: {
      shipmentQtyInWindow: sum(summaryRows.map((row) => row.shipmentQtyInWindow)),
      currentStockQty: sum(summaryRows.map((row) => row.currentStockQty)),
      sentSewingFactoryNotReturnedQty: sum(summaryRows.map((row) => row.sentSewingFactoryNotReturnedQty)),
      cutCompletedNotSentSewingFactoryQty: sum(summaryRows.map((row) => row.cutCompletedNotSentSewingFactoryQty)),
      pendingCutPieceGapQty: sum(summaryRows.map((row) => row.pendingCutPieceGapQty)),
      gapSpuCount: summaryRows.filter((row) => row.status === '有缺口').length,
      overSentSpuCount: summaryRows.filter((row) => row.status === '超送').length,
      abnormalRoleLineCount: sum(summaryRows.map((row) => row.abnormalRoleLineCount)),
    },
    sourceLabels: {
      shipmentQtyInWindow: '生产单计划发货日期落入统计窗口的需发货数量',
      currentStockQty: '裁床成品暂存仓 / 成衣库存可用于覆盖20天内发货的当前库存数量',
      sentSewingFactoryNotReturnedQty: '裁床交出单 / 中转袋已送车缝厂，且车缝厂尚未回货的数量',
      cutCompletedNotSentSewingFactoryQty: '铺布 / 裁剪 / PDA裁剪完成，但尚未生成交出单送车缝厂的数量',
      actualCutQty: '铺布 / 裁剪 / PDA 裁剪回写数量',
      cuttingMaterialRole: '技术包BOM / 裁片单 / 唛架物料用途识别出的裁剪物料角色',
    },
  }
}

export const cuttingMaterialRoleOptions: Array<CuttingMaterialRole | '全部'> = [
  '全部',
  '面料A',
  '面料B',
  '面料C',
  '里布',
  '衬',
  '罗纹',
  '纽扣',
  '未识别属性',
]

export const cuttingGapStatusOptions: Array<CuttingAbMaterialGapStatus | '全部'> = ['全部', '有缺口', '已送够', '超送']
export const cuttingDetailStatusOptions: Array<CuttingAbMaterialDetailStatus | '全部'> = ['全部', '齐套', '少裁', '未裁', '未识别属性']
