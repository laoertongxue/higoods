import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const masterRepositorySource = readFileSync(
  new URL('../src/data/pcs-engineering-master-repository.ts', import.meta.url),
  'utf8',
)

assert.doesNotMatch(
  masterRepositorySource,
  /from ['"]\.\/pcs-technical-data-version-repository\.ts['"]/,
  '工程主单仓储不得反向导入技术版本仓储，跨仓关闭门禁应由轻量领域服务编排',
)

console.log('pcs-engineering-master-close-service-boundary.spec.ts PASS')
