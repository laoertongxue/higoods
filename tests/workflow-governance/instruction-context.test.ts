import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  assertInstructionContextCurrent,
  captureInstructionContext,
  instructionContextsEqual,
  parseInstructionContext,
  type InstructionContextReceipt,
} from '../../scripts/workflow-governance/instruction-context.ts'

const CODEGRAPH_RULE = 'AGENTS.md::## 12. CodeGraph 使用规则'
const RECEIPT_RULE = 'AGENTS.md::### 12.1 任务完成与交付收据'
const STAGE_TRACE_RULE = 'AGENTS.md::### 12.2 Superpowers 最小阶段轨迹'

const AGENTS_SOURCE = [
  '# AGENTS.md',
  '',
  '## 12. CodeGraph 使用规则',
  '',
  '先同步并核对 CodeGraph。',
  '',
  '### 12.1 任务完成与交付收据',
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
    AGENTS_SOURCE.replace('### 12.1 任务完成与交付收据', '### 12.1 任务完成和交付收据'),
  )

  assert.throws(
    () => captureInstructionContext({ workspace, taskBoundary: '执行任务 1' }),
    /### 12\.1 任务完成与交付收据/,
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
    /工作区/,
  )
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
