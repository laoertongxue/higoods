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

const realFetch = globalThis.fetch

function mockGitHubFetch(bodies: Array<Record<string, unknown>>): void {
  globalThis.fetch = (async () => {
    const body = bodies.shift()
    return {
      ok: Boolean(body),
      status: body ? 200 : 404,
      json: async () => body ?? {},
    } as Response
  }) as typeof fetch
}

test.afterEach(() => {
  globalThis.fetch = realFetch
})

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

test('CodeGraph 状态缺少必要健康字段时失败关闭', () => {
  assert.throws(
    () => parseCodeGraphStatus(JSON.stringify({
      initialized: true,
      projectPath: '/workspace',
    })),
    /pendingChanges/,
  )
  assert.throws(
    () => parseCodeGraphStatus(JSON.stringify({
      initialized: true,
      projectPath: '/workspace',
      pendingChanges: { added: 0, modified: 0, removed: 0 },
    })),
    /worktreeMismatch/,
  )
})

test('没有 provider 回执不能标记远端交付', async () => {
  await assert.rejects(
    recordDelivery(validReceipt(), {
      provider: 'github',
      target: 'main',
      revision: 'abc123',
      providerReceipt: '',
    }),
    /provider 回执/,
  )
})

test('交付和接受必须由远端证据确认', async () => {
  await assert.rejects(
    recordDelivery(validReceipt(), {
      provider: ' ',
      target: ' ',
      revision: 'abc123',
      providerReceipt: 'ok',
    }),
    /provider/,
  )

  mockGitHubFetch([
    { sha: 'abc123' },
    { object: { sha: 'abc123' } },
    {
      body: 'accepted abc123',
      user: { login: 'review-owner' },
      author_association: 'OWNER',
    },
  ])
  const delivered = await recordDelivery(validReceipt(), {
    provider: 'github',
    target: 'owner/repository@main',
    revision: 'abc123',
    providerReceipt: 'https://github.com/owner/repository/commit/abc123',
  })
  await assert.rejects(
    recordAcceptance(delivered, {
      acceptanceRef: 'ticket:fake',
      expectedActor: 'review-owner',
    }),
    /接受引用/,
  )

  const accepted = await recordAcceptance(delivered, {
    acceptanceRef: 'https://api.github.com/repos/owner/repository/issues/comments/42',
    expectedActor: 'review-owner',
  })
  assert.equal(accepted.state, 'accepted')
})

test('交付版本必须与验证版本一致', async () => {
  await assert.rejects(
    recordDelivery(validReceipt(), {
      provider: 'github',
      target: 'main',
      revision: 'other',
      providerReceipt: 'https://example.test/receipt',
    }),
    /验证版本不一致/,
  )
})

test('验证、交付和接受按证据逐级升级', async () => {
  mockGitHubFetch([
    { sha: 'abc123' },
    { object: { sha: 'abc123' } },
    {
      body: '验收通过 abc123',
      user: { login: 'review-owner' },
      author_association: 'MEMBER',
    },
  ])
  const delivered = await recordDelivery(validReceipt(), {
    provider: 'github',
    target: 'owner/repository@main',
    revision: 'abc123',
    providerReceipt: 'https://github.com/owner/repository/commit/abc123',
  })
  assert.equal(delivered.state, 'delivered')

  const accepted = await recordAcceptance(delivered, {
    acceptanceRef: 'https://api.github.com/repos/owner/repository/issues/comments/42',
    expectedActor: 'review-owner',
  })
  assert.equal(accepted.state, 'accepted')
})

test('远端核验失败不能升级交付状态', async () => {
  mockGitHubFetch([])
  await assert.rejects(
    recordDelivery(validReceipt(), {
      provider: 'github',
      target: 'owner/repository@main',
      revision: 'abc123',
      providerReceipt: 'https://github.com/owner/repository/commit/abc123',
    }),
    /远端核验失败/,
  )
})

test('目标分支未指向版本或非授权评论者不能升级状态', async () => {
  mockGitHubFetch([
    { sha: 'abc123' },
    { object: { sha: 'different' } },
  ])
  await assert.rejects(
    recordDelivery(validReceipt(), {
      provider: 'github',
      target: 'owner/repository@main',
      revision: 'abc123',
      providerReceipt: 'https://github.com/owner/repository/commit/abc123',
    }),
    /目标分支/,
  )

  mockGitHubFetch([
    { sha: 'abc123' },
    { object: { sha: 'abc123' } },
    {
      body: 'accepted abc123',
      user: { login: 'outsider' },
      author_association: 'NONE',
    },
  ])
  const delivered = await recordDelivery(validReceipt(), {
    provider: 'github',
    target: 'owner/repository@main',
    revision: 'abc123',
    providerReceipt: 'https://github.com/owner/repository/commit/abc123',
  })
  await assert.rejects(
    recordAcceptance(delivered, {
      acceptanceRef: 'https://api.github.com/repos/owner/repository/issues/comments/42',
      expectedActor: 'review-owner',
    }),
    /远端核验失败/,
  )
})
