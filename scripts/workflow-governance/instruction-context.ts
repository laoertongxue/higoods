import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, realpathSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'

export type InstructionReceiptField =
  | 'revision'
  | 'route'
  | 'checks'
  | 'codegraph'
  | 'stageTrace'

export interface InstructionRuleBinding {
  ruleRef: string
  evidenceFields: InstructionReceiptField[]
}

export interface InstructionContextReceipt {
  taskBoundary: string
  source: {
    path: 'AGENTS.md'
    algorithm: 'sha256'
    contentHash: string
  }
  ruleBindings: InstructionRuleBinding[]
}

export interface CaptureInstructionContextOptions {
  workspace: string
  taskBoundary: string
  requireStageTrace?: boolean
}

export interface AssertInstructionContextCurrentOptions {
  workspace: string
  requireStageTrace?: boolean
}

const CODEGRAPH_RULE = 'AGENTS.md::## 12. CodeGraph 使用规则'
const RECEIPT_RULE = 'AGENTS.md::### 12.1 任务完成与交付收据'
const STAGE_TRACE_RULE = 'AGENTS.md::### 12.2 Superpowers 最小阶段轨迹'

const CORE_RULE_BINDINGS: readonly InstructionRuleBinding[] = [
  { ruleRef: CODEGRAPH_RULE, evidenceFields: ['codegraph'] },
  {
    ruleRef: RECEIPT_RULE,
    evidenceFields: ['revision', 'route', 'checks', 'codegraph'],
  },
]

const STAGE_TRACE_BINDING: InstructionRuleBinding = {
  ruleRef: STAGE_TRACE_RULE,
  evidenceFields: ['stageTrace'],
}

const KNOWN_RULE_BINDINGS = new Map(
  [...CORE_RULE_BINDINGS, STAGE_TRACE_BINDING]
    .map((binding) => [binding.ruleRef, binding] as const),
)

function cloneBinding(binding: InstructionRuleBinding): InstructionRuleBinding {
  return {
    ruleRef: binding.ruleRef,
    evidenceFields: [...binding.evidenceFields],
  }
}

function requiredBindings(requireStageTrace: boolean): InstructionRuleBinding[] {
  return [
    ...CORE_RULE_BINDINGS.map(cloneBinding),
    ...(requireStageTrace ? [cloneBinding(STAGE_TRACE_BINDING)] : []),
  ]
}

function assertExactHeading(source: string, ruleRef: string): void {
  const heading = ruleRef.slice('AGENTS.md::'.length)
  assert(
    source.split(/\r?\n/).includes(heading),
    `根 AGENTS.md 缺少精确标题：${heading}`,
  )
}

function isPathInsideWorkspace(workspace: string, path: string): boolean {
  const pathFromWorkspace = relative(workspace, path)
  return (
    pathFromWorkspace !== ''
    && pathFromWorkspace !== '..'
    && !pathFromWorkspace.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)
    && !isAbsolute(pathFromWorkspace)
  )
}

function instructionContextJson(receipt: InstructionContextReceipt): string {
  return JSON.stringify(receipt)
}

export function captureInstructionContext(
  options: CaptureInstructionContextOptions,
): InstructionContextReceipt {
  const taskBoundary = options.taskBoundary.trim()
  assert(taskBoundary, '任务边界 trim 后不能为空')

  const workspace = realpathSync(resolve(options.workspace))
  const agentsPath = realpathSync(resolve(workspace, 'AGENTS.md'))
  assert(
    isPathInsideWorkspace(workspace, agentsPath),
    '根 AGENTS.md realpath 必须仍位于工作区内',
  )

  const bytes = readFileSync(agentsPath)
  const ruleBindings = requiredBindings(options.requireStageTrace === true)
  const source = bytes.toString('utf8')
  for (const binding of ruleBindings) assertExactHeading(source, binding.ruleRef)

  return {
    taskBoundary,
    source: {
      path: 'AGENTS.md',
      algorithm: 'sha256',
      contentHash: createHash('sha256').update(bytes).digest('hex'),
    },
    ruleBindings,
  }
}

function parseObject(value: unknown, name: string): Record<string, unknown> {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${name} 必须是对象`)
  return value as Record<string, unknown>
}

function parseRuleBindings(value: unknown): InstructionRuleBinding[] {
  assert(Array.isArray(value), 'ruleBindings 必须是数组')
  const parsed = new Map<string, InstructionRuleBinding>()

  for (const rawBinding of value) {
    const binding = parseObject(rawBinding, '规则绑定')
    assert(typeof binding.ruleRef === 'string', '规则绑定 ruleRef 必须是字符串')
    const expected = KNOWN_RULE_BINDINGS.get(binding.ruleRef)
    assert(expected, `未知的规则绑定：${binding.ruleRef}`)
    assert(!parsed.has(binding.ruleRef), `规则绑定重复：${binding.ruleRef}`)
    assert(
      Array.isArray(binding.evidenceFields)
      && binding.evidenceFields.every((field) => typeof field === 'string'),
      `规则绑定 evidenceFields 无效：${binding.ruleRef}`,
    )
    assert.deepEqual(
      binding.evidenceFields,
      expected.evidenceFields,
      `规则绑定字段不匹配：${binding.ruleRef}`,
    )
    parsed.set(binding.ruleRef, cloneBinding(expected))
  }

  for (const binding of CORE_RULE_BINDINGS) {
    assert(parsed.has(binding.ruleRef), `缺少规则绑定：${binding.ruleRef}`)
  }

  return requiredBindings(parsed.has(STAGE_TRACE_RULE))
}

export function parseInstructionContext(value: unknown): InstructionContextReceipt {
  const raw = typeof value === 'string' ? JSON.parse(value) as unknown : value
  const receipt = parseObject(raw, '指令上下文')
  assert(typeof receipt.taskBoundary === 'string', 'taskBoundary 必须是字符串')
  const taskBoundary = receipt.taskBoundary.trim()
  assert(taskBoundary, '任务边界 trim 后不能为空')

  const source = parseObject(receipt.source, 'source')
  assert.equal(source.path, 'AGENTS.md', 'source.path 必须是 AGENTS.md')
  assert.equal(source.algorithm, 'sha256', 'source.algorithm 必须是 sha256')
  assert(
    typeof source.contentHash === 'string' && /^[a-f0-9]{64}$/.test(source.contentHash),
    'source.contentHash 必须是小写 SHA-256',
  )

  return {
    taskBoundary,
    source: {
      path: 'AGENTS.md',
      algorithm: 'sha256',
      contentHash: source.contentHash,
    },
    ruleBindings: parseRuleBindings(receipt.ruleBindings),
  }
}

export function instructionContextsEqual(
  left: InstructionContextReceipt,
  right: InstructionContextReceipt,
): boolean {
  return instructionContextJson(parseInstructionContext(left))
    === instructionContextJson(parseInstructionContext(right))
}

export function assertInstructionContextCurrent(
  receipt: InstructionContextReceipt,
  options: AssertInstructionContextCurrentOptions,
): void {
  const parsed = parseInstructionContext(receipt)
  const current = captureInstructionContext({
    workspace: options.workspace,
    taskBoundary: parsed.taskBoundary,
    requireStageTrace: options.requireStageTrace,
  })
  assert(
    instructionContextsEqual(parsed, current),
    '任务指令上下文已变化，现有收据已过期',
  )
}
