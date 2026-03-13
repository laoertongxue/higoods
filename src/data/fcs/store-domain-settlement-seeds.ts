import type { MaterialStatementDraft } from './store-domain-dispatch-process'
import type {
  StatementDraft,
  StatementAdjustment,
  SettlementBatch,
  ProductionOrderChange,
} from './store-domain-settlement-types'

export const initialMaterialStatementDrafts: MaterialStatementDraft[] = []

export const initialStatementDrafts: StatementDraft[] = []

export const initialStatementAdjustments: StatementAdjustment[] = []

export const initialSettlementBatches: SettlementBatch[] = []

export const initialProductionOrderChanges: ProductionOrderChange[] = [
  {
    changeId: 'CHG-202603-0001',
    productionOrderId: 'PO-0001',
    changeType: 'QTY_CHANGE',
    beforeValue: '1000',
    afterValue: '1200',
    impactScopeZh: '染印加工单数量',
    reason: '客户追加订单',
    status: 'DONE',
    createdAt: '2026-03-01 09:00:00',
    createdBy: '王五',
    updatedAt: '2026-03-02 10:00:00',
    updatedBy: '王五',
  },
  {
    changeId: 'CHG-202603-0002',
    productionOrderId: 'PO-0003',
    changeType: 'DATE_CHANGE',
    beforeValue: '2026-03-20',
    afterValue: '2026-04-05',
    impactScopeZh: '交货期与生产排期',
    reason: '面料延期到货',
    status: 'PENDING',
    createdAt: '2026-03-03 14:00:00',
    createdBy: '跟单A',
  },
  {
    changeId: 'CHG-202603-0003',
    productionOrderId: 'PO-0005',
    changeType: 'FACTORY_CHANGE',
    beforeValue: 'Surabaya Factory',
    afterValue: 'Bandung Print House',
    impactScopeZh: '工厂分配、结算对象',
    reason: '原工厂产能不足',
    status: 'DRAFT',
    createdAt: '2026-03-05 11:30:00',
    createdBy: '跟单B',
  },
]
