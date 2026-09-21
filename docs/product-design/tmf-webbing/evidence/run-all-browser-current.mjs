import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawn, execFileSync } from 'node:child_process'

const dir = 'docs/product-design/tmf-webbing/evidence'
const outdir = path.join(dir, 'full-run-20260921-current')
fs.mkdirSync(outdir, { recursive: true })
const files = fs.readdirSync(dir).filter(file => file.endsWith('-browser.mjs')).sort()
const branch = execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim()
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const runId = `tmf-browser-${new Date().toISOString().replace(/[:.]/g, '-')}`
const sha256Buffer = value => crypto.createHash('sha256').update(value).digest('hex')
const sha256File = file => sha256Buffer(fs.readFileSync(file))

function parseEvidenceOutput(stdout) {
  const text = stdout.trim()
  if (!text) return null
  try { return JSON.parse(text) } catch {}
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try { return JSON.parse(text.slice(start, end + 1)) } catch { return null }
}

function observableSummary(value) {
  if (!value) return { mode: 'source-assertions-only', checks: 0, checkpoints: 0, samples: 0, errors: 0, count: 0 }
  const checks = Array.isArray(value.checks) ? value.checks.length : 0
  const checkpoints = Array.isArray(value.checkpoints) ? value.checkpoints.length : 0
  const samples = Array.isArray(value.samples) ? value.samples.length : 0
  const errors = Array.isArray(value.errors) ? value.errors.length : 0
  return { mode: 'fresh-child-stdout-json', checks, checkpoints, samples, errors, count: checks + checkpoints + samples }
}

const results = []
for (const file of files) {
  const scriptPath = path.join(dir, file)
  const source = fs.readFileSync(scriptPath, 'utf8')
  const assertionCallCount = (source.match(/\bassert(?:\.|\s*\()/g) ?? []).length
  const measurementCallCount = (source.match(/performance\.now|performance\.getEntries|\bsamples?\b|\bmeasure\b/g) ?? []).length
  const log = path.join(outdir, file.replace(/\.mjs$/, '.log'))
  const receiptPath = path.join(outdir, file.replace(/\.mjs$/, '.receipt.json'))
  const startedAt = new Date().toISOString()
  const child = spawn(process.execPath, [scriptPath], { stdio: ['ignore', 'pipe', 'pipe'] })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', data => { stdout += data })
  child.stderr.on('data', data => { stderr += data })
  const rc = await new Promise(resolve => {
    const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(124) }, 90000)
    child.on('close', code => { clearTimeout(timer); resolve(code ?? 1) })
  })
  const finishedAt = new Date().toISOString()
  const combined = stdout + stderr
  fs.writeFileSync(log, combined)
  const parsed = parseEvidenceOutput(stdout)
  const observable = observableSummary(parsed)
  const hasExecutableAssertions = assertionCallCount > 0 || measurementCallCount > 0 || observable.count > 0
  const passed = rc === 0 && hasExecutableAssertions && observable.errors === 0
  const receipt = {
    runId,
    branch,
    head,
    script: file,
    scriptPath,
    scriptSourceSha256: sha256File(scriptPath),
    startedAt,
    finishedAt,
    exitCode: rc,
    assertionCallCount,
    measurementCallCount,
    observable,
    stdoutBytes: Buffer.byteLength(stdout),
    stderrBytes: Buffer.byteLength(stderr),
    log: path.relative(dir, log).replaceAll(path.sep, '/'),
    logSha256: sha256Buffer(combined),
    pass: passed,
  }
  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n')
  results.push({
    file,
    rc,
    passed,
    startedAt,
    finishedAt,
    log: path.relative(dir, log).replaceAll(path.sep, '/'),
    receipt: path.relative(dir, receiptPath).replaceAll(path.sep, '/'),
    receiptSha256: sha256File(receiptPath),
    assertionCallCount,
    measurementCallCount,
    observable,
  })
  console.log(`${file} ${rc} ${passed ? 'PASS' : 'FAIL'} assertions=${assertionCallCount} observed=${observable.count}`)
}

const output = {
  generatedAt: new Date().toISOString(),
  runId,
  branch,
  head,
  executionModel: '每个脚本由独立 Node child process 启动；每个 child 生成带 runId、当前 HEAD、源码 SHA、起止时间、退出码、当前日志 SHA 和断言计数的独立收据。',
  total: results.length,
  passed: results.filter(result => result.passed).length,
  failed: results.filter(result => !result.passed).length,
  results,
}
fs.writeFileSync(path.join(dir, '2026-09-20-full-browser-run-current.json'), JSON.stringify(output, null, 2) + '\n')
if (output.failed) process.exitCode = 1
