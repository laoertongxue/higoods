import {
  getAccessoryPurchaseOrder,
  type LaceActor,
  type LaceProductionOrderView,
} from '../../../../data/fcs/lace-factory-domain.ts'

export type LaceWorkOrderActionKey =
  | 'view-detail'
  | 'view-change'
  | 'confirm-receive'
  | 'report-completion'
  | 'complete-production'
  | 'handover'
  | 'undo-completion'
  | 'cancel-order'
  | 'restore-order'

export interface LaceWorkOrderAction {
  key: LaceWorkOrderActionKey
  label: string
  tone: 'primary' | 'default' | 'warning' | 'success' | 'danger'
}

function isFactoryOperator(actor: LaceActor): boolean {
  return ['花边厂业务员', '花边厂主管', '平台主管'].includes(actor.role)
}

function isSupervisor(actor: LaceActor): boolean {
  return actor.role === '花边厂主管' || actor.role === '平台主管'
}

export function listExecutableLaceWorkOrderActions(
  order: LaceProductionOrderView,
  actor: LaceActor,
  includeNavigation = true,
): LaceWorkOrderAction[] {
  const actions: LaceWorkOrderAction[] = []
  const canOperate = isFactoryOperator(actor)
  const canSupervise = isSupervisor(actor)

  if (includeNavigation) actions.push({ key: 'view-detail', label: '查看详情', tone: 'primary' })
  if (includeNavigation && order.purchaseChangeStatus !== '无新变更') {
    actions.push({ key: 'view-change', label: '查看采购变更', tone: 'warning' })
  }
  if (canOperate && order.status === '待接收') {
    actions.push({ key: 'confirm-receive', label: '确认接收', tone: 'primary' })
  }
  if (canOperate && order.status === '加工中') {
    actions.push({ key: 'report-completion', label: '加工填报', tone: 'primary' })
    if (order.completedQty > 0) actions.push({ key: 'complete-production', label: '完成加工单', tone: 'default' })
  }
  if (canOperate && ['加工中', '已完结'].includes(order.status) && order.remainingHandoverQty > 0) {
    actions.push({ key: 'handover', label: '发起交出', tone: 'success' })
  }
  if (canSupervise && order.status === '已完结') {
    actions.push({ key: 'undo-completion', label: '撤销完成', tone: 'warning' })
  }
  if (canSupervise && order.status !== '已取消' && order.handedOverQty === 0) {
    actions.push({ key: 'cancel-order', label: '取消生产单', tone: 'danger' })
  }
  const purchaseOrder = order.status === '已取消' ? getAccessoryPurchaseOrder(order.purchaseOrderId) : undefined
  if (actor.role === '平台主管' && order.status === '已取消' && order.handedOverQty === 0 && purchaseOrder?.status === '有效') {
    actions.push({ key: 'restore-order', label: '恢复误取消', tone: 'default' })
  }
  return actions
}
