import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildBuiltinProjectTemplateMatrix,
  listProjectPhaseContracts,
  listProjectTemplateSchemas,
  listProjectWorkItemContracts,
  resolveLegacyProjectWorkItemCode,
} from '../src/data/pcs-project-domain-contract.ts'
import { listProjectTemplates } from '../src/data/pcs-templates.ts'
import { listStandardProjectWorkItemIdentities } from '../src/data/pcs-work-item-configs.ts'

function read(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

const phaseContracts = listProjectPhaseContracts()
assert.equal(phaseContracts.length, 5, '正式项目阶段必须固定为 5 个')
assert.deepEqual(
  phaseContracts.map((item) => item.phaseName),
  ['立项获取', '样衣与评估', '商品上架与市场测款', '款式档案与开发推进', '项目收尾'],
  '正式项目阶段名称必须与领域契约一致',
)

const workItemContracts = listProjectWorkItemContracts()
assert.ok(
  workItemContracts.some((item) => item.workItemTypeCode === 'CHANNEL_PRODUCT_LISTING'),
  '正式工作项中必须包含 CHANNEL_PRODUCT_LISTING',
)
assert.ok(
  !workItemContracts.some((item) => item.workItemTypeCode === 'CHANNEL_PRODUCT_PREP'),
  '正式工作项中不得保留 CHANNEL_PRODUCT_PREP',
)
assert.equal(
  resolveLegacyProjectWorkItemCode('CHANNEL_PRODUCT_PREP'),
  'CHANNEL_PRODUCT_LISTING',
  '旧编码 CHANNEL_PRODUCT_PREP 必须统一映射到 CHANNEL_PRODUCT_LISTING',
)

const schemas = listProjectTemplateSchemas()
const builtins = buildBuiltinProjectTemplateMatrix()
const builtinTemplateMap = new Map(listProjectTemplates().map((item) => [item.id, item]))
assert.deepEqual(
  schemas.map((item) => item.templateId),
  ['TPL-001', 'TPL-002', 'TPL-003', 'TPL-004'],
  '正式模板矩阵必须固定为四类模板',
)

schemas.forEach((schema) => {
  const phase03 = schema.phaseSchemas.find((item) => item.phaseCode === 'PHASE_03')
  assert.ok(phase03, `${schema.templateId} 必须包含 PHASE_03`)
  assert.ok(
    phase03?.nodeCodes.includes('CHANNEL_PRODUCT_LISTING'),
    `${schema.templateId} 的 PHASE_03 必须包含 CHANNEL_PRODUCT_LISTING`,
  )
  assert.ok(
    !schema.phaseSchemas.some((phase) => phase.nodeCodes.some((code) => code === 'CHANNEL_PRODUCT_PREP')),
    `${schema.templateId} 不得保留 CHANNEL_PRODUCT_PREP`,
  )

  const builtin = builtins.find((item) => item.templateId === schema.templateId)
  assert.ok(builtin, `${schema.templateId} 必须生成正式模板矩阵`)
  assert.deepEqual(
    builtin?.stages.map((item) => item.phaseCode),
    schema.phaseSchemas.map((item) => item.phaseCode),
    `${schema.templateId} 的内建阶段顺序必须与领域契约一致`,
  )
  schema.phaseSchemas.forEach((phase) => {
    assert.deepEqual(
      builtin?.nodes.filter((item) => item.phaseCode === phase.phaseCode).map((item) => item.workItemTypeCode),
      phase.nodeCodes,
      `${schema.templateId} / ${phase.phaseCode} 的节点矩阵必须与领域契约一致`,
    )
  })

  const template = builtinTemplateMap.get(schema.templateId)
  assert.ok(template, `${schema.templateId} 必须存在正式模板仓储记录`)
  assert.deepEqual(
    template?.stages.map((item) => item.phaseCode),
    schema.phaseSchemas.map((item) => item.phaseCode),
    `${schema.templateId} 的正式模板阶段必须与领域契约一致`,
  )
  schema.phaseSchemas.forEach((phase) => {
    assert.deepEqual(
      template?.nodes.filter((item) => item.phaseCode === phase.phaseCode).map((item) => item.workItemTypeCode),
      phase.nodeCodes,
      `${schema.templateId} / ${phase.phaseCode} 的正式模板节点必须与领域契约一致`,
    )
  })
})

const standardCodes = new Set(listStandardProjectWorkItemIdentities().map((item) => item.workItemTypeCode))
workItemContracts.forEach((item) => {
  assert.ok(standardCodes.has(item.workItemTypeCode), `标准工作项映射缺少 ${item.workItemTypeCode}`)
})

const templateDetailSource = read('src/pages/pcs-template-detail.ts')
assert.ok(templateDetailSource.includes('模板适用场景'), '模板详情页必须展示模板适用场景')
assert.ok(templateDetailSource.includes('节点业务说明'), '模板详情页必须展示节点业务说明')

const templateEditorSource = read('src/pages/pcs-template-editor.ts')
assert.ok(templateEditorSource.includes('正式矩阵锁定'), '模板编辑页必须明确提示正式矩阵锁定')
assert.ok(!templateEditorSource.includes('新增阶段'), '模板编辑页不应继续渲染新增阶段按钮')

const bootstrapSource = read('src/data/pcs-project-bootstrap.ts')
assert.ok(
  bootstrapSource.includes("PRODUCT_LISTING: 'CHANNEL_PRODUCT_LISTING'"),
  '项目初始化旧节点编码必须映射到 CHANNEL_PRODUCT_LISTING',
)

console.log('check-pcs-project-domain-contract.ts PASS')
