import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assertReceiptCurrent,
  createTaskReceipt,
  parseCodeGraphStatus,
  recordAcceptance,
  recordDelivery,
  type GitRevision,
} from '../../scripts/workflow-governance/task-receipt.ts'
import type { AffectedCheckRoute } from '../../scripts/workflow-governance/affected-checks.ts'

const revision: GitRevision = {
  head: 'abc123',
  diffHash: 'diff-1',
  changedPaths: ['scripts/example.ts'],
}

const route: AffectedCheckRoute = {
  changedPaths: revision.changedPaths,
  fastChecks: ['npm run test:workflow-governance'],
  governanceChecks: [],
  fullChecks: [],
  unknownPaths: [],
  escalationReasons: [],
}

function validReceipt() {
  return createTaskReceipt({
    workspace: '/workspace',
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

test('最终差异指纹变化会使验证收据失效', () => {
  const receipt = validReceipt()
  assert.equal(receipt.state, 'verified')
  assert.throws(
    () => assertReceiptCurrent(receipt, { ...revision, diffHash: 'diff-2' }),
    /最终改动已变化/,
  )
})

test('失败检查阻止收据进入验证完成', () => {
  const receipt = validReceipt()
  receipt.checks[0].exitCode = 1
  assert.equal(createTaskReceipt({
    workspace: receipt.workspace,
    revisionBefore: revision,
    revisionAfter: revision,
    route,
    checks: receipt.checks,
    codegraph: receipt.codegraph,
  }).state, 'implemented')
})

test('CodeGraph 待同步或工作树不匹配时阻止验证完成', () => {
  const receipt = validReceipt()
  receipt.codegraph.after.pendingCount = 1
  receipt.codegraph.after.worktreeMismatch = true
  const blocked = createTaskReceipt({
    workspace: receipt.workspace,
    revisionBefore: revision,
    revisionAfter: revision,
    route,
    checks: receipt.checks,
    codegraph: receipt.codegraph,
  })
  assert.equal(blocked.state, 'implemented')
  assert(blocked.blockers.some((blocker) => blocker.includes('CodeGraph')))
})

test('CodeGraph JSON 状态保留待同步数和工作树不匹配证据', () => {
  const status = parseCodeGraphStatus(JSON.stringify({
    initialized: true,
    projectPath: '/workspace/main',
    pendingChanges: { added: 1, modified: 2, removed: 3 },
    worktreeMismatch: {
      worktreeRoot: '/workspace/worktree',
      indexRoot: '/workspace/main',
    },
  }))

  assert.equal(status.pendingCount, 6)
  assert.equal(status.worktreeMismatch, true)
  assert.equal(status.projectPath, '/workspace/main')
})

test('没有 provider 回执不能标记远端交付', () => {
  assert.throws(
    () => recordDelivery(validReceipt(), {
      provider: 'github',
      target: 'main',
      revision: 'abc123',
      providerReceipt: '',
    }),
    /provider 回执/,
  )
})

test('交付版本必须与验证版本一致', () => {
  assert.throws(
    () => recordDelivery(validReceipt(), {
      provider: 'github',
      target: 'main',
      revision: 'other',
      providerReceipt: 'https://example.test/receipt',
    }),
    /验证版本不一致/,
  )
})

test('验证、交付和接受按证据逐级升级', () => {
  const delivered = recordDelivery(validReceipt(), {
    provider: 'github',
    target: 'main',
    revision: 'abc123',
    providerReceipt: 'https://example.test/receipt',
  })
  assert.equal(delivered.state, 'delivered')

  const accepted = recordAcceptance(delivered, {
    acceptanceRef: 'user-message:2026-07-29T11:00:00+07:00',
  })
  assert.equal(accepted.state, 'accepted')
})
