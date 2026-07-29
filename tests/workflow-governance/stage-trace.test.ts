import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  appendStageEvent,
  validateStageTrace,
  type WorkflowStageEvent,
} from '../../scripts/workflow-governance/stage-trace.ts'

const requiredSkill = 'superpowers-zh:subagent-driven-development'
const skillFixtureRoot = mkdtempSync(join(tmpdir(), 'workflow-stage-skill-'))
const skillFixturePath = join(skillFixtureRoot, 'subagent-driven-development', 'SKILL.md')
mkdirSync(join(skillFixtureRoot, 'subagent-driven-development'), { recursive: true })
writeFileSync(skillFixturePath, '# Test skill\n')
const skillEvidence = `skill-file:${skillFixturePath}`

function event(
  stage: WorkflowStageEvent['stage'],
  overrides: Partial<WorkflowStageEvent> = {},
): WorkflowStageEvent {
  return {
    stage,
    timestamp: '2026-07-29T10:00:00.000Z',
    summary: stage,
    evidenceRef: stage === 'trigger'
      ? 'conversation:user-request-2026-07-29'
      : 'file:tests/workflow-governance/stage-trace.test.ts',
    ...overrides,
  }
}

test('完整技能调用、实现、两阶段审查和最终验证轨迹通过', () => {
  const events = [
    event('trigger', { skill: requiredSkill }),
    event('skill-invocation', {
      timestamp: '2026-07-29T10:01:00.000Z',
      skill: requiredSkill,
      evidenceRef: skillEvidence,
    }),
    event('artifact', {
      timestamp: '2026-07-29T10:02:00.000Z',
      artifact: 'package.json',
    }),
    event('implementation', {
      timestamp: '2026-07-29T10:03:00.000Z',
      evidenceRef: 'git:HEAD',
    }),
    event('spec-review', { timestamp: '2026-07-29T10:04:00.000Z' }),
    event('code-quality-review', { timestamp: '2026-07-29T10:05:00.000Z' }),
    event('final-validation', { timestamp: '2026-07-29T10:06:00.000Z' }),
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
    event('implementation', { evidenceRef: 'git:HEAD' }),
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
    event('skill-invocation', {
      skill: requiredSkill,
      evidenceRef: skillEvidence,
    }),
    event('implementation', { evidenceRef: 'git:HEAD' }),
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
  const next = appendStageEvent(current, event('implementation', { evidenceRef: 'git:HEAD' }))
  assert.equal(next.length, 2)
  assert.equal(current.length, 1)

  assert.throws(
    () => appendStageEvent(next, event('final-validation', { evidenceRef: '' })),
    /证据引用/,
  )
})

test('阶段轨迹拒绝逆序、非法时间和不存在的证据', () => {
  assert.throws(
    () => validateStageTrace([
      event('implementation', {
        timestamp: '2026-07-29T10:02:00.000Z',
        evidenceRef: 'git:HEAD',
      }),
      event('artifact', {
        timestamp: '2026-07-29T10:03:00.000Z',
        artifact: 'package.json',
      }),
    ], { requiredSkills: [], requireTwoStageReview: false }),
    /阶段顺序/,
  )

  assert.throws(
    () => appendStageEvent([], event('final-validation', {
      timestamp: 'not-a-date',
    })),
    /ISO 时间/,
  )

  assert.throws(
    () => appendStageEvent([], event('final-validation', {
      evidenceRef: 'file:does-not-exist.validation',
    })),
    /证据不存在/,
  )

  assert.throws(
    () => appendStageEvent([], event('artifact', {
      artifact: 'does-not-exist.plan',
    })),
    /阶段产物不存在/,
  )
})
