import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

type PackageJson = {
  scripts?: Record<string, string>
}

const ROOT = process.cwd()

function readText(path: string): string {
  return readFileSync(join(ROOT, path), 'utf8')
}

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

function listPackageScriptMissingFiles(): string[] {
  const packageJson = JSON.parse(readText('package.json')) as PackageJson
  const missing: string[] = []
  Object.entries(packageJson.scripts || {}).forEach(([scriptName, command]) => {
    for (const match of command.matchAll(/(?:^|\s)(?:scripts|tests)\/[^\s]+\.(?:ts|tsx|mjs|js)/g)) {
      const filePath = match[0].trim()
      if (filePath.includes('*')) continue
      if (!existsSync(join(ROOT, filePath))) missing.push(`${scriptName} -> ${filePath}`)
    }
  })
  return missing
}

function listFilesRecursively(path: string): string[] {
  const absolutePath = join(ROOT, path)
  if (!existsSync(absolutePath)) return []
  if (statSync(absolutePath).isFile()) return [path]
  return readdirRecursively(path)
}

function readdirRecursively(path: string): string[] {
  return readdirSync(join(ROOT, path), { withFileTypes: true }).flatMap((entry) => {
    const childPath = `${path}/${entry.name}`
    if (entry.isDirectory()) return readdirRecursively(childPath)
    return childPath
  })
}

function listCuttingLegacyTermMatches(): string[] {
  const scanTargets = [
    'src/pages/process-factory/cutting',
    'src/data/fcs/cutting',
    'src/pages/progress-material.ts',
  ]
  const terms = [
    '合并裁剪',
    '合并批次',
    '裁片批次',
    '可裁剪',
    '不可裁剪',
    '原始裁片单',
    '唛架方案列表',
    'WMS待处理',
    'WMS 待处理',
    '交出车缝',
    '裁片发料',
    '上下文类型',
    '来源类型',
    '来料单',
    '配料状态',
    '领料状态',
  ]
  const matches: string[] = []
  scanTargets
    .flatMap(listFilesRecursively)
    .filter((path) => /\.(ts|tsx)$/.test(path))
    .forEach((path) => {
      const lines = readText(path).split('\n')
      lines.forEach((line, index) => {
        terms.forEach((term) => {
          if (line.includes(term)) matches.push(`${path}:${index + 1}: ${term}`)
        })
      })
    })
  return matches
}

const missingFiles = listPackageScriptMissingFiles()
if (missingFiles.length) {
  fail(`package.json 存在失效脚本引用：\n${missingFiles.join('\n')}`)
}

const legacyMatches = listCuttingLegacyTermMatches()
if (legacyMatches.length) {
  fail(`裁床相关代码存在旧业务词残留：\n${legacyMatches.join('\n')}`)
}

console.log('check-project-cleanliness passed')
