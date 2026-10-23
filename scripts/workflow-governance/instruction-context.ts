import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  realpathSync,
  type BigIntStats,
} from 'node:fs'
import { resolve } from 'node:path'

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

const DELEGATED_RULE_PATHS = [
  'docs/agent-rules/storage.md',
  'docs/agent-rules/interface.md',
  'docs/agent-rules/verification.md',
] as const

interface DelegatedInstructionSource {
  path: typeof DELEGATED_RULE_PATHS[number]
  algorithm: 'sha256'
  contentHash: string
}

export interface InstructionContextReceipt {
  taskBoundary: string
  source: {
    path: 'AGENTS.md'
    algorithm: 'sha256'
    contentHash: string
  }
  delegatedSources?: DelegatedInstructionSource[]
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

const CODEGRAPH_RULE = 'AGENTS.md::TOOL-01'
const RECEIPT_RULE = 'AGENTS.md::RECEIPT-01'
const STAGE_TRACE_RULE = 'AGENTS.md::### 12.2 Superpowers 最小阶段轨迹'

const CORE_RULE_BINDINGS: readonly InstructionRuleBinding[] = [
  { ruleRef: CODEGRAPH_RULE, evidenceFields: ['codegraph'] },
  {
    ruleRef: RECEIPT_RULE,
    evidenceFields: ['revision', 'route', 'checks', 'codegraph'],
  },
]

// Historical receipts remain readable, but cannot pass a current-context check.
const LEGACY_CORE_BINDINGS: readonly InstructionRuleBinding[] = [
  { ruleRef: 'AGENTS.md::## 8. CodeGraph 与交付', evidenceFields: ['codegraph'] },
  { ruleRef: 'AGENTS.md::### 8.1 任务收据与交付状态', evidenceFields: ['revision', 'route', 'checks', 'codegraph'] },
]

const STAGE_TRACE_BINDING: InstructionRuleBinding = {
  ruleRef: STAGE_TRACE_RULE,
  evidenceFields: ['stageTrace'],
}

const KNOWN_RULE_BINDINGS = new Map(
  [...CORE_RULE_BINDINGS, ...LEGACY_CORE_BINDINGS, STAGE_TRACE_BINDING]
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
  if (!heading.startsWith('#')) {
    const definitions = source.split(/\r?\n/).filter((line) => line.startsWith(`**${heading}：`))
    assert.equal(definitions.length, 1, `根 AGENTS.md 缺少或重复稳定规则：${heading}`)
    return
  }
  assert(
    source.split(/\r?\n/).includes(heading),
    `根 AGENTS.md 缺少精确标题：${heading}`,
  )
}

function openWithoutFollowingLinks(path: string, label: string): number {
  try {
    return openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW)
  } catch (error) {
    throw new Error(`${label} 必须存在且不能是符号链接`, { cause: error })
  }
}

function currentPathIdentity(path: string, label: string): BigIntStats {
  try {
    return lstatSync(path, { bigint: true })
  } catch (error) {
    throw new Error(`${label} 路径身份无法确认`, { cause: error })
  }
}

function assertSameDirectory(
  opened: BigIntStats,
  current: BigIntStats,
  label: string,
): void {
  assert(opened.isDirectory(), `${label} 必须是目录`)
  assert(current.isDirectory() && !current.isSymbolicLink(), `${label} 必须保持为真实目录`)
  assert(
    opened.dev === current.dev && opened.ino === current.ino,
    `${label} 路径身份已变化`,
  )
}

function assertSameRegularFile(
  opened: BigIntStats,
  current: BigIntStats,
  label: string,
): void {
  assert(opened.isFile(), `${label} 必须是常规文件`)
  assert(current.isFile() && !current.isSymbolicLink(), `${label} 必须保持为常规文件`)
  assert(
    opened.dev === current.dev && opened.ino === current.ino,
    `${label} 文件身份已变化`,
  )
}

function readInstructionFile(workspace: string, relativePath: string, label: string): Buffer {
  const path = resolve(workspace, relativePath)
  const directories: { path: string; label: string; descriptor: number; identity: BigIntStats }[] = []
  let fileDescriptor: number | undefined
  try {
    const directoryPaths = [workspace]
    for (const segment of relativePath.split('/').slice(0, -1)) {
      directoryPaths.push(resolve(directoryPaths.at(-1)!, segment))
    }
    for (const directoryPath of directoryPaths) {
      const directoryLabel = directoryPath === workspace ? '工作区根目录' : `专项规则目录 ${directoryPath}`
      const descriptor = openWithoutFollowingLinks(directoryPath, directoryLabel)
      const identity = fstatSync(descriptor, { bigint: true })
      directories.push({ path: directoryPath, label: directoryLabel, descriptor, identity })
      assertSameDirectory(identity, currentPathIdentity(directoryPath, directoryLabel), directoryLabel)
    }

    fileDescriptor = openWithoutFollowingLinks(path, label)
    const openedFile = fstatSync(fileDescriptor, { bigint: true })
    assertSameRegularFile(
      openedFile,
      currentPathIdentity(path, label),
      label,
    )
    for (const directory of directories) {
      assertSameDirectory(directory.identity, currentPathIdentity(directory.path, directory.label), directory.label)
    }

    const bytes = readFileSync(fileDescriptor)
    assertSameRegularFile(
      openedFile,
      currentPathIdentity(path, label),
      label,
    )
    for (const directory of directories) {
      assertSameDirectory(directory.identity, currentPathIdentity(directory.path, directory.label), directory.label)
    }
    return bytes
  } finally {
    if (fileDescriptor !== undefined) closeSync(fileDescriptor)
    for (const directory of directories.reverse()) closeSync(directory.descriptor)
  }
}

function declaredDelegatedRulePaths(source: string): DelegatedInstructionSource['path'][] {
  return DELEGATED_RULE_PATHS.filter((path) => {
    const target = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(?<!!)\\[[^\\]\\r\\n]+\\]\\(\\s*(?:${target}|<${target}>)(?:\\s+"[^"\\r\\n]*")?\\s*\\)`).test(source)
  })
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
  const bytes = readInstructionFile(workspace, 'AGENTS.md', '根 AGENTS.md')
  const ruleBindings = requiredBindings(options.requireStageTrace === true)
  const source = bytes.toString('utf8')
  for (const binding of ruleBindings) assertExactHeading(source, binding.ruleRef)
  const delegatedSources = declaredDelegatedRulePaths(source).map((path): DelegatedInstructionSource => ({
    path,
    algorithm: 'sha256',
    contentHash: createHash('sha256')
      .update(readInstructionFile(workspace, path, `专项规则 ${path}`))
      .digest('hex'),
  }))

  return {
    taskBoundary,
    source: {
      path: 'AGENTS.md',
      algorithm: 'sha256',
      contentHash: createHash('sha256').update(bytes).digest('hex'),
    },
    ...(delegatedSources.length ? { delegatedSources } : {}),
    ruleBindings,
  }
}

function parseObject(value: unknown, name: string): Record<string, unknown> {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${name} 必须是对象`)
  return value as Record<string, unknown>
}

function parseDelegatedSources(value: unknown): DelegatedInstructionSource[] {
  assert(Array.isArray(value) && value.length > 0, 'delegatedSources 必须是非空数组')
  const paths = new Set<string>()
  const sources = value.map((rawSource): DelegatedInstructionSource => {
    const source = parseObject(rawSource, '专项规则来源')
    assert(
      typeof source.path === 'string' && (DELEGATED_RULE_PATHS as readonly string[]).includes(source.path),
      'delegatedSources.path 必须是已知的专项规则路径',
    )
    assert(!paths.has(source.path), `专项规则来源重复：${source.path}`)
    paths.add(source.path)
    assert.equal(source.algorithm, 'sha256', 'delegatedSources.algorithm 必须是 sha256')
    assert(
      typeof source.contentHash === 'string' && /^[a-f0-9]{64}$/.test(source.contentHash),
      'delegatedSources.contentHash 必须是小写 SHA-256',
    )
    return {
      path: source.path as DelegatedInstructionSource['path'],
      algorithm: 'sha256',
      contentHash: source.contentHash,
    }
  })
  assert.deepEqual(
    sources.map((source) => source.path),
    DELEGATED_RULE_PATHS.filter((path) => paths.has(path)),
    '专项规则来源顺序必须与约定一致',
  )
  return sources
}

function parseRuleBindings(value: unknown): InstructionRuleBinding[] {
  assert(Array.isArray(value), 'ruleBindings 必须是数组')
  const parsed = new Map<string, InstructionRuleBinding>()
  const inputRuleRefs: string[] = []

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
    inputRuleRefs.push(binding.ruleRef)
  }

  const core = parsed.has(CODEGRAPH_RULE) ? CORE_RULE_BINDINGS : LEGACY_CORE_BINDINGS
  for (const binding of core) {
    assert(parsed.has(binding.ruleRef), `缺少规则绑定：${binding.ruleRef}`)
  }

  const requireStageTrace = parsed.has(STAGE_TRACE_RULE)
  const expectedRuleRefs = [
    ...core.map((binding) => binding.ruleRef),
    ...(requireStageTrace ? [STAGE_TRACE_RULE] : []),
  ]
  assert.deepEqual(
    inputRuleRefs,
    expectedRuleRefs,
    '规则绑定顺序必须与约定一致，不得混用新旧规则',
  )
  return [...core.map(cloneBinding), ...(requireStageTrace ? [cloneBinding(STAGE_TRACE_BINDING)] : [])]
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
    ...(receipt.delegatedSources === undefined
      ? {}
      : { delegatedSources: parseDelegatedSources(receipt.delegatedSources) }),
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
