import { listPdaCuttingTaskSourceRecords } from '../data/fcs/cutting/pda-cutting-task-source.ts'

export interface PdaCuttingWaitHandoverAction {
  key: 'fei-ticket-bagging' | 'transfer-bag-inbound' | 'transfer-bag-handover' | 'special-craft-return' | 'fei-ticket-numbering'
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
      key: 'transfer-bag-handover',
      title: '中转袋交出',
      route: `/fcs/pda/cutting/handover/${firstTaskId}?action=transfer-bag-handover`,
    },
    {
      key: 'special-craft-return',
      title: '特殊工艺回仓',
      route: `/fcs/pda/cutting/handover/${firstTaskId}?action=special-craft-return`,
    },
    {
      key: 'fei-ticket-numbering',
      title: '菲票打编号',
      route: '/fcs/pda/cutting/fei-ticket-numbering',
    },
  ]
}
