import { readdirSync, readFileSync, writeFileSync, statSync } from 'fs'
import { join, resolve } from 'path'

const fcsDir = resolve('/vercel/share/v0-project', 'app/fcs')

function getAllPageFiles(dir) {
  const results = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      results.push(...getAllPageFiles(full))
    } else if (entry === 'page.tsx' || entry === 'layout.tsx') {
      results.push(full)
    }
  }
  return results
}

const files = getAllPageFiles(fcsDir)
let patched = 0

for (const file of files) {
  const content = readFileSync(file, 'utf8')
  if (!content.startsWith("'use client'")) {
    writeFileSync(file, `'use client'\n\n${content}`)
    console.log(`Patched: ${file}`)
    patched++
  }
}

console.log(`Done. Patched ${patched} of ${files.length} files.`)
