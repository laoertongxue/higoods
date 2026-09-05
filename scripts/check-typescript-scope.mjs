import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const requestedScopes = process.argv.slice(2)
const scopes = (requestedScopes.length ? requestedScopes : ['src/domain/', 'src/components/ui/', 'src/state/']).map(
  (scope) => scope.replaceAll('\\', '/').replace(/^\.\//, ''),
)

const tscExecutable = resolve(process.cwd(), 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc')
const result = spawnSync(tscExecutable, ['--noEmit', '--pretty', 'false'], {
  cwd: process.cwd(),
  encoding: 'utf8',
  maxBuffer: 128 * 1024 * 1024,
})

if (result.error) throw result.error

const output = `${result.stdout || ''}${result.stderr || ''}`
const errorLines = output.split(/\r?\n/).filter((line) => /\berror TS\d+:/.test(line))
const scopedErrors = errorLines.filter((line) => {
  const normalized = line.replaceAll('\\', '/')
  return scopes.some((scope) => normalized.startsWith(scope))
})

console.log(`TypeScript 全量既有错误：${errorLines.length}`)
console.log(`本次渐进检查范围：${scopes.join('、')}`)

if (scopedErrors.length) {
  console.error(`范围内错误：${scopedErrors.length}`)
  console.error(scopedErrors.join('\n'))
  process.exitCode = 1
} else {
  console.log('范围内错误：0')
  if (errorLines.length) console.log('范围外既有错误保留在全量 typecheck 中继续分批治理。')
}
