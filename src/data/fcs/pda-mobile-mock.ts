import {
  listPdaCuttingAwardedTenderNoticeMocks,
  listPdaCuttingBiddingTenderMocks,
  listPdaCuttingQuotedTenderMocks,
} from './cutting/pda-cutting-task-scenarios.ts'
import {
  listPdaGenericAwardedTenderNoticeMocks,
  listPdaGenericBiddingTenderMocks,
  listPdaGenericQuotedTenderMocks,
} from './pda-task-mock-factory.ts'

export interface PdaMobileBiddingTenderMock {
  tenderId: string
  taskId: string
  productionOrderId: string
  processName: string
  qty: number
  qtyUnit: string
  factoryPoolCount: number
  biddingDeadline: string
  taskDeadline: string
  standardPrice: number
  currency: string
  factoryId: string
}

export interface PdaMobileQuotedTenderMock {
  tenderId: string
  taskId: string
  productionOrderId: string
  processName: string
  qty: number
  qtyUnit: string
  quotedPrice: number
  quotedAt: string
  deliveryDays: number
  currency: string
  unit: string
  biddingDeadline: string
  taskDeadline: string
  tenderStatusLabel: string
  remark: string
  factoryId: string
}

export interface PdaMobileAwardedTenderNoticeMock {
  tenderId: string
  taskId: string
  processName: string
  qty: number
  notifiedAt: string
  productionOrderId: string
  factoryId: string
}

const NON_CUTTING_BIDDING_TENDERS: PdaMobileBiddingTenderMock[] = [
  {
    tenderId: 'TENDER-PDA-SEW-118',
    taskId: 'TASK-SEW-BID-118',
    productionOrderId: 'PO-20260322-032',
    processName: '车缝',
    qty: 880,
    qtyUnit: '件',
    factoryPoolCount: 5,
    biddingDeadline: '2026-03-22 20:00:00',
    taskDeadline: '2026-03-25 18:00:00',
    standardPrice: 4.3,
    currency: 'CNY',
    factoryId: 'ID-F001',
  },
  {
    tenderId: 'TENDER-PDA-IRON-071',
    taskId: 'TASK-IRON-BID-071',
    productionOrderId: 'PO-20260322-033',
    processName: '整烫',
    qty: 540,
    qtyUnit: '件',
    factoryPoolCount: 3,
    biddingDeadline: '2026-03-23 10:00:00',
    taskDeadline: '2026-03-25 20:00:00',
    standardPrice: 1.8,
    currency: 'CNY',
    factoryId: 'ID-F001',
  },
]

const NON_CUTTING_QUOTED_TENDERS: PdaMobileQuotedTenderMock[] = [
  {
    tenderId: 'TENDER-PDA-SEW-113',
    taskId: 'TASK-SEW-BID-113',
    productionOrderId: 'PO-20260321-018',
    processName: '车缝',
    qty: 760,
    qtyUnit: '件',
    quotedPrice: 4.6,
    quotedAt: '2026-03-22 09:10:00',
    deliveryDays: 3,
    currency: 'CNY',
    unit: '件',
    biddingDeadline: '2026-03-22 12:00:00',
    taskDeadline: '2026-03-25 20:00:00',
    tenderStatusLabel: '招标中',
    remark: '可安排双线并行，支持夜班赶货。',
    factoryId: 'ID-F001',
  },
  {
    tenderId: 'TENDER-PDA-PACK-009',
    taskId: 'TASK-PACK-BID-009',
    productionOrderId: 'PO-20260321-020',
    processName: '包装',
    qty: 920,
    qtyUnit: '件',
    quotedPrice: 1.2,
    quotedAt: '2026-03-21 17:40:00',
    deliveryDays: 2,
    currency: 'CNY',
    unit: '件',
    biddingDeadline: '2026-03-22 09:30:00',
    taskDeadline: '2026-03-24 16:00:00',
    tenderStatusLabel: '招标中',
    remark: '包装线空档可承接，支持分批交付。',
    factoryId: 'ID-F001',
  },
]

const NON_CUTTING_AWARDED_TENDER_NOTICES: PdaMobileAwardedTenderNoticeMock[] = [
  {
    tenderId: 'TENDER-PDA-SEW-113',
    taskId: 'TASK-SEW-000238',
    processName: '车缝',
    qty: 360,
    notifiedAt: '2026-03-22 07:45:00',
    productionOrderId: 'PO-20260318-008',
    factoryId: 'ID-F001',
  },
  {
    tenderId: 'TENDER-PDA-PACK-011',
    taskId: 'TASK-PACK-000241',
    processName: '包装',
    qty: 680,
    notifiedAt: '2026-03-22 09:20:00',
    productionOrderId: 'PO-20260322-034',
    factoryId: 'ID-F001',
  },
]

export const PDA_MOCK_BIDDING_TENDERS: PdaMobileBiddingTenderMock[] = [
  ...listPdaCuttingBiddingTenderMocks(),
  ...listPdaGenericBiddingTenderMocks(),
  ...NON_CUTTING_BIDDING_TENDERS,
]

export const PDA_MOCK_QUOTED_TENDERS: PdaMobileQuotedTenderMock[] = [
  ...listPdaCuttingQuotedTenderMocks(),
  ...listPdaGenericQuotedTenderMocks(),
  ...NON_CUTTING_QUOTED_TENDERS,
]

export const PDA_MOCK_AWARDED_TENDER_NOTICES: PdaMobileAwardedTenderNoticeMock[] = [
  ...listPdaCuttingAwardedTenderNoticeMocks(),
  ...listPdaGenericAwardedTenderNoticeMocks(),
  ...NON_CUTTING_AWARDED_TENDER_NOTICES,
]

export function listPdaBiddingTendersByFactoryId(factoryId: string): PdaMobileBiddingTenderMock[] {
  return PDA_MOCK_BIDDING_TENDERS.filter((item) => item.factoryId === factoryId).map((item) => ({ ...item }))
}

export function listPdaQuotedTendersByFactoryId(factoryId: string): PdaMobileQuotedTenderMock[] {
  return PDA_MOCK_QUOTED_TENDERS.filter((item) => item.factoryId === factoryId).map((item) => ({ ...item }))
}

export function listPdaAwardedTenderNoticesByFactoryId(factoryId: string): PdaMobileAwardedTenderNoticeMock[] {
  return PDA_MOCK_AWARDED_TENDER_NOTICES.filter((item) => item.factoryId === factoryId).map((item) => ({ ...item }))
}
