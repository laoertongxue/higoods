import assert from 'node:assert/strict'

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

function assertEvent(event: WorkflowStageEvent): void {
  assert(STAGES.has(event.stage), `未知工作流阶段：${event.stage}`)
  assert(event.timestamp.trim(), '工作流阶段缺少时间')
  assert(event.summary.trim(), '工作流阶段缺少摘要')
  assert(event.evidenceRef.trim(), '工作流阶段缺少证据引用')
  if (event.stage === 'skill-invocation') assert(event.skill?.trim(), '技能调用阶段缺少技能名称')
  if (event.stage === 'artifact') assert(event.artifact?.trim(), '阶段产物缺少路径或引用')
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
): StageTraceSummary {
  for (const event of events) assertEvent(event)
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
