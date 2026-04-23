import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const forbidden = [
  ['PROJECT', 'TRANSFER', 'PREP'].join('_'),
  ['项目', '转档', '准备'].join(''),
  ['转档', '准备'].join(''),
  ['项目', '转档'].join(''),
]

const targetRoots = ['src/data', 'src/pages', 'tests', 'scripts']
const allowedSelf = path.normalize('tests/pcs-project-archive-no-transfer-prep.spec.ts')

function listFiles(dir: string): string[] {
  const absolute = path.join(ROOT, dir)
  if (!fs.existsSync(absolute)) return []
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(dir, entry.name)
    if (entry.isDirectory()) return listFiles(relative)
    return entry.isFile() ? [relative] : []
  })
}

const hits: string[] = []
targetRoots.flatMap(listFiles).forEach((relativePath) => {
  if (path.normalize(relativePath) === allowedSelf) return
  const content = fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
  forbidden.forEach((word) => {
    if (content.includes(word)) hits.push(`${relativePath} 包含旧节点残留`)
  })
})

assert.deepEqual(hits, [], `不得重新引入旧准备性节点：${hits.join('；')}`)

console.log('pcs-project-archive-no-transfer-prep.spec.ts PASS')
