import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const collectors = [
  'scripts/check-wool-action-performance.mjs', 'scripts/check-wool-extra-action-performance.mjs',
  'scripts/check-wool-print-extra-performance.mjs', 'scripts/check-wool-remaining-action-performance.mjs',
  'scripts/check-wool-route-performance.mjs', 'scripts/check-wool-stage-browser.mjs',
  'tests/pms-interaction-audit.spec.ts', 'tests/browser-contracts/pcs-sample-actions.test.ts',
  'tests/browser-contracts/pcs-sample-action-boundaries.test.ts',
  'tests/browser/verify-cut-piece-release-supplement.py', 'tests/browser/verify-cut-piece-release-idb-open.py',
]

export function checkCollectorDefaults(source, filename) {
  assert(!/\b(?:out|output|OUT_DIR)\s*=.*(?:['"`]docs\/|['"]docs['"])/.test(source), `${filename}: generated output defaults to docs`)
  assert(!/Path\(['"]docs\/[^'"\n]+['"]\)\.write_(?:text|bytes)/.test(source), `${filename}: generated output writes to docs`)
  assert(source.includes('output/'), `${filename}: missing local output directory`)
}

function files(root, directory) {
  return readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap(entry => {
    const relative = path.posix.join(directory, entry.name)
    return entry.isDirectory() ? files(root, relative) : [relative]
  })
}

function treePaths(root, ref) {
  const source = execFileSync('git', ['ls-tree', '-rz', '--name-only', ref], { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
  const result = new Set(source.split('\0').filter(Boolean))
  for (const filename of [...result]) {
    let parent = path.posix.dirname(filename)
    while (parent !== '.') { result.add(parent); parent = path.posix.dirname(parent) }
  }
  return result
}

export function checkDocuments(root = process.cwd(), base = 'HEAD') {
  const oldPaths = treePaths(root, base)
  const historyTrees = new Map()
  const errors = [], preexistingMissing = [], history = []
  let links = 0
  for (const filename of ['README.md', 'architecture.md', ...files(root, 'docs').filter(p => p.endsWith('.md'))]) {
    const source = readFileSync(path.join(root, filename), 'utf8')
    let original = ''
    if (oldPaths.has(filename)) original = execFileSync('git', ['show', `${base}:${filename}`], { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 })
    for (const match of source.matchAll(/\]\(([^)\n]+)\)/g)) {
      const raw = match[1].replace(/^<|>$/g, '').replace(/\s+["'].*$/, '')
      if (raw.startsWith('#') || /^(?:mailto:|data:|javascript:|app:|codex:)/.test(raw)) continue
      const line = source.slice(0, match.index).split('\n').length
      const archived = raw.match(/^https:\/\/(?:github\.com\/laoertongxue\/higoods\/(?:blob|tree)\/|raw\.githubusercontent\.com\/laoertongxue\/higoods\/)([a-f0-9]{40})\/(.+)$/)
      if (archived) {
        const [, ref, encoded] = archived
        if (!historyTrees.has(ref)) historyTrees.set(ref, treePaths(root, ref))
        const target = decodeURIComponent(encoded.split('#')[0])
        if (!historyTrees.get(ref).has(target)) errors.push(`${filename}:${line}: invalid history target ${target}`)
        history.push({ filename, line, ref, target })
        continue
      }
      if (/^[a-z][a-z\d+.-]*:|^\/\//i.test(raw)) continue
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(filename), decodeURIComponent(raw.split('#')[0])))
      if (raw.startsWith('/')) continue // App routes and local-machine links are outside repository document checks.
      links++
      if (existsSync(path.join(root, target))) continue
      if (!oldPaths.has(target) && original.includes(match[0])) preexistingMissing.push(`${filename}:${line}: ${target}`)
      else errors.push(`${filename}:${line}: missing local target ${target}`)
    }
  }
  for (const filename of collectors) checkCollectorDefaults(readFileSync(path.join(root, filename), 'utf8'), filename)
  assert.equal(errors.length, 0, errors.join('\n'))
  return { localLinks: links, historyLinks: history.length, collectors: collectors.length, preexistingMissing }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  assert(args.length === 0 || (args.length === 2 && args[0] === '--base'), 'Usage: check-document-integrity.mjs [--base <ref>]')
  const result = checkDocuments(process.cwd(), args[1] || 'HEAD')
  console.log(JSON.stringify({ ...result, preexistingMissingCount: result.preexistingMissing.length, preexistingMissing: result.preexistingMissing.slice(0, 8) }, null, 2))
}
