import type { RuntimeSewingTaskReassignmentResult } from './runtime-process-tasks.ts'

interface InternalRuntimeSewingReassignmentInput {
  sourceTaskId: string
  targetFactoryId: string
  targetFactoryName: string
  businessAssignedAt: string
  operatedAt: string
  reason: string
  by: string
  mainFactoryId?: string
  confirmedReceivedQty: number
}

let commit: ((input: InternalRuntimeSewingReassignmentInput) => RuntimeSewingTaskReassignmentResult) | null = null

export function installRuntimeSewingReassignmentCommit(
  implementation: (input: InternalRuntimeSewingReassignmentInput) => RuntimeSewingTaskReassignmentResult,
): void {
  commit = implementation
}

export function invokeRuntimeSewingReassignmentCommit(
  input: InternalRuntimeSewingReassignmentInput,
): RuntimeSewingTaskReassignmentResult {
  if (!commit) throw new Error('车缝改派运行时能力尚未初始化')
  return commit(input)
}
