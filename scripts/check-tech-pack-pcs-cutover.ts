import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const srcRoot = path.join(repoRoot, 'src')

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      walk(fullPath, files)
    } else {
      files.push(fullPath)
    }
  }
  return files
}

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

const whitelist = new Set([
  'src/data/pcs-technical-data-version-bootstrap.ts',
  'src/data/pcs-technical-data-runtime-source.ts',
])

const directImportHits = walk(srcRoot)
  .map((absolutePath) => path.relative(repoRoot, absolutePath))
  .filter((relativePath) => relativePath.endsWith('.ts') || relativePath.endsWith('.tsx'))
  .filter((relativePath) => {
    const source = read(relativePath)
    return /from ['"][^'"]*fcs\/tech-packs(?:\.ts)?['"]/.test(source)
  })

const illegalHits = directImportHits.filter((relativePath) => !whitelist.has(relativePath))
assert.deepEqual(
  illegalHits,
  [],
  `运行时直接导入 src/data/fcs/tech-packs.ts 的文件超出白名单：${illegalHits.join(', ')}`,
)

const productionEventsSource = read('src/pages/production/events.ts')
assert.ok(
  productionEventsSource.includes('resolveTechnicalDataEntryBySpuCode'),
  '生产页打开技术资料入口必须走统一入口解析器',
)
assert.ok(
  !productionEventsSource.includes('/fcs/tech-pack/'),
  '生产页不应继续直接拼接旧 FCS 技术资料路由',
)

const progressEventsSource = read('src/pages/progress-exceptions/events.ts')
assert.ok(
  progressEventsSource.includes('resolveTechnicalDataEntryBySpuCode'),
  '异常页打开技术资料入口必须走统一入口解析器',
)

const techPackContextSource = read('src/pages/tech-pack/context.ts')
assert.ok(!techPackContextSource.includes('updateTechPack('), '兼容页上下文不应直接写旧 FCS 技术资料快照')
assert.ok(!techPackContextSource.includes('getOrCreateTechPack('), '兼容页上下文不应再创建旧 FCS 技术资料快照')
assert.ok(
  techPackContextSource.includes('当前为兼容查看入口，请在商品中心维护技术资料版本'),
  'FCS 兼容页必须展示只读兼容说明',
)

const techPackCoreSource = read('src/pages/tech-pack/core.ts')
assert.ok(
  techPackCoreSource.includes('技术资料兼容查看'),
  'FCS 兼容页标题必须明确为技术资料兼容查看',
)
assert.ok(
  techPackCoreSource.includes('技术资料版本 -'),
  'PCS 正式技术资料页主标题必须保持技术资料版本口径',
)

const routesSource = read('src/router/routes.ts')
assert.ok(routesSource.includes('compatibilityMode: true'), '必须保留 /fcs/tech-pack/:spuCode 兼容入口路由')

console.log('check-tech-pack-pcs-cutover.ts PASS')
