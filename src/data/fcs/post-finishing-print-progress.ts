import { getPostFinishingFullFlowPostTask, getPostFinishingProcessProgress } from './post-finishing-full-flow.ts'

/** Print the current item completion facts. */
export function postFinishingPrintProgressFields(taskId: string): Array<{ label: string; value: string }> {
  const task = getPostFinishingFullFlowPostTask(taskId)
  if (!task) throw new Error('未找到后道加工单。')
  const progress = getPostFinishingProcessProgress(task)
  return progress.processes.map(row => ({ label: `${row.processItem}完成量`, value: !row.applicable ? '不涉及' : `${row.completedQty} / ${row.expectedQty} 件` }))
}
