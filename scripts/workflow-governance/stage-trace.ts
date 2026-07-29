import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

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

function assertExistingFile(reference: string, cwd: string): void {
  const path = reference.slice(reference.indexOf(':') + 1)
  assert(path && existsSync(resolve(cwd, path)), `工作流证据不存在：${path}`)
}

function assertGitCommit(reference: string, cwd: string): void {
  const revision = reference.slice('git:'.length)
  assert(revision, 'Git 证据缺少版本')
  try {
    execFileSync('git', ['cat-file', '-e', `${revision}^{commit}`], {
      cwd,
      stdio: 'ignore',
    })
  } catch {
    throw new Error(`Git 证据不存在：${revision}`)
  }
}

function assertEvidence(event: WorkflowStageEvent, cwd: string): void {
  if (event.stage === 'trigger') {
    assert(/^conversation:\S+$/.test(event.evidenceRef), '触发阶段必须引用 conversation 证据')
    return
  }
  if (event.stage === 'skill-invocation') {
    assert(event.evidenceRef.startsWith('skill-file:'), '技能调用必须引用 skill-file 证据')
    assertExistingFile(event.evidenceRef, cwd)
    assert(event.evidenceRef.endsWith('/SKILL.md'), '技能调用证据必须指向 SKILL.md')
    return
  }
  if (event.stage === 'implementation') {
    assert(event.evidenceRef.startsWith('git:'), '实现阶段必须引用 Git 版本证据')
    assertGitCommit(event.evidenceRef, cwd)
    return
  }
  assert(event.evidenceRef.startsWith('file:'), `${event.stage} 阶段必须引用文件证据`)
  assertExistingFile(event.evidenceRef, cwd)
}

function assertEvent(event: WorkflowStageEvent, cwd = process.cwd()): void {
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
  assertEvidence(event, cwd)
}

export function appendStageEvent(
  events: WorkflowStageEvent[],
  event: WorkflowStageEvent,
): WorkflowStageEvent[] {
  assertEvent(event)
  return [...events, { ...event }]
}

export function validateStageTrace(
  events: WorkflowStageEvent[],
  requirements: StageTraceRequirements,
  options: { cwd?: string } = {},
): StageTraceSummary {
  const cwd = options.cwd ?? process.cwd()
  for (const event of events) assertEvent(event, cwd)
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
