import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  getStandardProjectWorkItemIdentityById,
  listStandardProjectWorkItemIdentities,
} from '../src/data/pcs-work-item-configs.ts'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

function readSource(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

const templateSource = readSource('src/data/pcs-templates.ts')
assert.ok(
  !templateSource.includes('TEMPLATE_WORK_ITEM_LIBRARY'),
  '不应再保留并行的 TEMPLATE_WORK_ITEM_LIBRARY',
)

const identities = listStandardProjectWorkItemIdentities()
const codes = identities.map((item) => item.workItemTypeCode)
assert.equal(new Set(codes).size, codes.length, '正式工作项编码不得重复映射')

const wi001 = getStandardProjectWorkItemIdentityById('WI-001')
assert.equal(wi001?.workItemTypeCode, 'PROJECT_INIT', 'WI-001 含义必须固定为商品项目立项')
assert.equal(wi001?.workItemTypeName, '商品项目立项', 'WI-001 名称必须固定')

const templateEditorSource = readSource('src/pages/pcs-template-editor.ts')
assert.ok(
  !templateEditorSource.includes('data-pcs-template-editor-field="workItemName"'),
  '模板编辑页不应再渲染工作项名称自由输入框',
)
assert.ok(
  !templateEditorSource.includes('data-pcs-template-editor-field="workItemType"'),
  '模板编辑页不应再渲染工作项类型自由输入框',
)
assert.ok(
  !templateEditorSource.includes('字段模板文本'),
  '模板编辑页不应再渲染字段模板文本自由输入',
)
assert.ok(
  templateEditorSource.includes('listSelectableTemplateWorkItems'),
  '模板编辑页应从统一工作项库选择标准工作项',
)

const repositorySource = readSource('src/data/pcs-project-repository.ts')
assert.ok(
  repositorySource.includes('buildProjectNodeRecordsFromTemplate'),
  '项目创建必须调用节点生成工厂',
)
assert.ok(
  repositorySource.includes('buildProjectPhaseRecordsFromTemplate'),
  '项目创建必须调用阶段生成工厂',
)
assert.ok(
  !repositorySource.includes('resolveProjectWorkItemTypeCodeByName'),
  '项目创建不应再按自由文本工作项名称推导正式编码',
)

console.log(`check-pcs-project-definition-unification.ts PASS (${repoRoot})`)
