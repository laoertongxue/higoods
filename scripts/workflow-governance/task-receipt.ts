import assert from 'node:assert/strict'
import type { AffectedCheckRoute } from './affected-checks.ts'
import {
  instructionContextsEqual,
  parseInstructionContext,
  type InstructionContextReceipt,
} from './instruction-context.ts'
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

interface RemoteEvidenceProbeResult {
  ok: boolean
  canonicalRef?: string
  reason?: string
}

export interface TaskCompletionReceipt {
  schemaVersion: 2
  workspace: string
  createdAt: string
  state: TaskReceiptState
  instructionContext: InstructionContextReceipt
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
  instructionBefore: InstructionContextReceipt
  instructionAfter: InstructionContextReceipt
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
  return left.head === right.head
    && left.diffHash === right.diffHash
    && left.changedPaths.length === right.changedPaths.length
    && left.changedPaths.every((path, index) => path === right.changedPaths[index])
}

export function receiptValidationPaths(
  receipt: TaskCompletionReceipt,
  currentWorkingPaths: string[],
): string[] {
  return [...new Set([
    ...receipt.revision.changedPaths,
    ...currentWorkingPaths,
  ])].sort()
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

function parseObject(value: unknown, field: string): Record<string, unknown> {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${field} 必须是对象`)
  return value as Record<string, unknown>
}

function parseRequiredString(value: unknown, field: string): string {
  assert(typeof value === 'string' && value.trim(), `${field} 必须是非空字符串`)
  return value
}

function parseTimestamp(value: unknown, field: string): string {
  const timestamp = parseRequiredString(value, field)
  assert(!Number.isNaN(Date.parse(timestamp)), `${field} 必须是有效时间`)
  return timestamp
}

function parseStringArray(value: unknown, field: string): string[] {
  assert(
    Array.isArray(value) && value.every((item) => typeof item === 'string'),
    `${field} 必须是字符串数组`,
  )
  return [...value]
}

function parseRevision(value: unknown): GitRevision {
  const revision = parseObject(value, 'revision')
  return {
    head: parseRequiredString(revision.head, 'revision.head'),
    diffHash: parseRequiredString(revision.diffHash, 'revision.diffHash'),
    changedPaths: parseStringArray(revision.changedPaths, 'revision.changedPaths'),
  }
}

function parseRoute(value: unknown): AffectedCheckRoute {
  const route = parseObject(value, 'route')
  return {
    changedPaths: parseStringArray(route.changedPaths, 'route.changedPaths'),
    fastChecks: parseStringArray(route.fastChecks, 'route.fastChecks'),
    governanceChecks: parseStringArray(route.governanceChecks, 'route.governanceChecks'),
    fullChecks: parseStringArray(route.fullChecks, 'route.fullChecks'),
    unknownPaths: parseStringArray(route.unknownPaths, 'route.unknownPaths'),
    escalationReasons: parseStringArray(route.escalationReasons, 'route.escalationReasons'),
  }
}

function parseChecks(value: unknown): CheckReceipt[] {
  assert(Array.isArray(value), 'checks 必须是数组')
  return value.map((item, index) => {
    const check = parseObject(item, `checks[${index}]`)
    assert(
      typeof check.exitCode === 'number' && Number.isInteger(check.exitCode),
      `checks[${index}].exitCode 必须是整数`,
    )
    return {
      command: parseRequiredString(check.command, `checks[${index}].command`),
      exitCode: check.exitCode,
      startedAt: parseTimestamp(check.startedAt, `checks[${index}].startedAt`),
      finishedAt: parseTimestamp(check.finishedAt, `checks[${index}].finishedAt`),
      invariant: parseRequiredString(check.invariant, `checks[${index}].invariant`),
    }
  })
}

function parseCodeGraphStatusReceipt(value: unknown, field: string): CodeGraphStatusReceipt {
  const status = parseObject(value, field)
  assert(typeof status.initialized === 'boolean', `${field}.initialized 必须是布尔值`)
  assert(
    typeof status.pendingCount === 'number'
      && Number.isInteger(status.pendingCount)
      && status.pendingCount >= 0,
    `${field}.pendingCount 必须是非负整数`,
  )
  assert(typeof status.worktreeMismatch === 'boolean', `${field}.worktreeMismatch 必须是布尔值`)
  return {
    initialized: status.initialized,
    projectPath: parseRequiredString(status.projectPath, `${field}.projectPath`),
    pendingCount: status.pendingCount,
    worktreeMismatch: status.worktreeMismatch,
  }
}

function parseCodeGraphReceipt(value: unknown): CodeGraphReceipt {
  const codegraph = parseObject(value, 'codegraph')
  assert(
    typeof codegraph.syncExitCode === 'number' && Number.isInteger(codegraph.syncExitCode),
    'codegraph.syncExitCode 必须是整数',
  )
  return {
    syncExitCode: codegraph.syncExitCode,
    before: parseCodeGraphStatusReceipt(codegraph.before, 'codegraph.before'),
    after: parseCodeGraphStatusReceipt(codegraph.after, 'codegraph.after'),
  }
}

const WORKFLOW_STAGES = new Set([
  'trigger',
  'skill-invocation',
  'artifact',
  'implementation',
  'spec-review',
  'code-quality-review',
  'final-validation',
])

function parseStageTrace(value: unknown): StageTraceSummary {
  const trace = parseObject(value, 'stageTrace')
  assert(typeof trace.required === 'boolean', 'stageTrace.required 必须是布尔值')
  assert(typeof trace.valid === 'boolean', 'stageTrace.valid 必须是布尔值')
  const stages = parseStringArray(trace.stages, 'stageTrace.stages')
  assert(stages.every((stage) => WORKFLOW_STAGES.has(stage)), 'stageTrace.stages 包含未知阶段')
  return {
    required: trace.required,
    valid: trace.valid,
    stages: stages as StageTraceSummary['stages'],
    skills: parseStringArray(trace.skills, 'stageTrace.skills'),
    blockers: parseStringArray(trace.blockers, 'stageTrace.blockers'),
  }
}

function parseDelivery(value: unknown): DeliveryReceipt {
  const delivery = parseObject(value, 'delivery')
  const acceptanceRef = delivery.acceptanceRef === undefined
    ? undefined
    : parseRequiredString(delivery.acceptanceRef, 'delivery.acceptanceRef')
  return {
    provider: parseRequiredString(delivery.provider, 'delivery.provider'),
    target: parseRequiredString(delivery.target, 'delivery.target'),
    revision: parseRequiredString(delivery.revision, 'delivery.revision'),
    providerReceipt: parseRequiredString(delivery.providerReceipt, 'delivery.providerReceipt'),
    recordedAt: parseTimestamp(delivery.recordedAt, 'delivery.recordedAt'),
    ...(acceptanceRef ? { acceptanceRef } : {}),
  }
}

function instructionBindsStageTrace(instructionContext: InstructionContextReceipt): boolean {
  return instructionContext.ruleBindings
    .some((binding) => binding.evidenceFields.includes('stageTrace'))
}

export function assertTaskReceiptSemantics(receipt: TaskCompletionReceipt): void {
  assert.equal(receipt.schemaVersion, 2, '只支持 schemaVersion 2 的任务收据')

  if (receipt.state === 'implemented') {
    assert(receipt.blockers.length > 0, 'implemented 状态必须包含 blockers')
    return
  }

  assert.equal(receipt.blockers.length, 0, `${receipt.state} 状态的 blockers 必须为空`)
  for (const command of requiredCommands(receipt.route)) {
    const result = receipt.checks.find((check) => check.command === command)
    assert(result, `缺少相关检查结果：${command}`)
    assert.equal(result.exitCode, 0, `相关检查失败：${command}`)
  }
  assert.equal(receipt.codegraph.syncExitCode, 0, 'CodeGraph 同步失败')
  assert(receipt.codegraph.after.initialized, 'CodeGraph 索引未初始化')
  assert.equal(receipt.codegraph.after.pendingCount, 0, 'CodeGraph 仍有待同步文件')
  assert(!receipt.codegraph.after.worktreeMismatch, 'CodeGraph 索引与当前工作树不匹配')
  assert.equal(
    receipt.codegraph.after.projectPath,
    receipt.workspace,
    'CodeGraph 项目路径与任务工作区不一致',
  )

  const bindsStageTrace = instructionBindsStageTrace(receipt.instructionContext)
  assert.equal(
    bindsStageTrace,
    Boolean(receipt.stageTrace?.required),
    'AGENTS 阶段轨迹绑定与 stageTrace.required 不一致',
  )
  if (receipt.stageTrace?.required) {
    assert(receipt.stageTrace.valid, '必需阶段轨迹无效')
  }

  if (receipt.state === 'verified') {
    assert(!receipt.delivery, 'verified 状态不得包含 delivery')
    return
  }

  const delivery = receipt.delivery
  assert(delivery, `${receipt.state} 状态缺少 delivery`)
  assert.equal(delivery.provider, 'github', 'delivery.provider 必须是 github')
  const targetMatch = /^([^/\s]+)\/([^@\s]+)@(\S+)$/.exec(delivery.target)
  assert(targetMatch, 'delivery.target 必须使用 owner/repository@ref')
  assert.equal(delivery.revision, receipt.revision.head, '交付版本与验证版本不一致')
  const [, owner, repository] = targetMatch
  const canonicalProviderReceipt =
    `https://api.github.com/repos/${owner}/${repository}/commits/${delivery.revision}`
  assert.equal(
    delivery.providerReceipt,
    canonicalProviderReceipt,
    'delivery.providerReceipt 必须是规范 GitHub API 回执',
  )

  if (receipt.state === 'delivered') {
    assert.equal(delivery.acceptanceRef, undefined, 'delivered 状态不得提前包含 acceptanceRef')
    return
  }

  const acceptancePrefix =
    `https://api.github.com/repos/${owner}/${repository}/issues/comments/`
  assert(
    delivery.acceptanceRef?.startsWith(acceptancePrefix)
      && /^\d+$/.test(delivery.acceptanceRef.slice(acceptancePrefix.length)),
    'accepted 状态必须包含合法 acceptanceRef',
  )
}

export function parseTaskCompletionReceipt(source: string): TaskCompletionReceipt {
  const receipt = parseObject(JSON.parse(source) as unknown, '任务收据')
  assert.equal(receipt.schemaVersion, 2, '任务收据 schemaVersion 必须是 2')
  const workspace = parseRequiredString(receipt.workspace, 'workspace')
  const createdAt = parseTimestamp(receipt.createdAt, 'createdAt')
  assert(
    typeof receipt.state === 'string'
      && ['implemented', 'verified', 'delivered', 'accepted'].includes(receipt.state),
    'state 必须是有效任务状态',
  )
  const state = receipt.state as TaskReceiptState
  const instructionContext = parseInstructionContext(receipt.instructionContext)
  const revision = parseRevision(receipt.revision)
  const route = parseRoute(receipt.route)
  const checks = parseChecks(receipt.checks)
  const codegraph = parseCodeGraphReceipt(receipt.codegraph)
  const blockers = parseStringArray(receipt.blockers, 'blockers')
  const stageTrace = receipt.stageTrace === undefined
    ? undefined
    : parseStageTrace(receipt.stageTrace)
  const delivery = receipt.delivery === undefined
    ? undefined
    : parseDelivery(receipt.delivery)
  const parsedReceipt: TaskCompletionReceipt = {
    schemaVersion: 2,
    workspace,
    createdAt,
    state,
    instructionContext,
    revision,
    route,
    checks,
    codegraph,
    blockers,
    ...(stageTrace ? { stageTrace } : {}),
    ...(delivery ? { delivery } : {}),
  }
  assertTaskReceiptSemantics(parsedReceipt)
  return parsedReceipt
}

export function createTaskReceipt(input: CreateTaskReceiptInput): TaskCompletionReceipt {
  const blockers: string[] = []
  const instructionContext = parseInstructionContext(input.instructionAfter)
  if (!instructionContextsEqual(input.instructionBefore, instructionContext)) {
    blockers.push('AGENTS 指令上下文已变化，必须重新执行并验证任务')
  }
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
    const stageTraceBlockers = input.stageTrace.blockers
      .map((blocker) => `Superpowers 阶段轨迹：${blocker}`)
    blockers.push(...(stageTraceBlockers.length > 0
      ? stageTraceBlockers
      : ['Superpowers 阶段轨迹：必需阶段轨迹无效']))
  }
  const bindsStageTrace = instructionBindsStageTrace(instructionContext)
  if (bindsStageTrace !== Boolean(input.stageTrace?.required)) {
    blockers.push('AGENTS 阶段轨迹绑定与 stageTrace.required 不一致')
  }

  const receipt: TaskCompletionReceipt = {
    schemaVersion: 2,
    workspace: input.workspace,
    createdAt: new Date().toISOString(),
    state: blockers.length === 0 ? 'verified' : 'implemented',
    instructionContext,
    revision: input.revisionAfter,
    route: input.route,
    checks: input.checks,
    codegraph: input.codegraph,
    blockers,
    ...(input.stageTrace ? { stageTrace: input.stageTrace } : {}),
  }
  assertTaskReceiptSemantics(receipt)
  return receipt
}

export function assertReceiptCurrent(
  receipt: TaskCompletionReceipt,
  revision: GitRevision,
): void {
  assert(revisionsEqual(receipt.revision, revision), '最终改动已变化，验证收据已经过期')
}

async function defaultRemoteEvidenceProbe(input: {
  kind: 'delivery' | 'acceptance'
  url: string
  revision: string
  targetUrl?: string
  expectedActor?: string
}): Promise<RemoteEvidenceProbeResult> {
  try {
    const headers: Record<string, string> = {
      accept: 'application/vnd.github+json',
      'user-agent': 'higoods-workflow-governance',
    }
    if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`
    const response = await fetch(input.url, {
      headers,
      redirect: 'follow',
    })
    if (!response.ok) return { ok: false, reason: `HTTP ${response.status}` }
    const body = await response.json() as Record<string, unknown>
    if (input.kind === 'delivery') {
      if (body.sha !== input.revision) return { ok: false, reason: '远端提交版本不匹配' }
      assert(input.targetUrl, '缺少 GitHub 目标分支核验地址')
      const targetResponse = await fetch(input.targetUrl, {
        headers,
        redirect: 'follow',
      })
      if (!targetResponse.ok) return { ok: false, reason: `目标分支 HTTP ${targetResponse.status}` }
      const targetBody = await targetResponse.json() as {
        object?: { sha?: unknown }
      }
      return targetBody.object?.sha === input.revision
        ? { ok: true, canonicalRef: input.url }
        : { ok: false, reason: '目标分支未指向已验证版本' }
    }
    const comment = typeof body.body === 'string' ? body.body : ''
    const author = body.user && typeof body.user === 'object'
      ? (body.user as { login?: unknown }).login
      : undefined
    const association = typeof body.author_association === 'string'
      ? body.author_association
      : ''
    const denied = /\b(?:not|never|cannot|can't|won't|\w+n['’]t)\b[^\n.!?]{0,64}\b(?:accepted|approved)\b/i.test(comment)
      || /(?:不|未|尚未|并非|拒绝|不予|不能|无法)[^，。！？\n]{0,32}(?:同意|接受|验收通过)/.test(comment)
    const explicitlyAccepted = /\b(?:accepted|approved)\b/i.test(comment)
      || /(?:^|[\s，。,:：;；])(?:同意|接受|验收通过)(?=$|[\s，。,:：;；])/.test(comment)
    const accepted = !denied
      && explicitlyAccepted
      && comment.includes(input.revision)
      && author === input.expectedActor
      && ['OWNER', 'MEMBER', 'COLLABORATOR'].includes(association)
    return accepted
      ? { ok: true, canonicalRef: input.url }
      : { ok: false, reason: '远端评论未明确接受已验证版本' }
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function recordDelivery(
  receipt: TaskCompletionReceipt,
  delivery: Omit<DeliveryReceipt, 'recordedAt' | 'acceptanceRef'>,
): Promise<TaskCompletionReceipt> {
  assertTaskReceiptSemantics(receipt)
  assert.equal(receipt.state, 'verified', '只有验证完成的任务才能记录远端交付')
  assert(delivery.providerReceipt.trim(), '缺少 provider 回执，不能标记远端交付')
  assert.equal(delivery.revision, receipt.revision.head, '交付版本与验证版本不一致')
  const provider = delivery.provider.trim().toLowerCase()
  assert.equal(provider, 'github', '当前只支持可远端核验的 github provider')
  const target = delivery.target.trim()
  const targetMatch = /^([^/\s]+)\/([^@\s]+)@(\S+)$/.exec(target)
  assert(targetMatch, 'GitHub 交付目标必须使用 owner/repository@ref')
  let providerReceipt: URL
  try {
    providerReceipt = new URL(delivery.providerReceipt.trim())
  } catch {
    throw new Error('provider 回执必须是 HTTPS URL')
  }
  assert.equal(providerReceipt.protocol, 'https:', 'provider 回执必须是 HTTPS URL')
  assert.equal(providerReceipt.hostname, 'github.com', 'GitHub provider 回执域名无效')
  const [, owner, repository, targetRef] = targetMatch
  assert.equal(
    providerReceipt.pathname,
    `/${owner}/${repository}/commit/${delivery.revision}`,
    'GitHub provider 回执必须精确引用目标仓库的已验证版本',
  )
  const canonicalUrl = `https://api.github.com/repos/${owner}/${repository}/commits/${delivery.revision}`
  const targetUrl = `https://api.github.com/repos/${owner}/${repository}/git/ref/heads/${encodeURIComponent(targetRef)}`
  const verification = await defaultRemoteEvidenceProbe({
    kind: 'delivery',
    url: canonicalUrl,
    revision: delivery.revision,
    targetUrl,
  })
  assert(verification.ok, `远端核验失败：${verification.reason ?? '未知原因'}`)
  assert.equal(verification.canonicalRef, canonicalUrl, '远端核验回执不是规范 GitHub 引用')

  const deliveredReceipt: TaskCompletionReceipt = {
    ...receipt,
    state: 'delivered',
    delivery: {
      ...delivery,
      provider,
      target,
      providerReceipt: canonicalUrl,
      recordedAt: new Date().toISOString(),
    },
  }
  assertTaskReceiptSemantics(deliveredReceipt)
  return deliveredReceipt
}

export async function recordAcceptance(
  receipt: TaskCompletionReceipt,
  input: { acceptanceRef: string; expectedActor: string },
): Promise<TaskCompletionReceipt> {
  assertTaskReceiptSemantics(receipt)
  assert.equal(receipt.state, 'delivered', '只有已交付任务才能记录接受')
  const acceptanceRef = input.acceptanceRef.trim()
  const expectedActor = input.expectedActor.trim()
  assert(/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(expectedActor), '缺少明确的 GitHub 接受人')
  assert(receipt.delivery, '缺少交付回执')
  const targetMatch = /^([^/\s]+)\/([^@\s]+)@(\S+)$/.exec(receipt.delivery.target)
  assert(targetMatch, '交付目标格式无效')
  const [, owner, repository] = targetMatch
  assert(
    acceptanceRef.startsWith(`https://api.github.com/repos/${owner}/${repository}/issues/comments/`),
    '接受引用必须是目标仓库的 GitHub 评论 API URL',
  )
  const verification = await defaultRemoteEvidenceProbe({
    kind: 'acceptance',
    url: acceptanceRef,
    revision: receipt.revision.head,
    expectedActor,
  })
  assert(verification.ok, `远端核验失败：${verification.reason ?? '未知原因'}`)
  assert.equal(verification.canonicalRef, acceptanceRef, '接受核验回执不是规范 GitHub 引用')

  const acceptedReceipt: TaskCompletionReceipt = {
    ...receipt,
    state: 'accepted',
    delivery: {
      ...receipt.delivery,
      acceptanceRef,
    },
  }
  assertTaskReceiptSemantics(acceptedReceipt)
  return acceptedReceipt
}
