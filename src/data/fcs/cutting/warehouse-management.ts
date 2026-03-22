import type { CuttingMaterialType } from './types'

export type CuttingFabricStockStatus = 'READY' | 'PARTIAL_USED' | 'NEED_RECHECK'
export type CutPieceZoneCode = 'A' | 'B' | 'C' | 'UNASSIGNED'
export type CutPieceInboundStatus = 'PENDING_INBOUND' | 'INBOUNDED' | 'WAITING_HANDOVER' | 'HANDED_OVER'
export type CutPieceHandoverStatus = 'WAITING_HANDOVER' | 'HANDED_OVER'
export type SampleLocationStage = 'DESIGN_CENTER' | 'CUTTING' | 'PMC_WAREHOUSE' | 'FACTORY_CHECK' | 'RETURN_CHECK' | 'BACK_TO_PMC'
export type SampleWarehouseStatus = 'IN_USE' | 'WAITING_RETURN' | 'AVAILABLE' | 'CHECKING'
export type WarehouseAlertType = 'SPACE_RISK' | 'UNASSIGNED_ZONE' | 'SAMPLE_OVERDUE' | 'STOCK_RECHECK'
export type WarehouseAlertLevel = 'HIGH' | 'MEDIUM' | 'LOW'

export interface CuttingFabricStockRecord {
  id: string
  warehouseType: 'CUTTING_FABRIC'
  productionOrderNo: string
  cutPieceOrderNo: string
  materialSku: string
  materialType: CuttingMaterialType
  materialLabel: string
  configuredRollCount: number
  configuredLength: number
  usedRollCount: number
  usedLength: number
  remainingRollCount: number
  remainingLength: number
  latestConfigAt: string
  latestReceiveAt: string
  latestActionText: string
  stockStatus: CuttingFabricStockStatus
  note: string
}

export interface CutPieceWarehouseRecord {
  id: string
  warehouseType: 'CUT_PIECE'
  productionOrderNo: string
  cutPieceOrderNo: string
  materialSku: string
  groupNo: string
  zoneCode: CutPieceZoneCode
  locationLabel: string
  inboundStatus: CutPieceInboundStatus
  inboundAt: string
  inboundBy: string
  pieceSummary: string
  handoverStatus: CutPieceHandoverStatus
  handoverTarget: string
  note: string
}

export interface SampleFlowHistoryItem {
  stage: SampleLocationStage
  actionText: string
  operatedBy: string
  operatedAt: string
  note: string
}

export interface SampleWarehouseRecord {
  id: string
  warehouseType: 'SAMPLE'
  sampleNo: string
  sampleName: string
  relatedProductionOrderNo: string
  relatedCutPieceOrderNo: string
  currentLocationStage: SampleLocationStage
  currentHolder: string
  currentStatus: SampleWarehouseStatus
  latestActionAt: string
  latestActionBy: string
  nextSuggestedAction: string
  flowHistory: SampleFlowHistoryItem[]
}

export interface WarehouseAlertRecord {
  id: string
  warehouseAlertType: WarehouseAlertType
  level: WarehouseAlertLevel
  title: string
  description: string
  relatedNo: string
  suggestedAction: string
}

export interface WarehouseManagementFilters {
  cuttingFabric: {
    keyword: string
    materialType: 'ALL' | CuttingMaterialType
    stockStatus: 'ALL' | CuttingFabricStockStatus
  }
  cutPiece: {
    keyword: string
    zoneCode: 'ALL' | CutPieceZoneCode
    inboundStatus: 'ALL' | CutPieceInboundStatus
    handoverStatus: 'ALL' | CutPieceHandoverStatus
  }
  sample: {
    keyword: string
    stage: 'ALL' | SampleLocationStage
    status: 'ALL' | SampleWarehouseStatus
  }
}

export const cuttingFabricStockRecords: CuttingFabricStockRecord[] = [
  {
    id: 'cf-001',
    warehouseType: 'CUTTING_FABRIC',
    productionOrderNo: 'PO-202603-018',
    cutPieceOrderNo: 'CP-202603-018-01',
    materialSku: 'ML-PRINT-240311-01',
    materialType: 'PRINT',
    materialLabel: '印花面料 · 玫瑰满印布',
    configuredRollCount: 12,
    configuredLength: 650,
    usedRollCount: 8,
    usedLength: 430,
    remainingRollCount: 4,
    remainingLength: 220,
    latestConfigAt: '2026-03-20 08:45',
    latestReceiveAt: '2026-03-20 14:12',
    latestActionText: '现场少领 2 卷，当前剩余卷数待核对。',
    stockStatus: 'NEED_RECHECK',
    note: '待仓库与裁床组复核剩余印花布料。',
  },
  {
    id: 'cf-002',
    warehouseType: 'CUTTING_FABRIC',
    productionOrderNo: 'PO-202603-018',
    cutPieceOrderNo: 'CP-202603-018-02',
    materialSku: 'ML-SOLID-240311-03',
    materialType: 'SOLID',
    materialLabel: '净色面料 · 象牙白全棉布',
    configuredRollCount: 6,
    configuredLength: 320,
    usedRollCount: 0,
    usedLength: 0,
    remainingRollCount: 6,
    remainingLength: 320,
    latestConfigAt: '2026-03-21 10:15',
    latestReceiveAt: '',
    latestActionText: '已完成净色面料入裁床仓，等待裁床开始领取。',
    stockStatus: 'READY',
    note: '当前待裁床组按唛架顺序领取。',
  },
  {
    id: 'cf-003',
    warehouseType: 'CUTTING_FABRIC',
    productionOrderNo: 'PO-202603-024',
    cutPieceOrderNo: 'CP-202603-024-01',
    materialSku: 'ML-DYE-240320-11',
    materialType: 'DYE',
    materialLabel: '染色面料 · 深海蓝斜纹布',
    configuredRollCount: 12,
    configuredLength: 640,
    usedRollCount: 12,
    usedLength: 640,
    remainingRollCount: 0,
    remainingLength: 0,
    latestConfigAt: '2026-03-21 14:40',
    latestReceiveAt: '2026-03-21 18:10',
    latestActionText: '整单领料已完成，余料已回收到裁床仓末位区。',
    stockStatus: 'PARTIAL_USED',
    note: '可在裁片仓入仓后转入总结统计。',
  },
  {
    id: 'cf-004',
    warehouseType: 'CUTTING_FABRIC',
    productionOrderNo: 'PO-202603-031',
    cutPieceOrderNo: 'CP-202603-031-01',
    materialSku: 'ML-PRINT-240327-08',
    materialType: 'PRINT',
    materialLabel: '印花面料 · 复古花叶提花',
    configuredRollCount: 5,
    configuredLength: 290,
    usedRollCount: 4,
    usedLength: 238,
    remainingRollCount: 1,
    remainingLength: 52,
    latestConfigAt: '2026-03-22 08:40',
    latestReceiveAt: '2026-03-22 11:18',
    latestActionText: '补料建议已通过，剩余 1 卷待决定是否继续保留。',
    stockStatus: 'PARTIAL_USED',
    note: '该余料与补料建议关联，待运营确认。',
  },
  {
    id: 'cf-005',
    warehouseType: 'CUTTING_FABRIC',
    productionOrderNo: 'PO-202603-031',
    cutPieceOrderNo: 'CP-202603-031-02',
    materialSku: 'ML-SOLID-240327-21',
    materialType: 'SOLID',
    materialLabel: '净色面料 · 水洗白府绸',
    configuredRollCount: 7,
    configuredLength: 360,
    usedRollCount: 7,
    usedLength: 360,
    remainingRollCount: 0,
    remainingLength: 0,
    latestConfigAt: '2026-03-22 09:00',
    latestReceiveAt: '2026-03-22 13:10',
    latestActionText: '净色面料已完成使用，当前库存无待核对项。',
    stockStatus: 'READY',
    note: '该单已入裁片仓，后续以裁片仓状态为主。',
  },
]

export const cutPieceWarehouseRecords: CutPieceWarehouseRecord[] = [
  {
    id: 'cpw-001',
    warehouseType: 'CUT_PIECE',
    productionOrderNo: 'PO-202603-018',
    cutPieceOrderNo: 'CP-202603-018-01',
    materialSku: 'ML-PRINT-240311-01',
    groupNo: 'G-印花主片-01',
    zoneCode: 'UNASSIGNED',
    locationLabel: '待分区',
    inboundStatus: 'PENDING_INBOUND',
    inboundAt: '',
    inboundBy: '',
    pieceSummary: '印花主片 124 件，待整理后入仓。',
    handoverStatus: 'WAITING_HANDOVER',
    handoverTarget: '待后道整烫',
    note: '当前优先提示分到 A 区主片位，便于后续快速查找。',
  },
  {
    id: 'cpw-002',
    warehouseType: 'CUT_PIECE',
    productionOrderNo: 'PO-202603-024',
    cutPieceOrderNo: 'CP-202603-024-01',
    materialSku: 'ML-DYE-240320-11',
    groupNo: 'G-染色主片-02',
    zoneCode: 'B',
    locationLabel: 'B 区 2 组',
    inboundStatus: 'INBOUNDED',
    inboundAt: '2026-03-22 11:05',
    inboundBy: '库管 梁慧敏',
    pieceSummary: '染色主片 84 件，已整组入裁片仓。',
    handoverStatus: 'WAITING_HANDOVER',
    handoverTarget: '待后道整烫',
    note: '建议维持 B 区 2 组，避免与印花类混放。',
  },
  {
    id: 'cpw-003',
    warehouseType: 'CUT_PIECE',
    productionOrderNo: 'PO-202603-031',
    cutPieceOrderNo: 'CP-202603-031-02',
    materialSku: 'ML-SOLID-240327-21',
    groupNo: 'G-净色前后片-03',
    zoneCode: 'A',
    locationLabel: 'A 区 3 组',
    inboundStatus: 'WAITING_HANDOVER',
    inboundAt: '2026-03-22 15:20',
    inboundBy: '库管 徐燕萍',
    pieceSummary: '净色前后片 70 件，已完成入仓待发后道。',
    handoverStatus: 'WAITING_HANDOVER',
    handoverTarget: '待后道缝制',
    note: '当前在 A 区主通道侧，后道领取方便。',
  },
  {
    id: 'cpw-004',
    warehouseType: 'CUT_PIECE',
    productionOrderNo: 'PO-202603-027',
    cutPieceOrderNo: 'CP-202603-027-01',
    materialSku: 'ML-LIN-240324-03',
    groupNo: 'G-里布侧片-01',
    zoneCode: 'C',
    locationLabel: 'C 区 1 组',
    inboundStatus: 'HANDED_OVER',
    inboundAt: '2026-03-21 16:40',
    inboundBy: '库管 梁慧敏',
    pieceSummary: '里布侧片 56 件，已从裁片仓交接至后道。',
    handoverStatus: 'HANDED_OVER',
    handoverTarget: '已交接后道缝制',
    note: '此单作为已交接样本保留。',
  },
]

export const sampleWarehouseRecords: SampleWarehouseRecord[] = [
  {
    id: 'sw-001',
    warehouseType: 'SAMPLE',
    sampleNo: 'SMP-202603-018',
    sampleName: '玫瑰满印连衣裙样衣',
    relatedProductionOrderNo: 'PO-202603-018',
    relatedCutPieceOrderNo: 'CP-202603-018-01',
    currentLocationStage: 'CUTTING',
    currentHolder: '裁床组 黄秀娟',
    currentStatus: 'IN_USE',
    latestActionAt: '2026-03-22 09:05',
    latestActionBy: '样衣管理员 陈如意',
    nextSuggestedAction: '裁床参考结束后归还 PMC 仓库。',
    flowHistory: [
      { stage: 'DESIGN_CENTER', actionText: '设计中心完成样衣制作', operatedBy: '设计师 林若彤', operatedAt: '2026-03-10 11:20', note: '首版样衣完成。' },
      { stage: 'PMC_WAREHOUSE', actionText: '生产管理中心仓库入库', operatedBy: '仓管 何秋琳', operatedAt: '2026-03-11 14:00', note: '待裁床调用。' },
      { stage: 'CUTTING', actionText: '裁床调用样衣', operatedBy: '样衣管理员 陈如意', operatedAt: '2026-03-22 09:05', note: '用于裁片核对与花位确认。' },
    ],
  },
  {
    id: 'sw-002',
    warehouseType: 'SAMPLE',
    sampleNo: 'SMP-202603-024',
    sampleName: '深海蓝斜纹裤装样衣',
    relatedProductionOrderNo: 'PO-202603-024',
    relatedCutPieceOrderNo: 'CP-202603-024-01',
    currentLocationStage: 'FACTORY_CHECK',
    currentHolder: '工厂核价组 吴晓莹',
    currentStatus: 'WAITING_RETURN',
    latestActionAt: '2026-03-19 17:40',
    latestActionBy: 'PMC 样衣管理员 林佩琪',
    nextSuggestedAction: '样衣核价完成后归还，并安排抽检复核。',
    flowHistory: [
      { stage: 'DESIGN_CENTER', actionText: '设计中心出样', operatedBy: '设计师 陈雨菲', operatedAt: '2026-03-09 10:00', note: '用于深海蓝版型确认。' },
      { stage: 'CUTTING', actionText: '裁床调样核对', operatedBy: '裁床组 王桂兰', operatedAt: '2026-03-12 08:50', note: '裁床核对完成。' },
      { stage: 'PMC_WAREHOUSE', actionText: '样衣回 PMC 仓库', operatedBy: '仓管 何秋琳', operatedAt: '2026-03-12 18:10', note: '待工厂核价调用。' },
      { stage: 'FACTORY_CHECK', actionText: '工厂核价调用样衣', operatedBy: 'PMC 样衣管理员 林佩琪', operatedAt: '2026-03-19 17:40', note: '当前已超 48 小时待归还。' },
    ],
  },
  {
    id: 'sw-003',
    warehouseType: 'SAMPLE',
    sampleNo: 'SMP-202603-031',
    sampleName: '复古花叶上衣样衣',
    relatedProductionOrderNo: 'PO-202603-031',
    relatedCutPieceOrderNo: 'CP-202603-031-01',
    currentLocationStage: 'BACK_TO_PMC',
    currentHolder: 'PMC 样衣仓',
    currentStatus: 'AVAILABLE',
    latestActionAt: '2026-03-22 13:50',
    latestActionBy: '抽检员 周雅晴',
    nextSuggestedAction: '下次裁床启动前可再次调用。',
    flowHistory: [
      { stage: 'DESIGN_CENTER', actionText: '设计中心做出样衣', operatedBy: '设计师 江雯', operatedAt: '2026-03-13 09:30', note: '样衣完成。' },
      { stage: 'CUTTING', actionText: '裁床调用样衣', operatedBy: '裁床组 郑海燕', operatedAt: '2026-03-18 08:40', note: '用于裁片版位确认。' },
      { stage: 'PMC_WAREHOUSE', actionText: '样衣回 PMC 仓库', operatedBy: '样衣管理员 陈如意', operatedAt: '2026-03-18 19:20', note: '等待工厂核价与制作。' },
      { stage: 'RETURN_CHECK', actionText: '回货后样衣抽检', operatedBy: '抽检员 周雅晴', operatedAt: '2026-03-22 10:25', note: '抽检合格。' },
      { stage: 'BACK_TO_PMC', actionText: '样衣回到 PMC 仓库', operatedBy: '样衣管理员 陈如意', operatedAt: '2026-03-22 13:50', note: '可再次调用。' },
    ],
  },
]

export const warehouseAlertRecords: WarehouseAlertRecord[] = [
  {
    id: 'wa-001',
    warehouseAlertType: 'UNASSIGNED_ZONE',
    level: 'HIGH',
    title: '裁片未分配区域',
    description: 'CP-202603-018-01 尚未分配到 A/B/C 区，后续查找风险较高。',
    relatedNo: 'CP-202603-018-01',
    suggestedAction: '优先确认入仓并分配区域。',
  },
  {
    id: 'wa-002',
    warehouseAlertType: 'STOCK_RECHECK',
    level: 'HIGH',
    title: '库存待核对',
    description: 'PO-202603-018 的印花面料仍存在剩余卷数差异。',
    relatedNo: 'ML-PRINT-240311-01',
    suggestedAction: '先核对裁床仓余料，再决定是否补配。',
  },
  {
    id: 'wa-003',
    warehouseAlertType: 'SAMPLE_OVERDUE',
    level: 'MEDIUM',
    title: '样衣超期未归还',
    description: 'SMP-202603-024 已在工厂核价侧停留超过 48 小时。',
    relatedNo: 'SMP-202603-024',
    suggestedAction: '联系工厂核价组归还样衣，并安排后续抽检。',
  },
  {
    id: 'wa-004',
    warehouseAlertType: 'SPACE_RISK',
    level: 'LOW',
    title: 'A 区待整理',
    description: 'A 区待发后道裁片组较多，建议先清理并确认交接顺序。',
    relatedNo: 'A 区',
    suggestedAction: '优先处理已入仓待后道交接的裁片组。',
  },
]

export function cloneWarehouseManagementData() {
  return {
    fabricStocks: cuttingFabricStockRecords.map((item) => ({ ...item })),
    cutPieceRecords: cutPieceWarehouseRecords.map((item) => ({ ...item })),
    sampleRecords: sampleWarehouseRecords.map((item) => ({
      ...item,
      flowHistory: item.flowHistory.map((history) => ({ ...history })),
    })),
    alerts: warehouseAlertRecords.map((item) => ({ ...item })),
  }
}
