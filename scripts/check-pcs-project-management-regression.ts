import { spawnSync } from 'node:child_process'
import {
  PCS_PROJECT_MANAGEMENT_FULL_ACCEPTANCE_TASKS,
  type ProjectManagementAcceptanceTask,
} from './pcs-project-management-acceptance-tasks.ts'

const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const nodeBin = process.execPath

function executeTask(task: ProjectManagementAcceptanceTask): { ok: boolean; output: string } {
  const result =
    task.kind === 'npm-script'
      ? spawnSync(npmBin, ['run', task.command], { encoding: 'utf8' })
      : spawnSync(
          nodeBin,
          ['--experimental-strip-types', '--experimental-specifier-resolution=node', task.file],
          { encoding: 'utf8' },
        )
  const stdout = result.stdout || ''
  const stderr = result.stderr || ''

  if (stdout) process.stdout.write(stdout)
  if (stderr) process.stderr.write(stderr)

  return {
    ok: result.status === 0,
    output: `${stdout}\n${stderr}`,
  }
}

function collectGapLines(output: string): string[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      if (line.startsWith('- ')) return [line]
      if (
        line.includes('缺少') ||
        line.includes('缺口') ||
        line.includes('仅有') ||
        line.includes('低于') ||
        line.includes('failed') ||
        line.includes('Error:')
      ) {
        return [`- ${line}`]
      }
      return []
    })
}

const passed: string[] = []
const failed: string[] = []
const gapLines: string[] = []

console.log('商品项目管理聚合回归开始')

for (const task of PCS_PROJECT_MANAGEMENT_FULL_ACCEPTANCE_TASKS) {
  const target = task.kind === 'npm-script' ? task.command : task.file
  process.stdout.write(`\n========== ${task.label}（${target}） ==========\n`)
  const result = executeTask(task)
  if (result.ok) {
    passed.push(task.label)
  } else {
    failed.push(task.label)
    gapLines.push(...collectGapLines(result.output))
  }
}

console.log('\n商品项目管理聚合回归结果')
console.log('通过项：')
if (passed.length === 0) {
  console.log('- 无')
} else {
  passed.forEach((item) => console.log(`- ${item}`))
}

console.log('失败项：')
if (failed.length === 0) {
  console.log('- 无')
} else {
  failed.forEach((item) => console.log(`- ${item}`))
}

console.log('缺口节点：')
const uniqueGapLines = [...new Set(gapLines)]
if (uniqueGapLines.length === 0) {
  console.log('- 无')
} else {
  uniqueGapLines.forEach((item) => console.log(item))
}

console.log('下一步建议：')
if (failed.length === 0) {
  console.log('- 当前商品项目管理的检查脚本、节点 spec 与页面 smoke test 已全部通过，可以继续扩展更多浏览器回归用例。')
} else {
  console.log('- 请优先修复失败项，再重新执行商品项目管理聚合回归。')
}

process.exit(failed.length === 0 ? 0 : 1)
