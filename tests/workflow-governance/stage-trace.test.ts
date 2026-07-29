import assert from 'node:assert/strict'
import test from 'node:test'
import {
  appendStageEvent,
  validateStageTrace,
  type WorkflowStageEvent,
} from '../../scripts/workflow-governance/stage-trace.ts'

const requiredSkill = 'superpowers-zh:subagent-driven-development'

function event(
  stage: WorkflowStageEvent['stage'],
  overrides: Partial<WorkflowStageEvent> = {},
): WorkflowStageEvent {
  return {
    stage,
    timestamp: '2026-07-29T10:00:00.000Z',
    summary: stage,
    evidenceRef: `task-event:${stage}`,
    ...overrides,
  }
}

test('完整技能调用、实现、两阶段审查和最终验证轨迹通过', () => {
  const events = [
    event('trigger', { skill: requiredSkill }),
    event('skill-invocation', { skill: requiredSkill }),
    event('artifact', { artifact: 'docs/superpowers/plans/example.md' }),
    event('implementation'),
    event('spec-review'),
    event('code-quality-review'),
    event('final-validation'),
  ]

  const result = validateStageTrace(events, {
    requiredSkills: [requiredSkill],
    requireTwoStageReview: true,
  })

  assert.equal(result.valid, true)
  assert.deepEqual(result.blockers, [])
  assert(result.stages.includes('code-quality-review'))
})

test('请求中只出现技能名称不能冒充实际技能调用', () => {
  const result = validateStageTrace([
    event('trigger', { skill: requiredSkill }),
    event('implementation'),
    event('final-validation'),
  ], {
    requiredSkills: [requiredSkill],
    requireTwoStageReview: false,
  })

  assert.equal(result.valid, false)
  assert(result.blockers.some((blocker) => blocker.includes('实际调用')))
})

test('两阶段审查要求缺少任一阶段时失败', () => {
  const result = validateStageTrace([
    event('skill-invocation', { skill: requiredSkill }),
    event('implementation'),
    event('spec-review'),
    event('final-validation'),
  ], {
    requiredSkills: [requiredSkill],
    requireTwoStageReview: true,
  })

  assert.equal(result.valid, false)
  assert(result.blockers.some((blocker) => blocker.includes('代码质量审查')))
})

test('追加阶段事件保留已有轨迹并拒绝缺少证据引用', () => {
  const current = [event('trigger')]
  const next = appendStageEvent(current, event('implementation'))
  assert.equal(next.length, 2)
  assert.equal(current.length, 1)

  assert.throws(
    () => appendStageEvent(next, event('final-validation', { evidenceRef: '' })),
    /证据引用/,
  )
})
