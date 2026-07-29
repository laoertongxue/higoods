import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { routeAffectedChecks } from './workflow-governance/affected-checks.ts'
import { getWorkingTreeChangedPaths } from './workflow-governance/changed-paths.ts'
import {
  assertReceiptCurrent,
  createTaskReceipt,
  parseCodeGraphStatus,
  recordAcceptance,
  recordDelivery,
  type CheckReceipt,
  type CodeGraphStatusReceipt,
  type GitRevision,
  type TaskCompletionReceipt,
} from './workflow-governance/task-receipt.ts'

function argument(args: string[], name: string, required = true): string {
  const index = args.indexOf(name)
  const value = index >= 0 ? args[index + 1] : ''
  if (required) assert(value, `${name} 不能为空`)
  return value
}

function explicitPaths(args: string[]): string[] | null {
  const value = argument(args, '--paths', false)
  return value ? value.split(',').map((path) => path.trim()).filter(Boolean) : null
}

function gitRevision(paths: string[]): GitRevision {
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  const hash = createHash('sha256')
  hash.update(head)
  for (const path of [...paths].sort()) {
    hash.update(`\0${path}\0`)
    if (existsSync(path)) hash.update(readFileSync(path))
    else hash.update('<deleted>')
  }
  return { head, diffHash: hash.digest('hex'), changedPaths: [...paths].sort() }
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

function runCheck(command: string): CheckReceipt {
  const startedAt = new Date().toISOString()
  const result = spawnSync(command, {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: true,
    stdio: 'inherit',
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
  return JSON.parse(readFileSync(resolve(path), 'utf8')) as TaskCompletionReceipt
}

function verify(args: string[]): void {
  const output = argument(args, '--output')
  const paths = explicitPaths(args) ?? getWorkingTreeChangedPaths()
  assert(paths.length > 0, '没有可验证的变更文件')
  const workspace = process.cwd()
  const route = routeAffectedChecks(paths)
  const revisionBefore = gitRevision(paths)
  const before = codegraphStatus()
  const commands = [...new Set([
    ...route.fastChecks,
    ...route.governanceChecks,
    ...route.fullChecks,
  ])]
  const checks = commands.map(runCheck)
  const sync = spawnSync('codegraph', ['sync'], { cwd: workspace, encoding: 'utf8' })
  const after = codegraphStatus()
  const revisionAfter = gitRevision(paths)
  const receipt = createTaskReceipt({
    workspace,
    revisionBefore,
    revisionAfter,
    route,
    checks,
    codegraph: {
      syncExitCode: sync.status ?? 1,
      before,
      after,
    },
  })
  writeReceipt(output, receipt)
  if (receipt.state !== 'verified') process.exitCode = 1
}

function deliver(args: string[]): void {
  const path = argument(args, '--receipt')
  const receipt = readReceipt(path)
  assertReceiptCurrent(receipt, gitRevision(receipt.revision.changedPaths))
  const updated = recordDelivery(receipt, {
    provider: argument(args, '--provider'),
    target: argument(args, '--target'),
    revision: argument(args, '--revision'),
    providerReceipt: argument(args, '--provider-receipt'),
  })
  writeReceipt(path, updated)
}

function accept(args: string[]): void {
  const path = argument(args, '--receipt')
  const receipt = readReceipt(path)
  assertReceiptCurrent(receipt, gitRevision(receipt.revision.changedPaths))
  writeReceipt(path, recordAcceptance(receipt, {
    acceptanceRef: argument(args, '--acceptance-ref'),
  }))
}

const [command, ...args] = process.argv.slice(2)
if (command === 'verify') verify(args)
else if (command === 'deliver') deliver(args)
else if (command === 'accept') accept(args)
else throw new Error('用法：task-completion-receipt.ts verify|deliver|accept [参数]')
