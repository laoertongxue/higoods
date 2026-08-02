import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path'

export type WorkflowStage =
  | 'trigger'
  | 'skill-invocation'
  | 'artifact'
  | 'implementation'
  | 'spec-review'
  | 'code-quality-review'
  | 'final-validation'

export interface WorkflowStageEvent {
  stage: WorkflowStage
  timestamp: string
  summary: string
  evidenceRef: string
  skill?: string
  skillSource?: string
  artifact?: string
}

export interface StageTraceRequirements {
  requiredSkills: string[]
  requireTwoStageReview: boolean
}

export interface StageTraceSummary {
  required: boolean
  valid: boolean
  stages: WorkflowStage[]
  skills: string[]
  blockers: string[]
}

const STAGES = new Set<WorkflowStage>([
  'trigger',
  'skill-invocation',
  'artifact',
  'implementation',
  'spec-review',
  'code-quality-review',
  'final-validation',
])

const STAGE_ORDER: Record<WorkflowStage, number> = {
  trigger: 0,
  'skill-invocation': 1,
  artifact: 2,
  implementation: 3,
  'spec-review': 4,
  'code-quality-review': 5,
  'final-validation': 6,
}

interface StageValidationOptions {
  cwd?: string
  expectedRevision?: string
  providerSessionRoots?: string[]
  skillSourceRoots?: string[]
}

function assertExistingFile(reference: string, cwd: string): string {
  const path = reference.slice(reference.indexOf(':') + 1)
  assert(path && existsSync(resolve(cwd, path)), `工作流证据不存在：${path}`)
  return resolve(cwd, path)
}

function assertGitCommit(reference: string, cwd: string, expectedRevision?: string): void {
  const revision = reference.slice('git:'.length)
  assert(revision, 'Git 证据缺少版本')
  let resolvedRevision = ''
  try {
    resolvedRevision = execFileSync('git', ['rev-parse', `${revision}^{commit}`], {
      cwd,
      encoding: 'utf8',
    }).trim()
  } catch {
    throw new Error(`Git 证据不存在：${revision}`)
  }
  if (expectedRevision) {
    assert.equal(resolvedRevision, expectedRevision, '实现阶段 Git 证据不是当前验证版本')
  }
}

function readEvidenceReceipt(reference: string, cwd: string): Record<string, unknown> {
  const path = assertExistingFile(reference, cwd)
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown
  assert(parsed && typeof parsed === 'object' && !Array.isArray(parsed), `证据收据格式无效：${path}`)
  return parsed as Record<string, unknown>
}

function readProviderEvent(reference: string): {
  sessionPath: string
  record: {
    timestamp?: unknown
    type?: unknown
    payload?: {
      type?: unknown
      name?: unknown
      arguments?: unknown
      input?: unknown
      call_id?: unknown
    }
  }
  result?: {
    type?: unknown
    call_id?: unknown
    output?: unknown
  }
} {
  const match = /^provider-event:(.+)#L([1-9]\d*)$/.exec(reference)
  assert(match, '技能调用必须引用 provider-event:<session.jsonl>#L<line>')
  const sessionPath = realpathSync(resolve(match[1]))
  assert(existsSync(sessionPath), `provider session 证据不存在：${sessionPath}`)
  const lines = readFileSync(sessionPath, 'utf8').split('\n')
  const line = lines[Number(match[2]) - 1]
  assert(line, `provider session 证据行不存在：${match[2]}`)
  const record = JSON.parse(line) as {
    timestamp?: unknown
    type?: unknown
      payload?: {
        type?: unknown
        name?: unknown
        arguments?: unknown
        input?: unknown
        call_id?: unknown
      }
  }
  const callId = record.payload?.call_id
  const result = typeof callId === 'string'
    ? (() => {
        for (const candidate of lines) {
          if (!candidate.includes('"function_call_output"') && !candidate.includes('"custom_tool_call_output"')) continue
          const payload = (JSON.parse(candidate) as {
            payload?: { type?: unknown; call_id?: unknown; output?: unknown }
          }).payload
          if ((payload?.type === 'function_call_output' || payload?.type === 'custom_tool_call_output') && payload.call_id === callId) {
            return payload
          }
        }
        return undefined
      })()
    : undefined
  return {
    sessionPath,
    record,
    result,
  }
}

function parseDesktopExecCommand(input: unknown): { cmd?: unknown; workdir?: unknown } {
  assert(typeof input === 'string', '桌面 provider exec 输入不是字符串')
  const match = /^\s*const\s+r\s*=\s*await\s+tools\.exec_command\(\s*\{([\s\S]*)\}\s*\)\s*;\s*text\(r\.output\)\s*;\s*$/.exec(input)
  assert(match, '桌面 provider exec 不是受支持的精确命令包装')
  const jsonObject = `{${match[1].replace(/(^|,)\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":')}}`
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonObject)
  } catch {
    throw new Error('桌面 provider exec 参数不是仅含 JSON 字面量的对象')
  }
  assert(parsed && typeof parsed === 'object' && !Array.isArray(parsed), '桌面 provider exec 参数格式无效')
  const command = parsed as Record<string, unknown>
  assert(
    Object.keys(command).every((key) => ['cmd', 'workdir', 'yield_time_ms', 'max_output_tokens', 'login'].includes(key)),
    '桌面 provider exec 包含未允许的参数',
  )
  return { cmd: command.cmd, workdir: command.workdir }
}

export function providerEventTimestamp(reference: string): string {
  const { record } = readProviderEvent(reference)
  assert(typeof record.timestamp === 'string', 'provider 事件缺少时间')
  return record.timestamp
}

function assertProviderSkillInvocation(
  event: WorkflowStageEvent,
  options: StageValidationOptions,
): void {
  const { sessionPath, record, result } = readProviderEvent(event.evidenceRef)
  const roots = options.providerSessionRoots ?? [
    resolve(process.env.CODEX_HOME ?? `${process.env.HOME ?? ''}/.codex`, 'sessions'),
  ]
  assert(
    roots.some((root) => sessionPath.startsWith(`${realpathSync(resolve(root))}/`)),
    '技能调用证据不在受信任的 provider session 根目录',
  )
  assert.equal(record.type, 'response_item', 'provider 证据不是响应事件')
  const isFunctionCall = record.payload?.type === 'function_call' && record.payload?.name === 'exec_command'
  const isDesktopExec = record.payload?.type === 'custom_tool_call' && record.payload?.name === 'exec'
  assert(isFunctionCall || isDesktopExec, 'provider 证据不是可审计的文件读取调用')
  assert.equal(record.timestamp, event.timestamp, '技能调用时间与 provider 事件不一致')
  const skillSource = event.skillSource?.trim() ?? ''
  assert(skillSource, '技能调用缺少 skillSource')
  assert(existsSync(skillSource), `技能源文件不存在：${skillSource}`)
  const resolvedSkillSource = realpathSync(resolve(skillSource))
  assert(resolvedSkillSource.endsWith('/SKILL.md'), '技能源文件必须指向 SKILL.md')
  const cwd = options.cwd ?? process.cwd()
  const codexHome = process.env.CODEX_HOME ?? resolve(process.env.HOME ?? '', '.codex')
  const skillRoots = options.skillSourceRoots ?? [
    resolve(cwd, '.agents/skills'),
    resolve(process.env.HOME ?? '', '.agents/skills'),
    resolve(codexHome, 'skills'),
    resolve(codexHome, 'superpowers-zh/skills'),
    resolve(codexHome, 'plugins/cache'),
  ]
  const trustedRoots = skillRoots
    .filter((root) => existsSync(root))
    .map((root) => realpathSync(resolve(root)))
  assert(
    trustedRoots.some((root) => {
      const pathFromRoot = relative(root, resolvedSkillSource)
      return pathFromRoot !== '' && !pathFromRoot.startsWith('..') && !isAbsolute(pathFromRoot)
    }),
    '技能源文件不在受信任的技能源根目录',
  )
  const expectedSkillName = event.skill?.trim().split(':').at(-1)
  assert.equal(basename(dirname(resolvedSkillSource)), expectedSkillName, '技能名称不匹配：技能源目录错误')
  assert.equal(result?.type, isDesktopExec ? 'custom_tool_call_output' : 'function_call_output', 'provider 工具调用缺少结果事件')
  assert.equal(result?.call_id, record.payload?.call_id, 'provider 工具结果 call_id 不匹配')
  const resultOutput = typeof result?.output === 'string'
    ? result.output
    : Array.isArray(result?.output)
      ? result.output.map((item) => item && typeof item === 'object' && typeof (item as { text?: unknown }).text === 'string' ? (item as { text: string }).text : '').join('')
      : ''
  const succeeded = isDesktopExec
    ? /^Script completed\n/.test(resultOutput)
    : (() => {
        const resultHeader = resultOutput.split(/\n(?:Final output|Output):/i, 1)[0]
        const exitCodes = [
          ...resultHeader.matchAll(/^Process exited with code\s+(\d+)\s*$/gm),
        ].map((match) => Number(match[1]))
        return exitCodes.length === 1 && exitCodes[0] === 0
      })()
  let toolArguments: { cmd?: unknown; workdir?: unknown } = {}
  if (isDesktopExec) {
    toolArguments = parseDesktopExecCommand(record.payload?.input)
  } else {
    try {
      toolArguments = JSON.parse(
        typeof record.payload?.arguments === 'string' ? record.payload.arguments : '',
      ) as { cmd?: unknown; workdir?: unknown }
    } catch {
      throw new Error('provider 文件读取参数不是有效 JSON')
    }
  }
  const input = typeof toolArguments.cmd === 'string' ? toolArguments.cmd : ''
  const commandCwd = typeof toolArguments.workdir === 'string'
    ? resolve(toolArguments.workdir)
    : cwd
  const readsDeclaredSource = [...new Set([
    resolve(skillSource),
    resolvedSkillSource,
  ])].some((sourcePath) => {
    const candidates = [
      sourcePath,
      relative(commandCwd, sourcePath),
    ].filter((candidate) => candidate && !candidate.startsWith('..'))
    return candidates.some((candidate) => {
      const escapedSource = candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const quotedSource = `(?:"${escapedSource}"|'${escapedSource}'|${escapedSource})`
      return [
        new RegExp(`^\\s*sed\\s+-n\\s+(?:"[^"]+"|'[^']+'|\\S+)\\s+${quotedSource}\\s*$`),
        new RegExp(`^\\s*wc\\s+-l\\s+${quotedSource}\\s*$`),
      ].some((pattern) => pattern.test(input))
    })
  })
  assert(succeeded && readsDeclaredSource, 'provider 工具调用未读取声明的技能源文件')
}

function assertEvidence(
  event: WorkflowStageEvent,
  options: StageValidationOptions,
): void {
  const cwd = options.cwd ?? process.cwd()
  if (event.stage === 'trigger') {
    assert(/^conversation:\S+$/.test(event.evidenceRef), '触发阶段必须引用 conversation 证据')
    return
  }
  if (event.stage === 'skill-invocation') {
    assertProviderSkillInvocation(event, options)
    return
  }
  if (event.stage === 'implementation') {
    assert(event.evidenceRef.startsWith('git:'), '实现阶段必须引用 Git 版本证据')
    assertGitCommit(event.evidenceRef, cwd, options.expectedRevision)
    return
  }
  if (event.stage === 'artifact') {
    assert(event.evidenceRef.startsWith('file:'), 'artifact 阶段必须引用文件证据')
    const evidencePath = assertExistingFile(event.evidenceRef, cwd)
    assert.equal(
      evidencePath,
      resolve(cwd, event.artifact ?? ''),
      '产物证据必须指向声明产物',
    )
    return
  }
  if (event.stage === 'spec-review' || event.stage === 'code-quality-review') {
    assert(event.evidenceRef.startsWith('review-receipt:'), `${event.stage} 必须引用 review-receipt`)
    const receipt = readEvidenceReceipt(event.evidenceRef, cwd)
    assert.equal(receipt.kind, 'workflow-review', '审查证据类型无效')
    assert.equal(receipt.stage, event.stage, '审查证据阶段不匹配')
    assert.equal(receipt.verdict, 'pass', '审查证据未通过')
    if (options.expectedRevision) assert.equal(receipt.revision, options.expectedRevision, '审查证据版本不匹配')
    return
  }
  assert(
    event.evidenceRef.startsWith('validation-receipt:'),
    'final-validation 必须引用 validation-receipt',
  )
  const receipt = readEvidenceReceipt(event.evidenceRef, cwd)
  assert.equal(receipt.kind, 'workflow-validation', '验证证据类型无效')
  if (options.expectedRevision) assert.equal(receipt.revision, options.expectedRevision, '验证证据版本不匹配')
  assert(Array.isArray(receipt.checks) && receipt.checks.length > 0, '验证证据缺少检查结果')
  assert(
    receipt.checks.every((check) =>
      check && typeof check === 'object' && (check as { exitCode?: unknown }).exitCode === 0),
    '验证证据包含失败检查',
  )
}

function assertEvent(event: WorkflowStageEvent, options: StageValidationOptions = {}): void {
  const cwd = options.cwd ?? process.cwd()
  assert(STAGES.has(event.stage), `未知工作流阶段：${event.stage}`)
  assert(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(event.timestamp)
      && new Date(event.timestamp).toISOString() === event.timestamp,
    '工作流阶段必须使用有效的 ISO 时间',
  )
  assert(event.summary.trim(), '工作流阶段缺少摘要')
  assert(event.evidenceRef.trim(), '工作流阶段缺少证据引用')
  if (event.stage === 'skill-invocation') assert(event.skill?.trim(), '技能调用阶段缺少技能名称')
  if (event.stage === 'artifact') {
    assert(event.artifact?.trim(), '阶段产物缺少路径或引用')
    assert(existsSync(resolve(cwd, event.artifact)), `阶段产物不存在：${event.artifact}`)
  }
  assertEvidence(event, { ...options, cwd })
}

export function appendStageEvent(
  events: WorkflowStageEvent[],
  event: WorkflowStageEvent,
  options: StageValidationOptions = {},
): WorkflowStageEvent[] {
  assertEvent(event, options)
  return [...events, { ...event }]
}

export function validateStageTrace(
  events: WorkflowStageEvent[],
  requirements: StageTraceRequirements,
  options: StageValidationOptions = {},
): StageTraceSummary {
  const cwd = options.cwd ?? process.cwd()
  for (const event of events) assertEvent(event, { ...options, cwd })
  for (let index = 1; index < events.length; index += 1) {
    const previous = events[index - 1]
    const current = events[index]
    assert(
      Date.parse(current.timestamp) >= Date.parse(previous.timestamp),
      '工作流阶段时间必须单调递增',
    )
    assert(
      STAGE_ORDER[current.stage] >= STAGE_ORDER[previous.stage],
      `工作流阶段顺序无效：${previous.stage} -> ${current.stage}`,
    )
  }
  const required = requirements.requiredSkills.length > 0 || requirements.requireTwoStageReview
  const blockers: string[] = []
  const stages = [...new Set(events.map((event) => event.stage))]
  const invokedSkills = [...new Set(
    events
      .filter((event) => event.stage === 'skill-invocation')
      .map((event) => event.skill?.trim() ?? '')
      .filter(Boolean),
  )]

  for (const skill of requirements.requiredSkills) {
    if (!invokedSkills.includes(skill)) blockers.push(`缺少技能实际调用：${skill}`)
  }

  if (required) {
    if (!stages.includes('trigger')) blockers.push('缺少触发原因阶段')
    if (!stages.includes('artifact')) blockers.push('缺少技能阶段产物')
    if (!stages.includes('implementation')) blockers.push('缺少后续实现阶段')
    if (!stages.includes('final-validation')) blockers.push('缺少最终验证阶段')
  }
  if (requirements.requireTwoStageReview) {
    if (!stages.includes('spec-review')) blockers.push('缺少规格审查阶段')
    if (!stages.includes('code-quality-review')) blockers.push('缺少代码质量审查阶段')
  }

  return {
    required,
    valid: blockers.length === 0,
    stages,
    skills: invokedSkills,
    blockers,
  }
}
