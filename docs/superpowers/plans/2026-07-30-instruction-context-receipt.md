# 任务收据指令上下文实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 让结构版本 2 的任务收据绑定根 `AGENTS.md`、任务边界和适用规则对应的既有证据，并在验证、交付和接受时拒绝过期或畸形上下文。

**架构：** 新增专注的 `instruction-context.ts` 负责根指令采集、原始字节哈希、规则绑定和时效比较；现有 `task-receipt.ts` 只负责把验证前后指令上下文纳入收据状态机并解析结构版本 2；CLI 在运行检查前完成前置校验，在交付和接受前重新核对当前指令。检查命令仍只保存在既有 `route` 和 `checks` 中。

**技术栈：** Node.js 24、TypeScript 原生类型剥离、`node:test`、`node:assert/strict`、Node `crypto` / `fs` / `path`、现有 CodeGraph 与 GitHub 收据机制。

---

## 文件结构

- 创建：`scripts/workflow-governance/instruction-context.ts`
  - 唯一职责：采集并验证根 `AGENTS.md` 指令上下文。
- 创建：`tests/workflow-governance/instruction-context.test.ts`
  - 唯一职责：覆盖哈希、路径边界、规则绑定和验证前后变化。
- 修改：`scripts/workflow-governance/task-receipt.ts`
  - 将收据升级到结构版本 2，增加运行时解析和指令上下文状态门禁。
- 修改：`tests/workflow-governance/task-receipt.test.ts`
  - 更新有效夹具并覆盖旧版、畸形收据和远端调用前失败。
- 修改：`scripts/task-completion-receipt.ts`
  - 接入 `--task-boundary`、验证前后双采集和交付前时效检查。
- 修改：`AGENTS.md`
  - 更新第 12.1 节权威命令示例。

### 任务 1：根指令采集与规则绑定

**文件：**
- 创建：`scripts/workflow-governance/instruction-context.ts`
- 创建：`tests/workflow-governance/instruction-context.test.ts`

- [ ] **步骤 1：编写有效采集和阶段条件绑定的失败测试**

```typescript
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  captureInstructionContext,
  instructionContextsEqual,
} from '../../scripts/workflow-governance/instruction-context.ts'

const agentsSource = [
  '# AGENTS.md',
  '## 12. CodeGraph 使用规则',
  '### 12.1 任务完成与交付收据',
  '### 12.2 Superpowers 最小阶段轨迹',
  '',
].join('\n')

test('根 AGENTS 原始字节哈希和规则绑定可恢复', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'instruction-context-'))
  test.after(() => rmSync(workspace, { recursive: true, force: true }))
  writeFileSync(join(workspace, 'AGENTS.md'), agentsSource)

  const context = captureInstructionContext({
    workspace,
    taskBoundary: '扩展任务收据，不修改业务页面',
    requireStageTrace: false,
  })

  assert.equal(context.source.path, 'AGENTS.md')
  assert.equal(context.source.algorithm, 'sha256')
  assert.equal(context.source.contentHash.length, 64)
  assert.deepEqual(context.ruleBindings.map((item) => item.evidenceFields), [
    ['codegraph'],
    ['revision', 'route', 'checks', 'codegraph'],
  ])
  assert(instructionContextsEqual(context, structuredClone(context)))
})

test('要求阶段轨迹时绑定 AGENTS 第 12.2 节', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'instruction-stage-'))
  test.after(() => rmSync(workspace, { recursive: true, force: true }))
  writeFileSync(join(workspace, 'AGENTS.md'), agentsSource)
  const context = captureInstructionContext({
    workspace,
    taskBoundary: '执行两阶段审查',
    requireStageTrace: true,
  })
  assert(context.ruleBindings.some((item) => item.evidenceFields.includes('stageTrace')))
})
```

- [ ] **步骤 2：运行测试并确认因模块不存在而失败**

运行：

```bash
node --experimental-strip-types --test tests/workflow-governance/instruction-context.test.ts
```

预期：FAIL，错误包含 `ERR_MODULE_NOT_FOUND`。

- [ ] **步骤 3：实现最小采集结构**

```typescript
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, realpathSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'

export type InstructionEvidenceField =
  | 'revision'
  | 'route'
  | 'checks'
  | 'codegraph'
  | 'stageTrace'

export interface InstructionRuleBinding {
  ruleRef: string
  evidenceFields: InstructionEvidenceField[]
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

const CODEGRAPH_RULE = 'AGENTS.md::## 12. CodeGraph 使用规则'
const RECEIPT_RULE = 'AGENTS.md::### 12.1 任务完成与交付收据'
const STAGE_RULE = 'AGENTS.md::### 12.2 Superpowers 最小阶段轨迹'

function isInsideWorkspace(workspace: string, candidate: string): boolean {
  const pathFromWorkspace = relative(workspace, candidate)
  return pathFromWorkspace !== '..'
    && !pathFromWorkspace.startsWith(`..${sep}`)
    && !isAbsolute(pathFromWorkspace)
}

function ruleBindings(requireStageTrace: boolean): InstructionRuleBinding[] {
  return [
    { ruleRef: CODEGRAPH_RULE, evidenceFields: ['codegraph'] },
    { ruleRef: RECEIPT_RULE, evidenceFields: ['revision', 'route', 'checks', 'codegraph'] },
    ...(requireStageTrace
      ? [{ ruleRef: STAGE_RULE, evidenceFields: ['stageTrace'] as InstructionEvidenceField[] }]
      : []),
  ].sort((left, right) => left.ruleRef.localeCompare(right.ruleRef))
}

export function captureInstructionContext(input: {
  workspace: string
  taskBoundary: string
  requireStageTrace: boolean
}): InstructionContextReceipt {
  const taskBoundary = input.taskBoundary.trim()
  assert(taskBoundary, '--task-boundary 不能为空')
  const workspace = realpathSync(resolve(input.workspace))
  const source = realpathSync(resolve(workspace, 'AGENTS.md'))
  assert(isInsideWorkspace(workspace, source), '根 AGENTS.md 不能逃逸当前工作区')
  const bytes = readFileSync(source)
  const text = bytes.toString('utf8')
  const bindings = ruleBindings(input.requireStageTrace)
  for (const binding of bindings) {
    const heading = binding.ruleRef.slice(binding.ruleRef.indexOf('::') + 2)
    assert(text.includes(heading), `AGENTS.md 缺少规则章节：${heading}`)
  }
  return {
    taskBoundary,
    source: {
      path: 'AGENTS.md',
      algorithm: 'sha256',
      contentHash: createHash('sha256').update(bytes).digest('hex'),
    },
    ruleBindings: bindings,
  }
}

export function instructionContextsEqual(
  left: InstructionContextReceipt,
  right: InstructionContextReceipt,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function objectValue(value: unknown, field: string): Record<string, unknown> {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${field} 格式无效`)
  return value as Record<string, unknown>
}

export function parseInstructionContext(value: unknown): InstructionContextReceipt {
  const parsed = objectValue(value, 'instructionContext')
  assert(typeof parsed.taskBoundary === 'string' && parsed.taskBoundary.trim(), '任务边界无效')
  const source = objectValue(parsed.source, 'instructionContext.source')
  assert.equal(source.path, 'AGENTS.md', '指令来源必须是根 AGENTS.md')
  assert.equal(source.algorithm, 'sha256', '指令哈希算法必须是 sha256')
  assert(
    typeof source.contentHash === 'string' && /^[a-f0-9]{64}$/.test(source.contentHash),
    '指令内容哈希无效',
  )
  assert(Array.isArray(parsed.ruleBindings), '指令规则绑定格式无效')
  const bindings = parsed.ruleBindings.map((item) => {
    const binding = objectValue(item, 'instructionContext.ruleBindings')
    assert(typeof binding.ruleRef === 'string', '指令规则引用无效')
    assert(
      Array.isArray(binding.evidenceFields)
        && binding.evidenceFields.every((field) => typeof field === 'string'),
      '指令证据字段无效',
    )
    return {
      ruleRef: binding.ruleRef,
      evidenceFields: binding.evidenceFields as InstructionEvidenceField[],
    }
  })
  const requireStageTrace = bindings.some((binding) => binding.ruleRef === STAGE_RULE)
  assert.deepEqual(bindings, ruleBindings(requireStageTrace), '指令规则绑定与项目规则不一致')
  return {
    taskBoundary: parsed.taskBoundary.trim(),
    source: {
      path: 'AGENTS.md',
      algorithm: 'sha256',
      contentHash: source.contentHash,
    },
    ruleBindings: bindings,
  }
}

export function assertInstructionContextCurrent(
  expected: InstructionContextReceipt,
  workspace: string,
): void {
  const current = captureInstructionContext({
    workspace,
    taskBoundary: expected.taskBoundary,
    requireStageTrace: expected.ruleBindings.some((binding) => binding.ruleRef === STAGE_RULE),
  })
  assert(instructionContextsEqual(expected, current), 'AGENTS 指令上下文已经过期')
}
```

- [ ] **步骤 4：增加路径逃逸、缺少章节和原始字节变化测试**

```typescript
test('根 AGENTS 符号链接不能逃逸工作区', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'instruction-link-'))
  const outside = mkdtempSync(join(tmpdir(), 'instruction-outside-'))
  test.after(() => {
    rmSync(workspace, { recursive: true, force: true })
    rmSync(outside, { recursive: true, force: true })
  })
  writeFileSync(join(outside, 'AGENTS.md'), agentsSource)
  symlinkSync(join(outside, 'AGENTS.md'), join(workspace, 'AGENTS.md'))
  assert.throws(
    () => captureInstructionContext({
      workspace,
      taskBoundary: '边界测试',
      requireStageTrace: false,
    }),
    /逃逸/,
  )
})

test('AGENTS 原始字节变化会改变指令上下文', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'instruction-bytes-'))
  test.after(() => rmSync(workspace, { recursive: true, force: true }))
  writeFileSync(join(workspace, 'AGENTS.md'), agentsSource)
  const before = captureInstructionContext({
    workspace,
    taskBoundary: '字节测试',
    requireStageTrace: false,
  })
  writeFileSync(join(workspace, 'AGENTS.md'), `${agentsSource}\n`)
  const after = captureInstructionContext({
    workspace,
    taskBoundary: '字节测试',
    requireStageTrace: false,
  })
  assert.equal(instructionContextsEqual(before, after), false)
})
```

- [ ] **步骤 5：运行专项测试并确认通过**

运行：

```bash
node --experimental-strip-types --test tests/workflow-governance/instruction-context.test.ts
```

预期：PASS，0 fail。

- [ ] **步骤 6：提交根指令采集单元**

```bash
git add scripts/workflow-governance/instruction-context.ts tests/workflow-governance/instruction-context.test.ts
git commit -m "feat: 增加任务指令上下文采集"
```

### 任务 2：结构版本 2 与运行时解析

**文件：**
- 修改：`scripts/workflow-governance/task-receipt.ts`
- 修改：`tests/workflow-governance/task-receipt.test.ts`

- [ ] **步骤 1：先把有效夹具升级为双指令上下文**

```typescript
const instructionContext = {
  taskBoundary: '扩展任务收据，不修改业务页面',
  source: {
    path: 'AGENTS.md' as const,
    algorithm: 'sha256' as const,
    contentHash: 'a'.repeat(64),
  },
  ruleBindings: [
    {
      ruleRef: 'AGENTS.md::## 12. CodeGraph 使用规则',
      evidenceFields: ['codegraph' as const],
    },
    {
      ruleRef: 'AGENTS.md::### 12.1 任务完成与交付收据',
      evidenceFields: ['revision' as const, 'route' as const, 'checks' as const, 'codegraph' as const],
    },
  ],
}

function validReceipt() {
  return createTaskReceipt({
    workspace: '/workspace',
    instructionBefore: instructionContext,
    instructionAfter: structuredClone(instructionContext),
    revisionBefore: revision,
    revisionAfter: revision,
    route,
    checks: [{
      command: 'npm run test:workflow-governance',
      exitCode: 0,
      startedAt: '2026-07-29T10:00:00.000Z',
      finishedAt: '2026-07-29T10:01:00.000Z',
      invariant: '工作流治理专项测试',
    }],
    codegraph: {
      syncExitCode: 0,
      before: {
        initialized: true,
        projectPath: '/workspace',
        pendingCount: 1,
        worktreeMismatch: false,
      },
      after: {
        initialized: true,
        projectPath: '/workspace',
        pendingCount: 0,
        worktreeMismatch: false,
      },
    },
  })
}
```

- [ ] **步骤 2：增加双上下文变化、旧版解析和远端调用前失败测试**

```typescript
test('验证期间 AGENTS 变化只能生成 implemented 收据', () => {
  const receipt = validReceipt()
  const blocked = createTaskReceipt({
    workspace: receipt.workspace,
    instructionBefore: receipt.instructionContext,
    instructionAfter: {
      ...receipt.instructionContext,
      source: { ...receipt.instructionContext.source, contentHash: 'b'.repeat(64) },
    },
    revisionBefore: revision,
    revisionAfter: revision,
    route,
    checks: receipt.checks,
    codegraph: receipt.codegraph,
  })
  assert.equal(blocked.state, 'implemented')
  assert(blocked.blockers.some((item) => item.includes('AGENTS')))
})

test('结构版本 1 和畸形收据在远端核验前失败', async () => {
  assert.throws(
    () => parseTaskCompletionReceipt(JSON.stringify({
      ...validReceipt(),
      schemaVersion: 1,
    })),
    /结构版本 2/,
  )
  let fetchCalled = false
  globalThis.fetch = (async () => {
    fetchCalled = true
    throw new Error('不应调用')
  }) as typeof fetch
  await assert.rejects(
    recordDelivery({ ...validReceipt(), schemaVersion: 1 } as never, {
      provider: 'github',
      target: 'owner/repository@main',
      revision: 'abc123',
      providerReceipt: 'https://github.com/owner/repository/commit/abc123',
    }),
    /结构版本 2/,
  )
  assert.equal(fetchCalled, false)
})
```

- [ ] **步骤 3：运行任务收据测试并确认先失败**

运行：

```bash
node --experimental-strip-types --test tests/workflow-governance/task-receipt.test.ts
```

预期：FAIL，至少包含 `instructionBefore`、`parseTaskCompletionReceipt` 或结构版本断言缺失。

- [ ] **步骤 4：升级收据类型和创建门禁**

```typescript
import {
  instructionContextsEqual,
  parseInstructionContext,
  type InstructionContextReceipt,
} from './instruction-context.ts'

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

interface CreateTaskReceiptInput {
  workspace: string
  instructionBefore: InstructionContextReceipt
  instructionAfter: InstructionContextReceipt
  revisionBefore: GitRevision
  revisionAfter: GitRevision
  route: AffectedCheckRoute
  checks: CheckReceipt[]
  codegraph: CodeGraphReceipt
  stageTrace?: StageTraceSummary
}

// createTaskReceipt 开始处
if (!instructionContextsEqual(input.instructionBefore, input.instructionAfter)) {
  blockers.push('AGENTS 指令上下文已变化，必须重新运行相关检查')
}
const stageTraceBound = input.instructionAfter.ruleBindings.some(
  (binding) => binding.evidenceFields.includes('stageTrace'),
)
if (stageTraceBound !== Boolean(input.stageTrace?.required)) {
  blockers.push('AGENTS Superpowers 规则绑定与阶段轨迹要求不一致')
}

// 返回值
schemaVersion: 2,
instructionContext: input.instructionAfter,
```

- [ ] **步骤 5：增加统一运行时解析和结构版本远端门禁**

```typescript
function objectValue(value: unknown, field: string): Record<string, unknown> {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${field} 格式无效`)
  return value as Record<string, unknown>
}

function stringArray(value: unknown, field: string): string[] {
  assert(Array.isArray(value) && value.every((item) => typeof item === 'string'), `${field} 格式无效`)
  return value
}

export function parseTaskCompletionReceipt(source: string): TaskCompletionReceipt {
  const parsed = objectValue(JSON.parse(source), '任务收据')
  assert.equal(parsed.schemaVersion, 2, '任务收据必须使用结构版本 2')
  assert(typeof parsed.workspace === 'string' && parsed.workspace, '任务收据缺少工作区')
  assert(typeof parsed.createdAt === 'string' && parsed.createdAt, '任务收据缺少创建时间')
  assert(['implemented', 'verified', 'delivered', 'accepted'].includes(String(parsed.state)), '任务收据状态无效')
  const instructionContext = parseInstructionContext(parsed.instructionContext)
  const revision = objectValue(parsed.revision, '任务收据 revision')
  assert(typeof revision.head === 'string' && typeof revision.diffHash === 'string', '任务收据 revision 无效')
  stringArray(revision.changedPaths, '任务收据 revision.changedPaths')
  assert(Array.isArray(parsed.checks), '任务收据 checks 格式无效')
  stringArray(parsed.blockers, '任务收据 blockers')
  objectValue(parsed.route, '任务收据 route')
  objectValue(parsed.codegraph, '任务收据 codegraph')
  return { ...parsed, instructionContext } as unknown as TaskCompletionReceipt
}

// recordDelivery 和 recordAcceptance 的第一行
assert.equal(receipt.schemaVersion, 2, '任务收据必须使用结构版本 2')
```

- [ ] **步骤 6：运行任务收据测试和全套治理测试**

运行：

```bash
node --experimental-strip-types --test tests/workflow-governance/task-receipt.test.ts
npm run test:workflow-governance
```

预期：全部 PASS，0 fail。

- [ ] **步骤 7：提交结构版本 2**

```bash
git add scripts/workflow-governance/task-receipt.ts tests/workflow-governance/task-receipt.test.ts
git commit -m "feat: 将任务收据升级为指令上下文版本"
```

### 任务 3：CLI 前置校验、双采集和权威命令

**文件：**
- 修改：`scripts/task-completion-receipt.ts`
- 修改：`AGENTS.md`
- 修改：`tests/workflow-governance/instruction-context.test.ts`

- [ ] **步骤 1：增加 AGENTS 权威示例失败测试**

```typescript
test('AGENTS 权威验证命令要求任务边界', () => {
  const agents = readFileSync(new URL('../../AGENTS.md', import.meta.url), 'utf8')
  assert(
    agents.includes(
      'npm run workflow:verify -- --output <临时目录>/task-receipt.json --task-boundary "<本次任务边界>"',
    ),
  )
})
```

- [ ] **步骤 2：运行测试并确认示例尚未更新**

运行：

```bash
node --experimental-strip-types --test tests/workflow-governance/instruction-context.test.ts
```

预期：FAIL，断言指出 AGENTS 不含新的权威命令。

- [ ] **步骤 3：在执行检查前采集任务参数和 instructionBefore**

```typescript
import {
  assertInstructionContextCurrent,
  captureInstructionContext,
} from './workflow-governance/instruction-context.ts'
import {
  assertReceiptCurrent,
  createTaskReceipt,
  parseCodeGraphStatus,
  parseTaskCompletionReceipt,
  recordAcceptance,
  recordDelivery,
  receiptValidationPaths,
  type CheckReceipt,
  type CodeGraphStatusReceipt,
  type GitRevision,
  type TaskCompletionReceipt,
} from './workflow-governance/task-receipt.ts'

const output = argument(args, '--output')
const taskBoundary = argument(args, '--task-boundary')
const workspace = process.cwd()
const stageTracePath = argument(args, '--stage-trace', false)
const requiredSkills = argument(args, '--required-skills', false)
  .split(',')
  .map((skill) => skill.trim())
  .filter(Boolean)
const requireTwoStageReview = args.includes('--require-two-stage-review')
const requireStageTrace = Boolean(
  stageTracePath || requiredSkills.length > 0 || requireTwoStageReview,
)
const instructionBefore = captureInstructionContext({
  workspace,
  taskBoundary,
  requireStageTrace,
})
const base = argument(args, '--base', false)
const paths = resolveVerificationPaths({
  base: base || undefined,
  explicitPaths: explicitPaths(args),
})
assert(paths.length > 0, '没有可验证的变更文件')
const route = routeAffectedChecks(paths)
const revisionBefore = gitRevision(paths)
const before = codegraphStatus()
```

- [ ] **步骤 4：检查完成后采集 instructionAfter 并写入收据**

```typescript
const instructionAfter = captureInstructionContext({
  workspace,
  taskBoundary,
  requireStageTrace,
})
const receipt = createTaskReceipt({
  workspace,
  instructionBefore,
  instructionAfter,
  revisionBefore,
  revisionAfter,
  route,
  checks,
  codegraph: {
    syncExitCode: sync.status ?? 1,
    before,
    after,
  },
  stageTrace,
})
```

- [ ] **步骤 5：让读取、交付和接受使用运行时解析及指令时效检查**

```typescript
function readReceipt(path: string): TaskCompletionReceipt {
  return parseTaskCompletionReceipt(readFileSync(resolve(path), 'utf8'))
}

// deliver 和 accept 在 assertReceiptCurrent 后调用
assertInstructionContextCurrent(receipt.instructionContext, receipt.workspace)
```

- [ ] **步骤 6：更新 AGENTS 权威命令**

````markdown
```bash
npm run workflow:verify -- --output <临时目录>/task-receipt.json --task-boundary "<本次任务边界>"
```
````

- [ ] **步骤 7：运行治理测试并确认通过**

运行：

```bash
npm run test:workflow-governance
```

预期：全部 PASS，0 fail。

- [ ] **步骤 8：提交 CLI 接线**

```bash
git add AGENTS.md scripts/task-completion-receipt.ts tests/workflow-governance/instruction-context.test.ts
git commit -m "feat: 将权威指令绑定任务验证流程"
```

### 任务 4：回归验证、阶段证据与最终收据

**文件：**
- 修改：实现或审查反馈直接涉及的上述文件
- 生成到临时目录：阶段轨迹、规格审查收据、代码质量审查收据、最终任务收据

- [ ] **步骤 1：运行完整治理回归**

运行：

```bash
npm run test:workflow-governance
npm run build
```

预期：治理测试 0 fail，构建退出码 0。

- [ ] **步骤 2：同步工作树本地 CodeGraph**

运行：

```bash
codegraph sync
codegraph status
```

预期：项目路径为当前 worktree、索引已初始化、待同步为 0、无工作树不匹配。

- [ ] **步骤 3：完成规格审查和代码质量审查**

审查必须覆盖：

- 规格审查：数据结构、快速失败、双采集、规则绑定、兼容边界全部落地。
- 代码质量审查：没有复制检查列表，没有工作区逃逸，没有在远端核验前接受旧版收据。

每次审查生成结构化 JSON 收据，至少包含：

```json
{
  "schemaVersion": 1,
  "reviewType": "spec-review",
  "revision": "<当前 Git HEAD>",
  "status": "pass",
  "findings": []
}
```

代码质量审查使用 `reviewType: "code-quality-review"`。如有实质修复，重新运行步骤 1 至步骤 3。

- [ ] **步骤 4：记录 Superpowers 阶段轨迹**

轨迹依次包含：

```text
trigger
skill-invocation
artifact
implementation
spec-review
code-quality-review
final-validation
```

其中技能调用引用当前 Codex provider session 中读取
`/Users/laoer/.codex/superpowers-zh/skills/test-driven-development/SKILL.md`
的真实工具事件；实现绑定当前 Git HEAD；审查和最终验证绑定各自结构化收据。

- [ ] **步骤 5：运行真实 workflow:verify**

运行：

```bash
npm run workflow:verify -- \
  --output <临时目录>/instruction-context-task-receipt.json \
  --task-boundary "扩展任务收据指令上下文，不修改业务页面" \
  --stage-trace <临时目录>/instruction-context-stage-trace.json \
  --required-skills superpowers-zh:test-driven-development \
  --require-two-stage-review
```

预期：输出状态 `verified`；收据结构版本为 2，包含根 AGENTS 哈希、三项规则绑定、最终 revision、实际检查结果和健康的 CodeGraph 收据。

- [ ] **步骤 6：验证旧收据会因实质变化失效**

在操作系统临时目录创建一份可恢复夹具，不改仓库文件：

```bash
cp <临时目录>/instruction-context-task-receipt.json <临时目录>/receipt-before-negative-check.json
```

通过自动测试中的 `instructionBefore/instructionAfter` 负例和 `assertReceiptCurrent` 负例确认失效语义；不得为了演示而污染真实工作树。

- [ ] **步骤 7：提交最终审查修复**

如步骤 3 没有产生改动，本步骤不创建空提交；如有改动：

```bash
git add <审查修复涉及的明确文件>
git commit -m "fix: 收紧任务指令上下文验证"
```

- [ ] **步骤 8：推送、创建 PR 并等待远端检查**

```bash
git push -u origin codex/instruction-context-receipt
gh pr create --base main --head codex/instruction-context-receipt \
  --title "feat: 绑定任务收据与 AGENTS 指令上下文" \
  --body-file <临时目录>/pr-body.md
```

预期：PR 创建成功，远端功能分支精确指向最终验证 SHA，必检状态通过。

- [ ] **步骤 9：按授权逐级记录 delivered 和 accepted**

先运行 `workflow:deliver`，确认 GitHub 提交和功能分支；再等待授权用户在 PR 中评论 `验收通过 <精确 SHA>`，取得规范 GitHub 评论 API URL 后运行 `workflow:accept`。

预期：同一份任务收据依次达到 `delivered` 和 `accepted`。只有此后才合并 PR。
