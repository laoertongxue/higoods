import { listPdaCuttingTaskSourceRecords } from '../data/fcs/cutting/pda-cutting-task-source.ts'

export interface PdaCuttingWaitHandoverAction {
  key: 'fei-ticket-bagging' | 'transfer-bag-inbound' | 'transfer-bag-repack' | 'transfer-bag-handover' | 'transfer-bag-recovery' | 'transfer-bag-scrap'
  title: string
  route: string
}

export function getPdaCuttingWaitHandoverActions(): PdaCuttingWaitHandoverAction[] {
  const firstTaskId = listPdaCuttingTaskSourceRecords()[0]?.taskId || 'CUTTING-DEMO'

  return [
    {
      key: 'fei-ticket-bagging',
      title: '菲票装袋',
      route: `/fcs/pda/cutting/inbound/${firstTaskId}`,
    },
    {
      key: 'transfer-bag-inbound',
      title: '中转袋入仓',
      route: `/fcs/pda/cutting/inbound/${firstTaskId}?action=inbound-location`,
    },
    {
      key: 'transfer-bag-repack',
      title: '拆袋重装',
      route: '/fcs/pda/cutting/transfer-bag/repack',
    },
    {
      key: 'transfer-bag-handover',
      title: '中转袋交出',
      route: `/fcs/pda/cutting/handover/${firstTaskId}?action=transfer-bag-handover`,
    },
    {
      key: 'transfer-bag-recovery',
      title: '中转袋回收',
      route: '/fcs/pda/cutting/transfer-bag/recovery',
    },
    {
      key: 'transfer-bag-scrap',
      title: '中转袋报废',
      route: '/fcs/pda/cutting/transfer-bag/scrap',
    },
  ]
}

export function resolvePdaCuttingWaitHandoverLegacyActionRoute(action?: string | null): string | null {
  const actions = getPdaCuttingWaitHandoverActions()

  switch (action) {
    case 'inbound':
      return actions.find((item) => item.key === 'fei-ticket-bagging')?.route || null
    case 'inbound-location':
      return actions.find((item) => item.key === 'transfer-bag-inbound')?.route || null
    case 'handover-bagging-confirm':
      return actions.find((item) => item.key === 'transfer-bag-handover')?.route || null
    case 'special-craft-return':
      return actions.find((item) => item.key === 'transfer-bag-inbound')?.route || null
    case 'numbering':
      return '/fcs/pda/cutting/fei-ticket-numbering'
    default:
      return null
  }
}
