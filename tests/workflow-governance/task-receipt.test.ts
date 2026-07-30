import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assertReceiptCurrent,
  createTaskReceipt,
  parseCodeGraphStatus,
  parseTaskCompletionReceipt,
  receiptValidationPaths,
  recordAcceptance,
  recordDelivery,
  type GitRevision,
  type TaskCompletionReceipt,
} from '../../scripts/workflow-governance/task-receipt.ts'
import {
  routeAffectedChecks,
  type AffectedCheckRoute,
} from '../../scripts/workflow-governance/affected-checks.ts'
import type { InstructionContextReceipt } from '../../scripts/workflow-governance/instruction-context.ts'

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

const route: AffectedCheckRoute = routeAffectedChecks(revision.changedPaths)

function instructionContext(options: {
  contentHash?: string
  requireStageTrace?: boolean
} = {}): InstructionContextReceipt {
  return {
    taskBoundary: '只修改任务收据实现与测试',
    source: {
      path: 'AGENTS.md',
      algorithm: 'sha256',
      contentHash: options.contentHash ?? 'a'.repeat(64),
    },
    ruleBindings: [
      {
        ruleRef: 'AGENTS.md::## 12. CodeGraph 使用规则',
        evidenceFields: ['codegraph'],
      },
      {
        ruleRef: 'AGENTS.md::### 12.1 任务完成与交付收据',
        evidenceFields: ['revision', 'route', 'checks', 'codegraph'],
      },
      ...(options.requireStageTrace
        ? [{
            ruleRef: 'AGENTS.md::### 12.2 Superpowers 最小阶段轨迹',
            evidenceFields: ['stageTrace'] as const,
          }]
        : []),
    ],
  }
}

function validReceipt() {
  const instruction = instructionContext()
  return createTaskReceipt({
    workspace: '/workspace',
    revisionBefore: revision,
    revisionAfter: revision,
    instructionBefore: instruction,
    instructionAfter: instruction,
    route,
    checks: [
      ...new Set([
        ...route.fastChecks,
        ...route.governanceChecks,
        ...route.fullChecks,
      ]),
    ].map((command) => ({
      command,
      exitCode: 0,
      startedAt: '2026-07-29T10:00:00.000Z',
      finishedAt: '2026-07-29T10:01:00.000Z',
      invariant: '受影响检查路由要求',
    })),
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

function validDeliveredReceipt(): TaskCompletionReceipt {
  return {
    ...validReceipt(),
    state: 'delivered',
    delivery: {
      provider: 'github',
      target: 'owner/repository@main',
      revision: revision.head,
      providerReceipt: 'https://api.github.com/repos/owner/repository/commits/abc123',
      recordedAt: '2026-07-29T10:02:00.000Z',
    },
  }
}

test('最终差异指纹变化会使验证收据失效', () => {
  const receipt = validReceipt()
  assert.equal(receipt.state, 'verified')
  assert.throws(
    () => assertReceiptCurrent(receipt, { ...revision, diffHash: 'diff-2' }),
    /最终改动已变化/,
  )
})

test('新增变更路径会使验证收据失效并进入当前重算范围', () => {
  const receipt = validReceipt()
  const changedPaths = [...revision.changedPaths, 'scripts/new-file.ts']
  assert.throws(
    () => assertReceiptCurrent(receipt, { ...revision, changedPaths }),
    /最终改动已变化/,
  )
  assert.deepEqual(
    receiptValidationPaths(receipt, ['scripts/new-file.ts']),
    ['scripts/example.ts', 'scripts/new-file.ts'],
  )
})

test('失败检查阻止收据进入验证完成', () => {
  const receipt = validReceipt()
  receipt.checks[0].exitCode = 1
  assert.equal(createTaskReceipt({
    workspace: receipt.workspace,
    revisionBefore: revision,
    revisionAfter: revision,
    instructionBefore: receipt.instructionContext,
    instructionAfter: receipt.instructionContext,
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
    instructionBefore: receipt.instructionContext,
    instructionAfter: receipt.instructionContext,
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

test('执行期间 AGENTS 指令上下文变化时只能生成 implemented 收据并保存最终上下文', () => {
  const before = instructionContext({ contentHash: 'a'.repeat(64) })
  const after = instructionContext({ contentHash: 'b'.repeat(64) })
  const receipt = createTaskReceipt({
    workspace: '/workspace',
    revisionBefore: revision,
    revisionAfter: revision,
    instructionBefore: before,
    instructionAfter: after,
    route,
    checks: validReceipt().checks,
    codegraph: validReceipt().codegraph,
  })

  assert.equal(receipt.state, 'implemented')
  assert.deepEqual(receipt.instructionContext, after)
  assert(receipt.blockers.some((blocker) => blocker.includes('AGENTS 指令上下文已变化')))
})

test('阶段轨迹绑定与 stageTrace.required 不一致时阻止验证完成', () => {
  const withBinding = instructionContext({ requireStageTrace: true })
  const withoutTrace = createTaskReceipt({
    workspace: '/workspace',
    revisionBefore: revision,
    revisionAfter: revision,
    instructionBefore: withBinding,
    instructionAfter: withBinding,
    route,
    checks: validReceipt().checks,
    codegraph: validReceipt().codegraph,
  })
  assert.equal(withoutTrace.state, 'implemented')
  assert(withoutTrace.blockers.some((blocker) => blocker.includes('阶段轨迹绑定')))

  const withoutBinding = instructionContext()
  const withRequiredTrace = createTaskReceipt({
    workspace: '/workspace',
    revisionBefore: revision,
    revisionAfter: revision,
    instructionBefore: withoutBinding,
    instructionAfter: withoutBinding,
    route,
    checks: validReceipt().checks,
    codegraph: validReceipt().codegraph,
    stageTrace: {
      required: true,
      valid: true,
      stages: [],
      skills: [],
      blockers: [],
    },
  })
  assert.equal(withRequiredTrace.state, 'implemented')
  assert(withRequiredTrace.blockers.some((blocker) => blocker.includes('阶段轨迹绑定')))
})

test('必需阶段轨迹无效且没有细分 blocker 时仍生成 implemented 收据', () => {
  const instruction = instructionContext({ requireStageTrace: true })
  const receipt = createTaskReceipt({
    workspace: '/workspace',
    revisionBefore: revision,
    revisionAfter: revision,
    instructionBefore: instruction,
    instructionAfter: instruction,
    route,
    checks: validReceipt().checks,
    codegraph: validReceipt().codegraph,
    stageTrace: {
      required: true,
      valid: false,
      stages: [],
      skills: [],
      blockers: [],
    },
  })

  assert.equal(receipt.state, 'implemented')
  assert(receipt.blockers.some((blocker) => blocker.includes('阶段轨迹')))
})

test('运行时解析接受完整 v2 收据并拒绝旧版本和畸形嵌套字段', () => {
  const receipt = validReceipt()
  assert.deepEqual(parseTaskCompletionReceipt(JSON.stringify(receipt)), receipt)

  assert.throws(
    () => parseTaskCompletionReceipt(JSON.stringify({ ...receipt, schemaVersion: 1 })),
    /schemaVersion/,
  )
  assert.throws(
    () => parseTaskCompletionReceipt(JSON.stringify({
      ...receipt,
      instructionContext: {
        ...receipt.instructionContext,
        source: {
          ...receipt.instructionContext.source,
          contentHash: 'not-a-sha256',
        },
      },
    })),
    /contentHash/,
  )
  assert.throws(
    () => parseTaskCompletionReceipt(JSON.stringify({
      ...receipt,
      checks: [{ ...receipt.checks[0], exitCode: '0' }],
    })),
    /checks/,
  )
})

test('运行时解析拒绝结构合法但语义伪造的 verified 收据', () => {
  const receipt = validReceipt()
  const forgedReceipts: Array<{ receipt: TaskCompletionReceipt; message: RegExp }> = [
    {
      receipt: {
        ...receipt,
        checks: [{ ...receipt.checks[0], exitCode: 1 }],
      },
      message: /检查失败/,
    },
    {
      receipt: {
        ...receipt,
        blockers: ['伪造的 blocker'],
      },
      message: /blockers 必须为空/,
    },
    {
      receipt: {
        ...receipt,
        codegraph: { ...receipt.codegraph, syncExitCode: 1 },
      },
      message: /CodeGraph 同步失败/,
    },
    {
      receipt: {
        ...receipt,
        codegraph: {
          ...receipt.codegraph,
          after: { ...receipt.codegraph.after, initialized: false },
        },
      },
      message: /CodeGraph 索引未初始化/,
    },
    {
      receipt: {
        ...receipt,
        codegraph: {
          ...receipt.codegraph,
          after: { ...receipt.codegraph.after, pendingCount: 1 },
        },
      },
      message: /待同步文件/,
    },
    {
      receipt: {
        ...receipt,
        codegraph: {
          ...receipt.codegraph,
          after: { ...receipt.codegraph.after, worktreeMismatch: true },
        },
      },
      message: /工作树不匹配/,
    },
    {
      receipt: {
        ...receipt,
        codegraph: {
          ...receipt.codegraph,
          after: { ...receipt.codegraph.after, projectPath: '/workspace/other' },
        },
      },
      message: /项目路径/,
    },
    {
      receipt: {
        ...receipt,
        instructionContext: instructionContext({ requireStageTrace: true }),
      },
      message: /阶段轨迹绑定/,
    },
    {
      receipt: {
        ...receipt,
        instructionContext: instructionContext({ requireStageTrace: true }),
        stageTrace: {
          required: true,
          valid: false,
          stages: [],
          skills: [],
          blockers: ['缺少阶段'],
        },
      },
      message: /阶段轨迹无效/,
    },
    {
      receipt: {
        ...receipt,
        state: 'implemented',
      },
      message: /implemented.*blockers/,
    },
    {
      receipt: {
        ...receipt,
        delivery: validDeliveredReceipt().delivery,
      },
      message: /verified.*delivery/,
    },
  ]

  for (const forged of forgedReceipts) {
    assert.throws(
      () => parseTaskCompletionReceipt(JSON.stringify(forged.receipt)),
      forged.message,
    )
  }
})

test('运行时解析拒绝结构合法但交付语义伪造的收据', () => {
  const delivered = validDeliveredReceipt()
  assert.deepEqual(parseTaskCompletionReceipt(JSON.stringify(delivered)), delivered)

  for (const forged of [
    {
      ...delivered,
      delivery: { ...delivered.delivery!, provider: 'gitlab' },
    },
    {
      ...delivered,
      delivery: { ...delivered.delivery!, revision: 'other' },
    },
    {
      ...delivered,
      delivery: {
        ...delivered.delivery!,
        providerReceipt: 'https://github.com/owner/repository/commit/abc123',
      },
    },
    {
      ...delivered,
      delivery: {
        ...delivered.delivery!,
        acceptanceRef: 'https://api.github.com/repos/owner/repository/issues/comments/42',
      },
    },
  ]) {
    assert.throws(
      () => parseTaskCompletionReceipt(JSON.stringify(forged)),
      /交付|delivery|provider|版本|回执|acceptanceRef/,
    )
  }

  assert.throws(
    () => parseTaskCompletionReceipt(JSON.stringify({
      ...delivered,
      state: 'accepted',
      delivery: {
        ...delivered.delivery!,
        acceptanceRef: 'ticket:42',
      },
    })),
    /acceptanceRef/,
  )
})

test('运行时解析拒绝协同清空 route 和 checks 的 verified 收据', () => {
  const forged: TaskCompletionReceipt = {
    ...validReceipt(),
    route: {
      changedPaths: [],
      fastChecks: [],
      governanceChecks: [],
      fullChecks: [],
      unknownPaths: [],
      escalationReasons: [],
    },
    checks: [],
  }

  assert.throws(
    () => parseTaskCompletionReceipt(JSON.stringify(forged)),
    /检查路由|route/,
  )
})

test('协同清空 route 和 checks 的 verified 收据在 fetch 前拒绝交付', async () => {
  let fetchCalls = 0
  globalThis.fetch = (async () => {
    fetchCalls += 1
    throw new Error('协同伪造收据不应发起远端请求')
  }) as typeof fetch
  const forged: TaskCompletionReceipt = {
    ...validReceipt(),
    route: {
      changedPaths: [],
      fastChecks: [],
      governanceChecks: [],
      fullChecks: [],
      unknownPaths: [],
      escalationReasons: [],
    },
    checks: [],
  }

  await assert.rejects(
    recordDelivery(forged, {
      provider: 'github',
      target: 'owner/repository@main',
      revision: 'abc123',
      providerReceipt: 'https://github.com/owner/repository/commit/abc123',
    }),
    /检查路由|route/,
  )
  assert.equal(fetchCalls, 0)
})

test('必需阶段摘要必须包含最小阶段且两阶段审查必须成对出现', () => {
  const receipt = validReceipt()
  const instruction = instructionContext({ requireStageTrace: true })
  const stageTrace = {
    required: true,
    valid: true,
    stages: [],
    skills: [],
    blockers: [],
  } as const
  assert.throws(
    () => parseTaskCompletionReceipt(JSON.stringify({
      ...receipt,
      instructionContext: instruction,
      stageTrace,
    })),
    /阶段|trigger/,
  )

  assert.throws(
    () => parseTaskCompletionReceipt(JSON.stringify({
      ...receipt,
      instructionContext: instruction,
      stageTrace: {
        ...stageTrace,
        stages: [
          'trigger',
          'artifact',
          'implementation',
          'spec-review',
          'final-validation',
        ],
      },
    })),
    /审查|成对/,
  )
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

test('旧版收据直接记录交付或接受时在任何 fetch 前失败关闭', async () => {
  let fetchCalls = 0
  globalThis.fetch = (async () => {
    fetchCalls += 1
    throw new Error('旧版收据不应发起远端请求')
  }) as typeof fetch

  const legacyDelivery = {
    ...validReceipt(),
    schemaVersion: 1,
  } as unknown as TaskCompletionReceipt
  await assert.rejects(
    recordDelivery(legacyDelivery, {
      provider: 'github',
      target: 'owner/repository@main',
      revision: 'abc123',
      providerReceipt: 'https://github.com/owner/repository/commit/abc123',
    }),
    /schemaVersion/,
  )

  const legacyAcceptance = {
    ...validReceipt(),
    schemaVersion: 1,
    state: 'delivered',
    delivery: {
      provider: 'github',
      target: 'owner/repository@main',
      revision: 'abc123',
      providerReceipt: 'https://api.github.com/repos/owner/repository/commits/abc123',
      recordedAt: '2026-07-29T10:02:00.000Z',
    },
  } as unknown as TaskCompletionReceipt
  await assert.rejects(
    recordAcceptance(legacyAcceptance, {
      acceptanceRef: 'https://api.github.com/repos/owner/repository/issues/comments/42',
      expectedActor: 'review-owner',
    }),
    /schemaVersion/,
  )
  assert.equal(fetchCalls, 0)
})

test('伪造 verified 收据不能直接升级交付且不发起 fetch', async () => {
  let fetchCalls = 0
  globalThis.fetch = (async () => {
    fetchCalls += 1
    throw new Error('伪造收据不应发起远端请求')
  }) as typeof fetch
  const forged = validReceipt()
  forged.checks[0].exitCode = 1

  await assert.rejects(
    recordDelivery(forged, {
      provider: 'github',
      target: 'owner/repository@main',
      revision: 'abc123',
      providerReceipt: 'https://github.com/owner/repository/commit/abc123',
    }),
    /检查失败/,
  )
  assert.equal(fetchCalls, 0)
})

test('伪造 delivered 收据不能直接升级接受且不发起 fetch', async () => {
  let fetchCalls = 0
  globalThis.fetch = (async () => {
    fetchCalls += 1
    throw new Error('伪造收据不应发起远端请求')
  }) as typeof fetch
  const forged = validDeliveredReceipt()
  forged.delivery!.provider = 'gitlab'

  await assert.rejects(
    recordAcceptance(forged, {
      acceptanceRef: 'https://api.github.com/repos/owner/repository/issues/comments/42',
      expectedActor: 'review-owner',
    }),
    /github/,
  )
  assert.equal(fetchCalls, 0)
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

test('否定验收评论不能升级接受状态', async () => {
  for (const body of [
    '不同意 abc123',
    '尚未正式验收通过 abc123',
    'not approved abc123',
    'not yet approved abc123',
    'not currently accepted abc123',
    "this isn't approved abc123",
    "this shouldn't be accepted abc123",
  ]) {
    mockGitHubFetch([
      { sha: 'abc123' },
      { object: { sha: 'abc123' } },
      {
        body,
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
        acceptanceRef: 'https://api.github.com/repos/owner/repository/issues/comments/42',
        expectedActor: 'review-owner',
      }),
      /远端核验失败/,
    )
  }
})
