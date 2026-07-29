import assert from 'node:assert/strict'
import type { AffectedCheckRoute } from './affected-checks.ts'

export type TaskReceiptState = 'implemented' | 'verified' | 'delivered' | 'accepted'

export interface GitRevision {
  head: string
  diffHash: string
  changedPaths: string[]
}

export interface CheckReceipt {
  command: string
  exitCode: number
  startedAt: string
  finishedAt: string
  invariant: string
}

export interface CodeGraphStatusReceipt {
  initialized: boolean
  projectPath: string
  pendingCount: number
  worktreeMismatch: boolean
}

export interface CodeGraphReceipt {
  syncExitCode: number
  before: CodeGraphStatusReceipt
  after: CodeGraphStatusReceipt
}

export interface DeliveryReceipt {
  provider: string
  target: string
  revision: string
  providerReceipt: string
  recordedAt: string
  acceptanceRef?: string
}

export interface TaskCompletionReceipt {
  schemaVersion: 1
  workspace: string
  createdAt: string
  state: TaskReceiptState
  revision: GitRevision
  route: AffectedCheckRoute
  checks: CheckReceipt[]
  codegraph: CodeGraphReceipt
  blockers: string[]
  delivery?: DeliveryReceipt
}

interface RawCodeGraphStatus {
  initialized?: unknown
  projectPath?: unknown
  pendingChanges?: {
    added?: unknown
    modified?: unknown
    removed?: unknown
  }
  worktreeMismatch?: unknown
}

interface CreateTaskReceiptInput {
  workspace: string
  revisionBefore: GitRevision
  revisionAfter: GitRevision
  route: AffectedCheckRoute
  checks: CheckReceipt[]
  codegraph: CodeGraphReceipt
}

function requiredCommands(route: AffectedCheckRoute): string[] {
  return [...new Set([
    ...route.fastChecks,
    ...route.governanceChecks,
    ...route.fullChecks,
  ])]
}

function revisionsEqual(left: GitRevision, right: GitRevision): boolean {
  return left.head === right.head && left.diffHash === right.diffHash
}

function safeCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}

export function parseCodeGraphStatus(source: string): CodeGraphStatusReceipt {
  const parsed = JSON.parse(source) as RawCodeGraphStatus
  assert(parsed && typeof parsed === 'object', 'CodeGraph 状态必须是 JSON 对象')
  assert(typeof parsed.projectPath === 'string', 'CodeGraph 状态缺少项目路径')
  const pending = parsed.pendingChanges ?? {}
  return {
    initialized: parsed.initialized === true,
    projectPath: parsed.projectPath,
    pendingCount:
      safeCount(pending.added)
      + safeCount(pending.modified)
      + safeCount(pending.removed),
    worktreeMismatch: Boolean(parsed.worktreeMismatch),
  }
}

export function createTaskReceipt(input: CreateTaskReceiptInput): TaskCompletionReceipt {
  const blockers: string[] = []
  if (!revisionsEqual(input.revisionBefore, input.revisionAfter)) {
    blockers.push('最终改动已变化，必须重新运行相关检查')
  }

  for (const command of requiredCommands(input.route)) {
    const result = input.checks.find((check) => check.command === command)
    if (!result) blockers.push(`缺少相关检查结果：${command}`)
    else if (result.exitCode !== 0) blockers.push(`相关检查失败：${command}`)
  }

  if (input.codegraph.syncExitCode !== 0) {
    blockers.push('CodeGraph 同步失败')
  }
  if (!input.codegraph.after.initialized) {
    blockers.push('CodeGraph 索引未初始化')
  }
  if (input.codegraph.after.pendingCount > 0) {
    blockers.push(`CodeGraph 仍有 ${input.codegraph.after.pendingCount} 个待同步文件`)
  }
  if (input.codegraph.after.worktreeMismatch) {
    blockers.push('CodeGraph 索引与当前工作树不匹配')
  }
  if (input.codegraph.after.projectPath !== input.workspace) {
    blockers.push('CodeGraph 项目路径与任务工作区不一致')
  }

  return {
    schemaVersion: 1,
    workspace: input.workspace,
    createdAt: new Date().toISOString(),
    state: blockers.length === 0 ? 'verified' : 'implemented',
    revision: input.revisionAfter,
    route: input.route,
    checks: input.checks,
    codegraph: input.codegraph,
    blockers,
  }
}

export function assertReceiptCurrent(
  receipt: TaskCompletionReceipt,
  revision: GitRevision,
): void {
  assert(revisionsEqual(receipt.revision, revision), '最终改动已变化，验证收据已经过期')
}

export function recordDelivery(
  receipt: TaskCompletionReceipt,
  delivery: Omit<DeliveryReceipt, 'recordedAt' | 'acceptanceRef'>,
): TaskCompletionReceipt {
  assert.equal(receipt.state, 'verified', '只有验证完成的任务才能记录远端交付')
  assert(delivery.providerReceipt.trim(), '缺少 provider 回执，不能标记远端交付')
  assert.equal(delivery.revision, receipt.revision.head, '交付版本与验证版本不一致')

  return {
    ...receipt,
    state: 'delivered',
    delivery: {
      ...delivery,
      providerReceipt: delivery.providerReceipt.trim(),
      recordedAt: new Date().toISOString(),
    },
  }
}

export function recordAcceptance(
  receipt: TaskCompletionReceipt,
  input: { acceptanceRef: string },
): TaskCompletionReceipt {
  assert.equal(receipt.state, 'delivered', '只有已交付任务才能记录接受')
  assert(input.acceptanceRef.trim(), '缺少明确接受引用')
  assert(receipt.delivery, '缺少交付回执')

  return {
    ...receipt,
    state: 'accepted',
    delivery: {
      ...receipt.delivery,
      acceptanceRef: input.acceptanceRef.trim(),
    },
  }
}
