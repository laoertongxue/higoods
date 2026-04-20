import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import { listProjectTemplates } from '../src/data/pcs-templates.ts'
import { listProjectWorkItemContracts } from '../src/data/pcs-project-domain-contract.ts'

const cwd = process.cwd()
const removedCode = 'SAMPLE_RETAIN_REVIEW'
const removedName = '样衣留存评估'
const targetCode = 'SAMPLE_RETURN_HANDLE'

function readText(relativePath: string): string {
  return fs.readFileSync(path.join(cwd, relativePath), 'utf8')
}

const filesMustNotContainRemoved = [
  'src/data/pcs-project-domain-contract.ts',
  'src/data/pcs-templates.ts',
  'src/data/pcs-project-bootstrap.ts',
  'src/data/pcs-project-demo-seed-service.ts',
  'src/data/pcs-project-inline-node-record-bootstrap.ts',
  'src/data/pcs-project-inline-node-record-repository.ts',
  'src/data/pcs-work-item-runtime-carrier.ts',
  'src/data/pcs-work-item-configs/engineering-configs.ts',
  'src/pages/pcs-projects.ts',
  'src/pages/pcs-templates.ts',
  'src/pages/pcs-work-items.ts',
]

for (const file of filesMustNotContainRemoved) {
  const source = readText(file)
  assert.ok(!source.includes(removedCode), `${file} 不应再包含 ${removedCode}`)
  assert.ok(!source.includes(removedName), `${file} 不应再包含 ${removedName}`)
}

const migrationSource = readText('src/data/pcs-project-repository.ts')
assert.ok(
  migrationSource.includes('removeSampleRetainReviewFromProjectSnapshot'),
  '项目仓储必须调用样衣留存评估清理函数',
)

const migrationFile = readText('src/data/pcs-remove-sample-retain-review-migration.ts')
assert.ok(migrationFile.includes('ensureSampleReturnHandleNode'), '清理文件必须包含样衣退回处理补齐函数')
assert.ok(
  migrationFile.includes('repairProjectNodeSequenceAfterRemovingRetainReview'),
  '清理文件必须包含删除旧节点后的顺序修复函数',
)

const templates = listProjectTemplates().filter((item) => ['TPL-001', 'TPL-002', 'TPL-003', 'TPL-004'].includes(item.id))
assert.equal(templates.length, 4, '应存在 4 个内置模板')
for (const template of templates) {
  assert.ok(
    template.nodes.some((node) => node.workItemTypeCode === targetCode),
    `${template.name} 必须保留样衣退回处理`,
  )
  assert.ok(
    !template.nodes.some((node) => node.workItemTypeCode === removedCode),
    `${template.name} 不应再包含样衣留存评估`,
  )
}

assert.ok(
  listProjectWorkItemContracts().some((item) => item.workItemTypeCode === targetCode),
  'SAMPLE_RETURN_HANDLE 不应被误删',
)

console.log('check-pcs-remove-sample-retain-review: ok')
