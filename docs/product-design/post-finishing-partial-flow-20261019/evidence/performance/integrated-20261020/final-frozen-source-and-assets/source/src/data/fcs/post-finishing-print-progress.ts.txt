import { getPostFinishingFullFlowPostTask, getPostFinishingProcessProgress } from './post-finishing-full-flow.ts'

/** The existing parent card prints known facts; legacy combined work is not four item events. */
export function postFinishingPrintProgressFields(taskId: string): Array<{ label: string; value: string }> {
  const task = getPostFinishingFullFlowPostTask(taskId)
  if (!task) throw new Error('未找到后道加工单。')
  const progress = getPostFinishingProcessProgress(task)
  const historicalUnknown = task.executionModel !== 'ITEMS_V1' && !task.legacyCarryover
  const historyQty = progress.lines.reduce((sum, line) => sum + line.historyCompletedQty, 0)
  return [
    ...(historyQty > 0 ? [{ label: '历史合并完成量', value: `${historyQty} 件（历史未分项，不代表各项实际登记）` }] : []),
    ...progress.processes.map(row => ({ label: `${row.processItem}完成量`, value: historicalUnknown ? '历史未分项' : !row.applicable ? '不涉及' : `${historyQty > 0 ? '新增 ' : ''}${row.completedQty} / ${row.expectedQty} 件` })),
  ]
}
