import { spawnSync } from 'node:child_process'
import {
  PCS_PROJECT_MANAGEMENT_READINESS_TASKS,
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
      if (line.includes('缺少') || line.includes('缺口') || line.includes('仅有') || line.includes('低于')) {
        return [`- ${line}`]
      }
      return []
    })
}

const passed: string[] = []
const failed: string[] = []
const gapLines: string[] = []

for (const task of PCS_PROJECT_MANAGEMENT_READINESS_TASKS) {
  const header =
    task.kind === 'npm-script'
      ? `\n========== ${task.label}（${task.command}） ==========\n`
      : `\n========== ${task.label}（${task.file}） ==========\n`
  process.stdout.write(header)

  const result = executeTask(task)
  if (result.ok) {
    passed.push(task.label)
  } else {
    failed.push(task.label)
    gapLines.push(...collectGapLines(result.output))
  }
}

console.log('\n商品项目管理最终总验收结果')
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
  console.log('- 当前商品项目管理相关 check 与关键 spec 已全部通过，可以进入页面联调、浏览器回归和演示验收。')
} else {
  console.log('- 请先修复失败项对应的问题，再重新执行商品项目管理最终总验收。')
}

process.exit(failed.length === 0 ? 0 : 1)
