import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs, {
  chmodSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { tmpdir } from 'node:os'
import { delimiter, join, resolve } from 'node:path'
import test from 'node:test'
import {
  assertInstructionContextCurrent,
  captureInstructionContext,
  instructionContextsEqual,
  parseInstructionContext,
  type InstructionContextReceipt,
} from '../../scripts/workflow-governance/instruction-context.ts'

const CODEGRAPH_RULE = 'AGENTS.md::## 8. CodeGraph 与交付'
const RECEIPT_RULE = 'AGENTS.md::### 8.1 任务收据与交付状态'
const STAGE_TRACE_RULE = 'AGENTS.md::### 12.2 Superpowers 最小阶段轨迹'
const AUTHORITATIVE_VERIFY_COMMAND =
  'npm run workflow:verify -- --output <临时目录>/task-receipt.json --task-boundary "<本次任务边界>"'
const TASK_RECEIPT_CLI_SOURCE = readFileSync(
  join(process.cwd(), 'scripts/task-completion-receipt.ts'),
  'utf8',
)
const TASK_RECEIPT_CLI_PATH = join(process.cwd(), 'scripts/task-completion-receipt.ts')
const CLI_PROBE_PATH = 'src/pages/fcs/craft/cutting/supplement-management.ts'

const AGENTS_SOURCE = [
  '# AGENTS.md',
  '',
  '## 8. CodeGraph 与交付',
  '',
  '先同步并核对 CodeGraph。',
  '',
  '### 8.1 任务收据与交付状态',
  '',
  '任务完成前生成机器可读收据。',
  '',
  '### 12.2 Superpowers 最小阶段轨迹',
  '',
  '按要求保留阶段轨迹。',
  '',
].join('\n')

function workspaceWithAgents(t: test.TestContext, source = AGENTS_SOURCE): string {
  const workspace = mkdtempSync(join(tmpdir(), 'instruction-context-'))
  t.after(() => rmSync(workspace, { recursive: true, force: true }))
  writeFileSync(join(workspace, 'AGENTS.md'), source)
  return workspace
}

function validReceipt(t: test.TestContext): InstructionContextReceipt {
  return captureInstructionContext({
    workspace: workspaceWithAgents(t),
    taskBoundary: '  只修改任务指令上下文采集文件  ',
  })
}

function sourceBetween(start: string, end: string): string {
  const startIndex = TASK_RECEIPT_CLI_SOURCE.indexOf(start)
  const endIndex = TASK_RECEIPT_CLI_SOURCE.indexOf(end, startIndex + start.length)
  assert.notEqual(startIndex, -1, `缺少源码片段：${start}`)
  assert.notEqual(endIndex, -1, `缺少源码片段：${end}`)
  return TASK_RECEIPT_CLI_SOURCE.slice(startIndex, endIndex)
}

function assertSourceOrder(source: string, fragments: string[]): void {
  let previousIndex = -1
  for (const fragment of fragments) {
    const index = source.indexOf(fragment)
    assert.notEqual(index, -1, `缺少源码片段：${fragment}`)
    assert(index > previousIndex, `源码片段顺序错误：${fragment}`)
    previousIndex = index
  }
}

function runVerifyArgumentProbe(
  t: test.TestContext,
  args: string[],
): {
  status: number | null
  stdout: string
  stderr: string
  codegraphInvoked: boolean
  checkInvoked: boolean
} {
  const probeDirectory = mkdtempSync(join(tmpdir(), 'workflow-verify-args-'))
  const binDirectory = join(probeDirectory, 'bin')
  const codegraphMarker = join(probeDirectory, 'codegraph-invoked')
  const checkMarker = join(probeDirectory, 'check-invoked')
  mkdirSync(binDirectory)
  t.after(() => rmSync(probeDirectory, { recursive: true, force: true }))

  const codegraphCommand = join(binDirectory, 'codegraph')
  writeFileSync(codegraphCommand, [
    '#!/bin/sh',
    'printf invoked >> "$CODEGRAPH_MARKER"',
    'if [ "$1" = "status" ]; then',
    `  printf '%s\\n' '${JSON.stringify({
      initialized: true,
      projectPath: process.cwd(),
      pendingChanges: { added: 0, modified: 0, removed: 0 },
      worktreeMismatch: null,
    })}'`,
    'fi',
    '',
  ].join('\n'))
  chmodSync(codegraphCommand, 0o755)

  const npmCommand = join(binDirectory, 'npm')
  writeFileSync(npmCommand, [
    '#!/bin/sh',
    'printf invoked >> "$CHECK_MARKER"',
    '',
  ].join('\n'))
  chmodSync(npmCommand, 0o755)

  const result = spawnSync(
    process.execPath,
    ['--experimental-strip-types', TASK_RECEIPT_CLI_PATH, 'verify', ...args],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${binDirectory}${delimiter}${process.env.PATH ?? ''}`,
        CODEGRAPH_MARKER: codegraphMarker,
        CHECK_MARKER: checkMarker,
      },
    },
  )

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    codegraphInvoked: existsSync(codegraphMarker),
    checkInvoked: existsSync(checkMarker),
  }
}

function assertArgumentRejectedBeforeSideEffects(
  result: ReturnType<typeof runVerifyArgumentProbe>,
  message: RegExp,
  receiptPaths: string[],
): void {
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, message)
  assert.equal(result.stdout, '')
  assert.equal(result.codegraphInvoked, false)
  assert.equal(result.checkInvoked, false)
  for (const path of receiptPaths) assert.equal(existsSync(path), false)
}

test('根 AGENTS 8.1 精确给出绑定任务边界的权威验证命令', () => {
  const source = readFileSync(join(process.cwd(), 'AGENTS.md'), 'utf8')

  assert.match(
    source,
    new RegExp(`\\n${AUTHORITATIVE_VERIFY_COMMAND.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n`),
  )
})

test('verify 在任何检查前解析指令参数并采集前置指令上下文', () => {
  const source = sourceBetween('function verify(args: string[]): void {', '\nasync function deliver')

  assertSourceOrder(source, [
    "const output = argument(args, '--output')",
    "const taskBoundary = argument(args, '--task-boundary')",
    "const stageTracePath = argument(args, '--stage-trace', false)",
    "const requiredSkills = argument(args, '--required-skills', false)",
    "const requireTwoStageReview = args.includes('--require-two-stage-review')",
    'const requireStageTrace = requiredSkills.length > 0 || requireTwoStageReview',
    'const instructionBefore = captureInstructionContext({',
    'const paths = resolveVerificationPaths({',
    'const route = routeAffectedChecks(paths)',
    'const revisionBefore = gitRevision(paths)',
    'const before = codegraphStatus()',
    'const checks = commands.map((command) => runCheck(command, environment))',
  ])
  assert.match(source, /captureInstructionContext\(\{\s*workspace,\s*taskBoundary,\s*requireStageTrace,\s*\}\)/)
})

test('仅提供可选 stage-trace 路径不会把阶段轨迹变成必填', () => {
  const source = sourceBetween('function verify(args: string[]): void {', '\nasync function deliver')

  assert.match(
    source,
    /const requireStageTrace = requiredSkills\.length > 0 \|\| requireTwoStageReview/,
  )
  assert.doesNotMatch(source, /const requireStageTrace\s*=.*stageTracePath/)
})

test('verify 在检查和 CodeGraph 后再次采集指令上下文并写入收据', () => {
  const source = sourceBetween('function verify(args: string[]): void {', '\nasync function deliver')

  assertSourceOrder(source, [
    'const checks = commands.map((command) => runCheck(command, environment))',
    "const sync = spawnSync('codegraph', ['sync']",
    'const after = codegraphStatus()',
    'const revisionAfter = gitRevision(paths)',
    'const instructionAfter = captureInstructionContext({',
    'const receipt = createTaskReceipt({',
    'instructionBefore,',
    'instructionAfter,',
  ])
})

test('readReceipt 通过任务收据 parser 校验外部 JSON', () => {
  const source = sourceBetween(
    'function readReceipt(path: string): TaskCompletionReceipt {',
    '\nfunction verify',
  )

  assert.match(source, /return parseTaskCompletionReceipt\(readFileSync\(resolve\(path\), 'utf8'\)\)/)
  assert.doesNotMatch(source, /JSON\.parse/)
})

test('deliver 和 accept 在远端操作前重新确认指令上下文', () => {
  const deliverSource = sourceBetween('async function deliver', '\nasync function accept')
  const acceptSource = sourceBetween('async function accept', '\nconst [command')

  assertSourceOrder(deliverSource, [
    'assertReceiptCurrent(receipt, gitRevision(currentPaths))',
    'assertInstructionContextCurrent(receipt.instructionContext, {',
    'workspace: receipt.workspace,',
    'recordDelivery(receipt, {',
  ])
  assertSourceOrder(acceptSource, [
    'assertReceiptCurrent(receipt, gitRevision(currentPaths))',
    'assertInstructionContextCurrent(receipt.instructionContext, {',
    'workspace: receipt.workspace,',
    'recordAcceptance(receipt, {',
  ])
})

test('verify 拒绝把下一个选项误当作 output 或 task-boundary 的值', (t) => {
  const probeDirectory = mkdtempSync(join(tmpdir(), 'workflow-verify-next-option-'))
  const receiptPath = join(probeDirectory, 'task-receipt.json')
  const accidentalOutputPath = join(process.cwd(), '--task-boundary')
  assert.equal(existsSync(accidentalOutputPath), false)
  t.after(() => {
    rmSync(probeDirectory, { recursive: true, force: true })
    rmSync(accidentalOutputPath, { force: true })
  })

  const taskBoundaryResult = runVerifyArgumentProbe(t, [
    '--output',
    receiptPath,
    '--task-boundary',
    '--paths',
    CLI_PROBE_PATH,
  ])
  assertArgumentRejectedBeforeSideEffects(
    taskBoundaryResult,
    /--task-boundary.*不能为空/,
    [receiptPath],
  )

  const outputResult = runVerifyArgumentProbe(t, [
    '--output',
    '--task-boundary',
    '只验证 CLI 参数',
    '--paths',
    CLI_PROBE_PATH,
  ])
  assertArgumentRejectedBeforeSideEffects(
    outputResult,
    /--output.*不能为空/,
    [accidentalOutputPath],
  )
})

test('verify 拒绝必填参数的全空白值', (t) => {
  const probeDirectory = mkdtempSync(join(tmpdir(), 'workflow-verify-blank-value-'))
  const receiptPath = join(probeDirectory, 'task-receipt.json')
  const accidentalOutputPath = join(process.cwd(), ' \n\t ')
  assert.equal(existsSync(accidentalOutputPath), false)
  t.after(() => {
    rmSync(probeDirectory, { recursive: true, force: true })
    rmSync(accidentalOutputPath, { force: true })
  })

  const outputResult = runVerifyArgumentProbe(t, [
    '--output',
    ' \n\t ',
    '--task-boundary',
    '只验证 CLI 参数',
    '--paths',
    CLI_PROBE_PATH,
  ])
  assertArgumentRejectedBeforeSideEffects(
    outputResult,
    /--output.*不能为空/,
    [accidentalOutputPath],
  )

  const taskBoundaryResult = runVerifyArgumentProbe(t, [
    '--output',
    receiptPath,
    '--task-boundary',
    ' \n\t ',
    '--paths',
    CLI_PROBE_PATH,
  ])
  assertArgumentRejectedBeforeSideEffects(
    taskBoundaryResult,
    /--task-boundary.*不能为空/,
    [receiptPath],
  )
})

test('verify 拒绝重复的 output、task-boundary 和通用值参数', (t) => {
  const probeDirectory = mkdtempSync(join(tmpdir(), 'workflow-verify-duplicate-value-'))
  const firstReceiptPath = join(probeDirectory, 'first-receipt.json')
  const secondReceiptPath = join(probeDirectory, 'second-receipt.json')
  t.after(() => rmSync(probeDirectory, { recursive: true, force: true }))

  const cases = [
    {
      args: [
        '--output',
        firstReceiptPath,
        '--output',
        secondReceiptPath,
        '--task-boundary',
        '只验证 CLI 参数',
        '--paths',
        CLI_PROBE_PATH,
      ],
      message: /--output.*重复/,
      receipts: [firstReceiptPath, secondReceiptPath],
    },
    {
      args: [
        '--output',
        firstReceiptPath,
        '--task-boundary',
        '第一次',
        '--task-boundary',
        '第二次',
        '--paths',
        CLI_PROBE_PATH,
      ],
      message: /--task-boundary.*重复/,
      receipts: [firstReceiptPath],
    },
    {
      args: [
        '--output',
        firstReceiptPath,
        '--task-boundary',
        '只验证 CLI 参数',
        '--paths',
        CLI_PROBE_PATH,
        '--paths',
        CLI_PROBE_PATH,
      ],
      message: /--paths.*重复/,
      receipts: [firstReceiptPath],
    },
  ]

  for (const testCase of cases) {
    assertArgumentRejectedBeforeSideEffects(
      runVerifyArgumentProbe(t, testCase.args),
      testCase.message,
      testCase.receipts,
    )
  }
})

test('采集不含阶段轨迹的根 AGENTS 指令上下文', (t) => {
  const workspace = workspaceWithAgents(t)
  const receipt = captureInstructionContext({
    workspace,
    taskBoundary: '  只修改任务指令上下文采集文件  ',
  })

  assert.equal(receipt.taskBoundary, '只修改任务指令上下文采集文件')
  assert.deepEqual(receipt.source, {
    path: 'AGENTS.md',
    algorithm: 'sha256',
    contentHash: createHash('sha256').update(readFileSync(join(workspace, 'AGENTS.md'))).digest('hex'),
  })
  assert.deepEqual(receipt.ruleBindings, [
    { ruleRef: CODEGRAPH_RULE, evidenceFields: ['codegraph'] },
    {
      ruleRef: RECEIPT_RULE,
      evidenceFields: ['revision', 'route', 'checks', 'codegraph'],
    },
  ])
  assert.deepEqual(parseInstructionContext(JSON.stringify(receipt)), receipt)
  assert.equal(instructionContextsEqual(receipt, structuredClone(receipt)), true)
})

test('要求阶段轨迹时加入对应规则绑定且顺序稳定', (t) => {
  const workspace = workspaceWithAgents(t)
  const first = captureInstructionContext({
    workspace,
    taskBoundary: '执行任务 1',
    requireStageTrace: true,
  })
  const second = captureInstructionContext({
    workspace,
    taskBoundary: '执行任务 1',
    requireStageTrace: true,
  })

  assert.deepEqual(first.ruleBindings, [
    { ruleRef: CODEGRAPH_RULE, evidenceFields: ['codegraph'] },
    {
      ruleRef: RECEIPT_RULE,
      evidenceFields: ['revision', 'route', 'checks', 'codegraph'],
    },
    { ruleRef: STAGE_TRACE_RULE, evidenceFields: ['stageTrace'] },
  ])
  assert.deepEqual(first, second)
  assert.equal(instructionContextsEqual(first, second), true)
})

test('任务边界 trim 后为空时拒绝采集', (t) => {
  assert.throws(
    () => captureInstructionContext({
      workspace: workspaceWithAgents(t),
      taskBoundary: ' \n\t ',
    }),
    /任务边界.*不能为空/,
  )
})

test('根 AGENTS 缺少精确章节标题时拒绝采集', (t) => {
  const workspace = workspaceWithAgents(
    t,
    AGENTS_SOURCE.replace('### 8.1 任务收据与交付状态', '### 8.1 任务收据和交付状态'),
  )

  assert.throws(
    () => captureInstructionContext({ workspace, taskBoundary: '执行任务 1' }),
    /### 8\.1 任务收据与交付状态/,
  )
})

test('根 AGENTS 使用原始字节计算 SHA-256', (t) => {
  const lfWorkspace = workspaceWithAgents(t, AGENTS_SOURCE)
  const crlfWorkspace = workspaceWithAgents(t, AGENTS_SOURCE.replaceAll('\n', '\r\n'))

  const lf = captureInstructionContext({
    workspace: lfWorkspace,
    taskBoundary: '执行任务 1',
  })
  const crlf = captureInstructionContext({
    workspace: crlfWorkspace,
    taskBoundary: '执行任务 1',
  })

  assert.notEqual(lf.source.contentHash, crlf.source.contentHash)
  assert.equal(
    crlf.source.contentHash,
    createHash('sha256').update(readFileSync(join(crlfWorkspace, 'AGENTS.md'))).digest('hex'),
  )
})

test('根 AGENTS 符号链接 realpath 逃逸工作区时拒绝采集', (t) => {
  const workspace = mkdtempSync(join(tmpdir(), 'instruction-context-workspace-'))
  const outside = mkdtempSync(join(tmpdir(), 'instruction-context-outside-'))
  t.after(() => {
    rmSync(workspace, { recursive: true, force: true })
    rmSync(outside, { recursive: true, force: true })
  })
  writeFileSync(join(outside, 'AGENTS.md'), AGENTS_SOURCE)
  symlinkSync(join(outside, 'AGENTS.md'), join(workspace, 'AGENTS.md'))

  assert.throws(
    () => captureInstructionContext({ workspace, taskBoundary: '执行任务 1' }),
    /根 AGENTS|符号链接|工作区/,
  )
})

test('根 AGENTS 即使指向工作区内文件也拒绝符号链接', (t) => {
  const workspace = mkdtempSync(join(tmpdir(), 'instruction-context-inside-symlink-'))
  t.after(() => rmSync(workspace, { recursive: true, force: true }))
  writeFileSync(join(workspace, 'agents-source.md'), AGENTS_SOURCE)
  symlinkSync(join(workspace, 'agents-source.md'), join(workspace, 'AGENTS.md'))

  assert.throws(
    () => captureInstructionContext({ workspace, taskBoundary: '执行任务 1' }),
    /根 AGENTS|符号链接/,
  )
})

test('根 AGENTS 缺失或不是常规文件时失败关闭', (t) => {
  const missingWorkspace = mkdtempSync(join(tmpdir(), 'instruction-context-missing-'))
  const directoryWorkspace = mkdtempSync(join(tmpdir(), 'instruction-context-directory-'))
  t.after(() => {
    rmSync(missingWorkspace, { recursive: true, force: true })
    rmSync(directoryWorkspace, { recursive: true, force: true })
  })
  mkdirSync(join(directoryWorkspace, 'AGENTS.md'))

  assert.throws(
    () => captureInstructionContext({ workspace: missingWorkspace, taskBoundary: '执行任务 1' }),
    /根 AGENTS/,
  )
  assert.throws(
    () => captureInstructionContext({ workspace: directoryWorkspace, taskBoundary: '执行任务 1' }),
    /根 AGENTS/,
  )
})

test('根 AGENTS 在解析或安全打开后被替换时拒绝读取越界文件', (t) => {
  const workspace = mkdtempSync(join(tmpdir(), 'instruction-context-race-workspace-'))
  const outside = mkdtempSync(join(tmpdir(), 'instruction-context-race-outside-'))
  const canonicalWorkspace = fs.realpathSync(workspace)
  const agentsPath = join(canonicalWorkspace, 'AGENTS.md')
  const originalAgentsPath = join(canonicalWorkspace, 'AGENTS.original.md')
  const outsideAgentsPath = join(outside, 'AGENTS.md')
  t.after(() => {
    rmSync(workspace, { recursive: true, force: true })
    rmSync(outside, { recursive: true, force: true })
  })
  writeFileSync(agentsPath, AGENTS_SOURCE)
  writeFileSync(outsideAgentsPath, `${AGENTS_SOURCE}\n越界内容\n`)

  const originalRealpathSync = fs.realpathSync
  const originalOpenSync = fs.openSync
  let replaced = false
  const replaceWithOutsideSymlink = () => {
    if (replaced) return
    fs.renameSync(agentsPath, originalAgentsPath)
    fs.symlinkSync(outsideAgentsPath, agentsPath)
    replaced = true
  }

  Object.defineProperty(fs, 'realpathSync', {
    configurable: true,
    writable: true,
    value: (...args: unknown[]) => {
      const result = Reflect.apply(originalRealpathSync, fs, args)
      if (typeof args[0] === 'string' && resolve(args[0]) === agentsPath) {
        replaceWithOutsideSymlink()
      }
      return result
    },
  })
  Object.defineProperty(fs, 'openSync', {
    configurable: true,
    writable: true,
    value: (...args: unknown[]) => {
      const descriptor = Reflect.apply(originalOpenSync, fs, args)
      if (typeof args[0] === 'string' && resolve(args[0]) === agentsPath) {
        replaceWithOutsideSymlink()
      }
      return descriptor
    },
  })
  syncBuiltinESMExports()

  try {
    assert.throws(
      () => captureInstructionContext({ workspace, taskBoundary: '执行任务 1' }),
      /根 AGENTS/,
    )
    assert.equal(replaced, true, '竞争探针必须实际完成根 AGENTS 替换')
  } finally {
    Object.defineProperty(fs, 'realpathSync', {
      configurable: true,
      writable: true,
      value: originalRealpathSync,
    })
    Object.defineProperty(fs, 'openSync', {
      configurable: true,
      writable: true,
      value: originalOpenSync,
    })
    syncBuiltinESMExports()
  }
})

test('parser 拒绝错误 algorithm、hash、未知及缺失规则绑定', (t) => {
  const receipt = validReceipt(t)

  assert.throws(
    () => parseInstructionContext({
      ...receipt,
      source: { ...receipt.source, algorithm: 'sha1' },
    }),
    /algorithm|sha256/,
  )
  assert.throws(
    () => parseInstructionContext({
      ...receipt,
      source: { ...receipt.source, contentHash: 'not-a-hash' },
    }),
    /contentHash|SHA-256/,
  )
  assert.throws(
    () => parseInstructionContext({
      ...receipt,
      ruleBindings: [
        ...receipt.ruleBindings,
        { ruleRef: 'AGENTS.md::## 未知规则', evidenceFields: ['checks'] },
      ],
    }),
    /未知.*规则绑定/,
  )
  assert.throws(
    () => parseInstructionContext({
      ...receipt,
      ruleBindings: receipt.ruleBindings.slice(1),
    }),
    /缺少.*规则绑定/,
  )
})

test('parser 拒绝错误 source path 和规则字段映射', (t) => {
  const receipt = validReceipt(t)

  assert.throws(
    () => parseInstructionContext({
      ...receipt,
      source: { ...receipt.source, path: 'docs/AGENTS.md' },
    }),
    /source\.path|AGENTS\.md/,
  )
  assert.throws(
    () => parseInstructionContext({
      ...receipt,
      ruleBindings: receipt.ruleBindings.map((binding) => (
        binding.ruleRef === RECEIPT_RULE
          ? { ...binding, evidenceFields: ['revision', 'checks'] }
          : binding
      )),
    }),
    /规则绑定.*不匹配/,
  )
})

test('parser 拒绝乱序的核心规则绑定', (t) => {
  const receipt = validReceipt(t)

  assert.throws(
    () => parseInstructionContext({
      ...receipt,
      ruleBindings: [...receipt.ruleBindings].reverse(),
    }),
    /规则绑定顺序/,
  )
})

test('当前断言会重新采集并拒绝原始 AGENTS 字节变化', (t) => {
  const workspace = workspaceWithAgents(t)
  const receipt = captureInstructionContext({
    workspace,
    taskBoundary: '执行任务 1',
  })
  assert.doesNotThrow(() => assertInstructionContextCurrent(receipt, { workspace }))

  writeFileSync(join(workspace, 'AGENTS.md'), `${AGENTS_SOURCE}\n`)

  assert.throws(
    () => assertInstructionContextCurrent(receipt, { workspace }),
    /指令上下文.*已变化|过期/,
  )
})

test('仅阶段轨迹要求变化也会使当前断言失效', (t) => {
  const workspace = workspaceWithAgents(t)
  const receipt = captureInstructionContext({
    workspace,
    taskBoundary: '执行任务 1',
  })

  assert.throws(
    () => assertInstructionContextCurrent(receipt, {
      workspace,
      requireStageTrace: true,
    }),
    /指令上下文.*已变化|过期/,
  )
})
