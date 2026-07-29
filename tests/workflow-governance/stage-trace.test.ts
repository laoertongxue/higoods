import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
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
const fixtureRoot = mkdtempSync(join(tmpdir(), 'workflow-stage-evidence-'))
const skillFixturePath = join(fixtureRoot, 'subagent-driven-development', 'SKILL.md')
mkdirSync(join(fixtureRoot, 'subagent-driven-development'), { recursive: true })
writeFileSync(skillFixturePath, '# Test skill\n')
const providerSessionPath = join(fixtureRoot, 'provider-session.jsonl')
writeFileSync(providerSessionPath, `${JSON.stringify({
  timestamp: '2026-07-29T10:01:00.000Z',
  type: 'response_item',
  payload: {
    type: 'custom_tool_call',
    name: 'exec',
    input: `sed -n '1,240p' ${skillFixturePath}`,
  },
})}\n`)
const skillEvidence = `provider-event:${providerSessionPath}#L1`
const currentRevision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const reviewReceiptPath = join(fixtureRoot, 'spec-review.json')
const qualityReceiptPath = join(fixtureRoot, 'code-quality-review.json')
const validationReceiptPath = join(fixtureRoot, 'final-validation.json')
writeFileSync(reviewReceiptPath, JSON.stringify({
  kind: 'workflow-review',
  stage: 'spec-review',
  revision: currentRevision,
  verdict: 'pass',
}))
writeFileSync(qualityReceiptPath, JSON.stringify({
  kind: 'workflow-review',
  stage: 'code-quality-review',
  revision: currentRevision,
  verdict: 'pass',
}))
writeFileSync(validationReceiptPath, JSON.stringify({
  kind: 'workflow-validation',
  revision: currentRevision,
  checks: [{ command: 'npm test', exitCode: 0 }],
}))

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

const validationOptions = {
  expectedRevision: currentRevision,
  providerSessionRoots: [fixtureRoot],
}

test('完整技能调用、实现、两阶段审查和最终验证轨迹通过', () => {
  const events = [
    event('trigger'),
    event('skill-invocation', {
      timestamp: '2026-07-29T10:01:00.000Z',
      skill: requiredSkill,
      skillSource: skillFixturePath,
      evidenceRef: skillEvidence,
    }),
    event('artifact', {
      timestamp: '2026-07-29T10:02:00.000Z',
      artifact: 'package.json',
      evidenceRef: 'file:package.json',
    }),
    event('implementation', {
      timestamp: '2026-07-29T10:03:00.000Z',
      evidenceRef: 'git:HEAD',
    }),
    event('spec-review', {
      timestamp: '2026-07-29T10:04:00.000Z',
      evidenceRef: `review-receipt:${reviewReceiptPath}`,
    }),
    event('code-quality-review', {
      timestamp: '2026-07-29T10:05:00.000Z',
      evidenceRef: `review-receipt:${qualityReceiptPath}`,
    }),
    event('final-validation', {
      timestamp: '2026-07-29T10:06:00.000Z',
      evidenceRef: `validation-receipt:${validationReceiptPath}`,
    }),
  ]

  const result = validateStageTrace(events, {
    requiredSkills: [requiredSkill],
    requireTwoStageReview: true,
  }, validationOptions)

  assert.equal(result.valid, true)
  assert.deepEqual(result.blockers, [])
  assert(result.stages.includes('code-quality-review'))
})

test('请求中只出现技能名称不能冒充实际技能调用', () => {
  const result = validateStageTrace([
    event('trigger', { skill: requiredSkill }),
    event('implementation', { evidenceRef: 'git:HEAD' }),
    event('final-validation', {
      evidenceRef: `validation-receipt:${validationReceiptPath}`,
    }),
  ], {
    requiredSkills: [requiredSkill],
    requireTwoStageReview: false,
  }, validationOptions)

  assert.equal(result.valid, false)
  assert(result.blockers.some((blocker) => blocker.includes('实际调用')))
})

test('两阶段审查要求缺少任一阶段时失败', () => {
  const result = validateStageTrace([
    event('skill-invocation', {
      timestamp: '2026-07-29T10:01:00.000Z',
      skill: requiredSkill,
      skillSource: skillFixturePath,
      evidenceRef: skillEvidence,
    }),
    event('implementation', {
      timestamp: '2026-07-29T10:02:00.000Z',
      evidenceRef: 'git:HEAD',
    }),
    event('spec-review', {
      timestamp: '2026-07-29T10:03:00.000Z',
      evidenceRef: `review-receipt:${reviewReceiptPath}`,
    }),
    event('final-validation', {
      timestamp: '2026-07-29T10:04:00.000Z',
      evidenceRef: `validation-receipt:${validationReceiptPath}`,
    }),
  ], {
    requiredSkills: [requiredSkill],
    requireTwoStageReview: true,
  }, validationOptions)

  assert.equal(result.valid, false)
  assert(result.blockers.some((blocker) => blocker.includes('代码质量审查')))
})

test('追加阶段事件保留已有轨迹并拒绝缺少证据引用', () => {
  const current = [event('trigger')]
  const next = appendStageEvent(
    current,
    event('implementation', { evidenceRef: 'git:HEAD' }),
    validationOptions,
  )
  assert.equal(next.length, 2)
  assert.equal(current.length, 1)

  assert.throws(
    () => appendStageEvent(
      next,
      event('final-validation', { evidenceRef: '' }),
      validationOptions,
    ),
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
        evidenceRef: 'file:package.json',
      }),
    ], { requiredSkills: [], requireTwoStageReview: false }, validationOptions),
    /阶段顺序/,
  )

  assert.throws(
    () => appendStageEvent([], event('final-validation', {
      timestamp: 'not-a-date',
      evidenceRef: `validation-receipt:${validationReceiptPath}`,
    }), validationOptions),
    /ISO 时间/,
  )

  assert.throws(
    () => appendStageEvent([], event('final-validation', {
      evidenceRef: 'validation-receipt:does-not-exist.validation',
    }), validationOptions),
    /证据不存在/,
  )

  assert.throws(
    () => appendStageEvent([], event('artifact', {
      artifact: 'does-not-exist.plan',
      evidenceRef: 'file:does-not-exist.plan',
    }), validationOptions),
    /阶段产物不存在/,
  )
})

test('技能、产物、审查和验证证据必须绑定声明对象', () => {
  assert.throws(
    () => appendStageEvent([], event('skill-invocation', {
      timestamp: '2026-07-29T10:01:00.000Z',
      skill: 'superpowers-zh:other-skill',
      skillSource: skillFixturePath,
      evidenceRef: skillEvidence,
    }), validationOptions),
    /技能名称不匹配/,
  )
  assert.throws(
    () => appendStageEvent([], event('artifact', {
      artifact: 'package.json',
      evidenceRef: 'file:AGENTS.md',
    }), validationOptions),
    /产物证据必须指向声明产物/,
  )
  assert.throws(
    () => appendStageEvent([], event('code-quality-review', {
      evidenceRef: 'file:package.json',
    }), validationOptions),
    /review-receipt/,
  )
  assert.throws(
    () => appendStageEvent([], event('final-validation', {
      evidenceRef: 'file:package.json',
    }), validationOptions),
    /validation-receipt/,
  )
})
