import assert from 'node:assert/strict'
import type { AffectedCheckRoute } from './affected-checks.ts'
import type { StageTraceSummary } from './stage-trace.ts'

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
  stageTrace?: StageTraceSummary
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
  stageTrace?: StageTraceSummary
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

function requiredCount(value: unknown, field: string): number {
  assert(
    typeof value === 'number' && Number.isInteger(value) && value >= 0,
    `CodeGraph 状态 ${field} 必须是非负整数`,
  )
  return value
}

export function parseCodeGraphStatus(source: string): CodeGraphStatusReceipt {
  const parsed = JSON.parse(source) as RawCodeGraphStatus
  assert(parsed && typeof parsed === 'object', 'CodeGraph 状态必须是 JSON 对象')
  assert(typeof parsed.initialized === 'boolean', 'CodeGraph 状态缺少 initialized')
  assert(typeof parsed.projectPath === 'string', 'CodeGraph 状态缺少项目路径')
  assert(
    parsed.pendingChanges && typeof parsed.pendingChanges === 'object',
    'CodeGraph 状态缺少 pendingChanges',
  )
  assert(
    Object.hasOwn(parsed, 'worktreeMismatch'),
    'CodeGraph 状态缺少 worktreeMismatch',
  )
  assert(
    parsed.worktreeMismatch === null || typeof parsed.worktreeMismatch === 'object',
    'CodeGraph 状态 worktreeMismatch 格式无效',
  )
  const pending = parsed.pendingChanges
  return {
    initialized: parsed.initialized,
    projectPath: parsed.projectPath,
    pendingCount:
      requiredCount(pending.added, 'pendingChanges.added')
      + requiredCount(pending.modified, 'pendingChanges.modified')
      + requiredCount(pending.removed, 'pendingChanges.removed'),
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
  if (input.stageTrace?.required && !input.stageTrace.valid) {
    blockers.push(...input.stageTrace.blockers.map((blocker) => `Superpowers 阶段轨迹：${blocker}`))
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
    ...(input.stageTrace ? { stageTrace: input.stageTrace } : {}),
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
  const provider = delivery.provider.trim().toLowerCase()
  assert(
    ['github', 'vercel', 'sites'].includes(provider),
    'provider 必须是 github、vercel 或 sites',
  )
  const target = delivery.target.trim()
  assert(target && !/\s/.test(target), '交付目标必须是无空白的明确引用')
  let providerReceipt: URL
  try {
    providerReceipt = new URL(delivery.providerReceipt.trim())
  } catch {
    throw new Error('provider 回执必须是 HTTPS URL')
  }
  assert.equal(providerReceipt.protocol, 'https:', 'provider 回执必须是 HTTPS URL')
  const allowedHosts: Record<string, RegExp> = {
    github: /(^|\.)github\.com$/i,
    vercel: /(^|\.)vercel\.(?:com|app)$/i,
    sites: /(^|\.)openai\.com$/i,
  }
  assert(allowedHosts[provider].test(providerReceipt.hostname), 'provider 回执域名与 provider 不匹配')
  if (provider === 'github') {
    assert(
      providerReceipt.pathname.includes(delivery.revision),
      'GitHub provider 回执必须引用已验证版本',
    )
  }

  return {
    ...receipt,
    state: 'delivered',
    delivery: {
      ...delivery,
      provider,
      target,
      providerReceipt: providerReceipt.toString(),
      recordedAt: new Date().toISOString(),
    },
  }
}

export function recordAcceptance(
  receipt: TaskCompletionReceipt,
  input: { acceptanceRef: string },
): TaskCompletionReceipt {
  assert.equal(receipt.state, 'delivered', '只有已交付任务才能记录接受')
  const acceptanceRef = input.acceptanceRef.trim()
  assert(
    /^(?:conversation:user-message|provider:acceptance|ticket):\S{4,}$/.test(acceptanceRef),
    '接受引用必须是 conversation:user-message、provider:acceptance 或 ticket 类型的结构化引用',
  )
  assert(receipt.delivery, '缺少交付回执')

  return {
    ...receipt,
    state: 'accepted',
    delivery: {
      ...receipt.delivery,
      acceptanceRef,
    },
  }
}
