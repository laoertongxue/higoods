import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { routeAffectedChecks } from './workflow-governance/affected-checks.ts'
import { resolveVerificationPaths } from './workflow-governance/changed-paths.ts'
import { verificationCheckEnvironment } from './workflow-governance/check-execution.ts'
import { revisionForPaths } from './workflow-governance/git-revision.ts'
import {
  assertReceiptCurrent,
  createTaskReceipt,
  parseCodeGraphStatus,
  parseTaskCompletionReceipt,
  recordAcceptance,
  recordDelivery,
  receiptValidationPaths,
  type CheckReceipt,
  type CodeGraphStatusReceipt,
  type GitRevision,
  type TaskCompletionReceipt,
} from './workflow-governance/task-receipt.ts'
import {
  assertInstructionContextCurrent,
  captureInstructionContext,
} from './workflow-governance/instruction-context.ts'
import {
  validateStageTrace,
  type WorkflowStageEvent,
} from './workflow-governance/stage-trace.ts'

function argument(args: string[], name: string, required = true): string {
  const indexes = args
    .map((argument, index) => argument === name ? index : -1)
    .filter((index) => index >= 0)
  assert(indexes.length <= 1, `${name} 不能重复`)
  if (indexes.length === 0) {
    if (required) assert.fail(`${name} 不能为空`)
    return ''
  }

  const value = args[indexes[0] + 1]
  assert(value && !value.startsWith('--'), `${name} 不能为空`)
  const normalized = value.trim()
  assert(normalized, `${name} 不能为空`)
  return normalized
}

function explicitPaths(args: string[]): string[] | null {
  const value = argument(args, '--paths', false)
  return value ? value.split(',').map((path) => path.trim()).filter(Boolean) : null
}

function gitRevision(paths: string[]): GitRevision {
  return revisionForPaths(paths)
}

function codegraphStatus(): CodeGraphStatusReceipt {
  const result = spawnSync('codegraph', ['status', '--json'], { encoding: 'utf8' })
  if (result.status !== 0) {
    return {
      initialized: false,
      projectPath: process.cwd(),
      pendingCount: 0,
      worktreeMismatch: false,
    }
  }
  return parseCodeGraphStatus(result.stdout)
}

function runCheck(command: string, environment: NodeJS.ProcessEnv): CheckReceipt {
  const startedAt = new Date().toISOString()
  const result = spawnSync(command, {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: true,
    stdio: 'inherit',
    env: environment,
  })
  return {
    command,
    exitCode: result.status ?? 1,
    startedAt,
    finishedAt: new Date().toISOString(),
    invariant: `受影响检查路由要求：${command}`,
  }
}

function writeReceipt(path: string, receipt: TaskCompletionReceipt): void {
  const absolutePath = resolve(path)
  mkdirSync(dirname(absolutePath), { recursive: true })
  writeFileSync(absolutePath, `${JSON.stringify(receipt, null, 2)}\n`)
  console.log(JSON.stringify({ status: receipt.state, receipt: absolutePath, blockers: receipt.blockers }))
}

function readReceipt(path: string): TaskCompletionReceipt {
  return parseTaskCompletionReceipt(readFileSync(resolve(path), 'utf8'))
}

function verify(args: string[]): void {
  const output = argument(args, '--output')
  const taskBoundary = argument(args, '--task-boundary')
  const stageTracePath = argument(args, '--stage-trace', false)
  const requiredSkills = argument(args, '--required-skills', false)
    .split(',')
    .map((skill) => skill.trim())
    .filter(Boolean)
  const requireTwoStageReview = args.includes('--require-two-stage-review')
  const requireStageTrace = requiredSkills.length > 0 || requireTwoStageReview
  const workspace = process.cwd()
  const instructionBefore = captureInstructionContext({
    workspace,
    taskBoundary,
    requireStageTrace,
  })
  const base = argument(args, '--base', false)
  const paths = resolveVerificationPaths({
    base: base || undefined,
    explicitPaths: explicitPaths(args),
  })
  assert(paths.length > 0, '没有可验证的变更文件')
  const route = routeAffectedChecks(paths)
  const revisionBefore = gitRevision(paths)
  const stageEvents = stageTracePath && existsSync(stageTracePath)
    ? JSON.parse(readFileSync(stageTracePath, 'utf8')) as WorkflowStageEvent[]
    : []
  const stageTrace = validateStageTrace(stageEvents, {
    requiredSkills,
    requireTwoStageReview,
  }, {
    expectedRevision: revisionBefore.head,
  })
  const before = codegraphStatus()
  const commands = [...new Set([
    ...route.fastChecks,
    ...route.governanceChecks,
    ...route.fullChecks,
  ])]
  const environment = verificationCheckEnvironment(base || undefined)
  const checks = commands.map((command) => runCheck(command, environment))
  const sync = spawnSync('codegraph', ['sync'], { cwd: workspace, encoding: 'utf8' })
  const after = codegraphStatus()
  const revisionAfter = gitRevision(paths)
  const instructionAfter = captureInstructionContext({
    workspace,
    taskBoundary,
    requireStageTrace,
  })
  const receipt = createTaskReceipt({
    workspace,
    revisionBefore,
    revisionAfter,
    instructionBefore,
    instructionAfter,
    route,
    checks,
    codegraph: {
      syncExitCode: sync.status ?? 1,
      before,
      after,
    },
    stageTrace,
  })
  writeReceipt(output, receipt)
  if (receipt.state !== 'verified') process.exitCode = 1
}

async function deliver(args: string[]): Promise<void> {
  const path = argument(args, '--receipt')
  const receipt = readReceipt(path)
  const currentPaths = receiptValidationPaths(receipt, resolveVerificationPaths())
  assertReceiptCurrent(receipt, gitRevision(currentPaths))
  assertInstructionContextCurrent(receipt.instructionContext, {
    workspace: receipt.workspace,
    requireStageTrace: receipt.stageTrace?.required,
  })
  const updated = await recordDelivery(receipt, {
    provider: argument(args, '--provider'),
    target: argument(args, '--target'),
    revision: argument(args, '--revision'),
    providerReceipt: argument(args, '--provider-receipt'),
  })
  writeReceipt(path, updated)
}

async function accept(args: string[]): Promise<void> {
  const path = argument(args, '--receipt')
  const receipt = readReceipt(path)
  const currentPaths = receiptValidationPaths(receipt, resolveVerificationPaths())
  assertReceiptCurrent(receipt, gitRevision(currentPaths))
  assertInstructionContextCurrent(receipt.instructionContext, {
    workspace: receipt.workspace,
    requireStageTrace: receipt.stageTrace?.required,
  })
  writeReceipt(path, await recordAcceptance(receipt, {
    acceptanceRef: argument(args, '--acceptance-ref'),
    expectedActor: argument(args, '--acceptance-actor'),
  }))
}

const [command, ...args] = process.argv.slice(2)
if (command === 'verify') verify(args)
else if (command === 'deliver') await deliver(args)
else if (command === 'accept') await accept(args)
else throw new Error('用法：task-completion-receipt.ts verify|deliver|accept [参数]')
