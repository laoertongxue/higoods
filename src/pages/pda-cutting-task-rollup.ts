import {
  resolvePdaTaskDetailPath,
  resolvePdaTaskExecPath,
  type PdaTaskFlowMock,
} from '../data/fcs/pda-cutting-execution-source.ts'

export interface PdaCuttingTaskEntryAction {
  label: string
  href: string
  helperText: string
  directExec: boolean
}

interface PdaCuttingTaskEntryActionOptions {
  returnTo?: string
  detailHref?: string
  execHref?: string
}

export function buildPdaCuttingTaskEntryAction(
  task: PdaTaskFlowMock,
  options: PdaCuttingTaskEntryActionOptions | string = {},
): PdaCuttingTaskEntryAction {
  const normalizedOptions: PdaCuttingTaskEntryActionOptions =
    typeof options === 'string' ? { returnTo: options } : options

  if (task.taskReadyForDirectExec && (task.defaultExecutionOrderId || task.defaultExecutionOrderNo)) {
    return {
      label: '继续处理',
      href: normalizedOptions.execHref || resolvePdaTaskExecPath(task.taskId, normalizedOptions.returnTo),
      helperText: '',
      directExec: true,
    }
  }

  return {
    label: '查看任务',
    href: normalizedOptions.detailHref || resolvePdaTaskDetailPath(task.taskId, normalizedOptions.returnTo),
    helperText: task.hasMultipleCutPieceOrders ? '需先选择执行单' : '',
    directExec: false,
  }
}

export function getPdaCuttingTaskStateBadgeClass(taskStateLabel?: string): string {
  if (taskStateLabel === '已完成') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (taskStateLabel === '有异常') return 'border-destructive/20 bg-destructive text-destructive-foreground'
  if (taskStateLabel === '部分完成') return 'border-amber-200 bg-amber-50 text-amber-700'
  if (taskStateLabel === '进行中') return 'border-blue-200 bg-blue-50 text-blue-700'
  return 'border-border bg-background text-muted-foreground'
}
