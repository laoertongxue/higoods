import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const workspaceRoot = fileURLToPath(new URL('..', import.meta.url))
const script = `
  const policy = await import('./src/data/pcs-engineering-first-production-policy.ts')
  if (!policy.hasFormalProductionFact('ASYSA26060310')) process.exit(21)
  try {
    policy.assertFirstFormalProduction('ASYSA26060310')
    process.exit(22)
  } catch (error) {
    if (!String(error).includes('已经正式生产过')) process.exit(23)
  }
`
const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', script], {
  cwd: workspaceRoot,
  encoding: 'utf8',
})

assert.equal(
  result.status,
  0,
  `独立进程仅导入首单策略时也必须识别 ASYSA26060310 的正式生产事实。\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
)

console.log('pcs-engineering-first-production-cold-start.spec.ts PASS')
