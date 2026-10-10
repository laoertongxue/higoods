import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { assertWorkflowPolicyAllows } from '../../scripts/workflow-governance/disabled-workflows.ts'
import { validateStageTrace } from '../../scripts/workflow-governance/stage-trace.ts'

const root = fileURLToPath(new URL('../../', import.meta.url))
const disabledRule = '**METHOD-01：Superpowers 项目级默认禁用。**'
// Include the old heading deliberately: rejection must come from METHOD-01,
// not a later missing-heading failure in instruction-context validation.
const agents = `${disabledRule}
**TOOL-01：按需同步 CodeGraph。**
**RECEIPT-01：按范围生成技术收据。**
### 12.2 Superpowers 最小阶段轨迹
历史轨迹保留供兼容解析。
`

function fixture(t: test.TestContext, source = agents) {
  const workspace = mkdtempSync(join(tmpdir(), 'disabled-workflow-'))
  t.after(() => rmSync(workspace, { recursive: true, force: true }))
  execFileSync('git', ['init', '-q', workspace])
  writeFileSync(join(workspace, 'AGENTS.md'), source)
  const trace = join(workspace, 'existing-trace.json')
  const original = '[{"sentinel":"preserve original trace"}]\n'
  writeFileSync(trace, original)
  const output = join(workspace, 'never-created', 'receipt.json')
  const bin = join(workspace, 'bin')
  const marker = join(workspace, 'external-command-invoked')
  mkdirSync(bin)
  for (const command of ['git', 'npm', 'codegraph']) {
    const file = join(bin, command)
    writeFileSync(file, '#!/bin/sh\nprintf invoked >> "$WORKFLOW_SIDE_EFFECT_MARKER"\nexit 88\n')
    chmodSync(file, 0o755)
  }
  const run = (file: string, args: string[]) => spawnSync(process.execPath, [
    '--experimental-strip-types', join(root, 'scripts', file), ...args,
  ], {
    cwd: workspace,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH ?? ''}`, WORKFLOW_SIDE_EFFECT_MARKER: marker },
  })
  const assertNoEffects = () => {
    assert.equal(existsSync(marker), false, '不应调用 Git、npm 或 CodeGraph')
    assert.equal(existsSync(join(workspace, 'never-created')), false, '不应创建输出目录')
    assert.equal(readFileSync(trace, 'utf8'), original, '既有轨迹须保持原字节')
  }
  return { workspace, trace, output, run, assertNoEffects }
}

test('METHOD-01 禁用时 verify 拒绝三类阶段选项及等号形式，且无副作用', (t) => {
  const env = fixture(t)
  const probes = [
    ['--stage-trace', env.trace],
    [`--stage-trace=${env.trace}`],
    ['--required-skills', 'superpowers:writing-plans'],
    ['--required-skills=superpowers:writing-plans'],
    ['--require-two-stage-review'],
    ['--require-two-stage-review=false'],
  ]
  for (const options of probes) {
    const result = env.run('task-completion-receipt.ts', [
      'verify', '--output', env.output, '--task-boundary', '只测试误启用阻断', '--paths', 'src/example.ts', ...options,
    ])
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /METHOD-01：本项目已禁用 Superpowers 阶段工作流/)
    assert.match(result.stderr, new RegExp(options[0].split('=')[0]))
    assert.equal(result.stdout, '')
    env.assertNoEffects()
  }
})

test('deliver 和 accept 也不能夹带被禁用选项绕过 CLI 策略', (t) => {
  const env = fixture(t)
  for (const command of ['deliver', 'accept']) {
    const result = env.run('task-completion-receipt.ts', [command, '--stage-trace', env.trace])
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /本项目已禁用 Superpowers 阶段工作流/)
    env.assertNoEffects()
  }
})

test('直接运行阶段记录 CLI 在解析或写入既有轨迹之前明确拒绝', (t) => {
  const env = fixture(t)
  const result = env.run('record-workflow-stage.ts', [
    '--trace', env.trace, '--stage', 'skill', '--skill', 'superpowers:writing-plans',
    '--summary', '误入旧 CLI', '--evidence-ref', 'unreadable-evidence',
  ])
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /本项目已禁用 Superpowers 阶段工作流.*record-workflow-stage/)
  assert.equal(result.stdout, '')
  env.assertNoEffects()
})

test('阶段记录 CLI 在创建新轨迹目录之前拒绝', (t) => {
  const env = fixture(t)
  const result = env.run('record-workflow-stage.ts', ['--trace', env.output])
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /本项目已禁用 Superpowers 阶段工作流/)
  env.assertNoEffects()
})

test('没有阶段选项的普通技术收据不被误禁用', (t) => {
  const env = fixture(t)
  assert.doesNotThrow(() => assertWorkflowPolicyAllows(env.workspace, ['--output', env.output]))
  env.assertNoEffects()
})

test('缺失 METHOD-01 时不能把旧规范当作阶段 CLI 默认授权', (t) => {
  const env = fixture(t, agents.replace(disabledRule, ''))
  for (const args of [['--stage-trace', env.trace], ['--required-skills=x'], ['--require-two-stage-review']]) {
    assert.throws(() => assertWorkflowPolicyAllows(env.workspace, args), /METHOD-01.*缺失/)
  }
  for (const [file, args] of [
    ['task-completion-receipt.ts', ['verify', '--stage-trace', env.trace]],
    ['record-workflow-stage.ts', ['--trace', env.output]],
  ] as const) {
    const result = env.run(file, [...args])
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /METHOD-01.*缺失/)
    env.assertNoEffects()
  }
})

test('畸形、未知、示例代码或注释中的策略均不能启用阶段 CLI', (t) => {
  const variants = [
    '**METHOD-01：Superpowers 项目级明确启用。',
    '**METHOD-01：Superpowers 未知。**',
    '**METHOD-01：Superpowers 未禁用。**',
    '**METHOD-01：其他工作流已启用。**',
    '```md\n**METHOD-01：Superpowers 项目级明确启用。**\n```',
    '<!-- **METHOD-01：Superpowers 项目级明确启用。** -->',
  ]
  for (const replacement of variants) {
    const env = fixture(t, agents.replace(disabledRule, replacement))
    assert.throws(() => assertWorkflowPolicyAllows(env.workspace, ['--stage-trace', env.trace]), /METHOD-01/)
    env.assertNoEffects()
  }
})

test('仅唯一明确启用策略允许进入阶段 CLI 的后续校验', (t) => {
  const env = fixture(t, agents.replace(disabledRule, '**METHOD-01：Superpowers 项目级明确启用。**'))
  assert.doesNotThrow(() => assertWorkflowPolicyAllows(env.workspace, ['--stage-trace', env.trace]))
  assert.doesNotThrow(() => assertWorkflowPolicyAllows(env.workspace, [], true))
  env.assertNoEffects()
})

test('历史轨迹 JSON 的只读解析不依赖启用当前 CLI 策略', (t) => {
  const env = fixture(t, agents.replace(disabledRule, ''))
  const events = JSON.parse('[{"stage":"trigger","timestamp":"2026-01-01T00:00:00.000Z","summary":"历史确认","evidenceRef":"conversation:historical-approval"}]')
  const summary = validateStageTrace(events, { requiredSkills: [], requireTwoStageReview: false }, { cwd: env.workspace })
  assert.equal(summary.valid, true)
  assert.deepEqual(summary.stages, ['trigger'])
  env.assertNoEffects()
})

test('无法读取项目策略时阶段入口失败关闭，不创建轨迹', (t) => {
  const env = fixture(t)
  rmSync(join(env.workspace, 'AGENTS.md'))
  const result = env.run('record-workflow-stage.ts', ['--trace', env.output])
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /无法确认根 AGENTS.md 的工作流策略/)
  env.assertNoEffects()
})

test('重复 METHOD-01 不允许通过歧义启用阶段工作流', (t) => {
  const env = fixture(t, `${agents}\n**METHOD-01：Superpowers 已启用。**`)
  assert.throws(() => assertWorkflowPolicyAllows(env.workspace, ['--required-skills=x']), /METHOD-01 重复/)
  env.assertNoEffects()
})
