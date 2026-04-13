import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  normalizeLegacyProjectTemplateSeed,
} from '../src/data/pcs-project-definition-normalizer.ts'

const normalized = normalizeLegacyProjectTemplateSeed({
  templateId: 'TPL-TEST-LEGACY',
  templateVersion: '2026-04-10 09:00',
  stages: [
    {
      name: '项目收尾',
      workItems: [{ name: '样衣留存与库存', required: '可选' }],
    },
    {
      name: '市场测款',
      workItems: [{ name: '未知旧工作项' }],
    },
  ],
})

assert.ok(
  normalized.nodes.some((item) => item.workItemTypeCode === 'SAMPLE_RETAIN_REVIEW'),
  '旧模板中的“样衣留存与库存”应迁移到正式编码 SAMPLE_RETAIN_REVIEW',
)
assert.ok(
  normalized.pendingNodes.some((item) => item.legacyWorkItemName === '未知旧工作项'),
  '未知旧名称不得自动猜测，必须进入待处理列表',
)

const templateEditorSource = readFileSync(
  new URL('../src/pages/pcs-template-editor.ts', import.meta.url),
  'utf8',
)
assert.ok(
  !templateEditorSource.includes('data-pcs-template-editor-field="workItemName"'),
  '模板编辑页不应再允许自由输入工作项名称',
)
assert.ok(
  !templateEditorSource.includes('data-pcs-template-editor-field="workItemType"'),
  '模板编辑页不应再允许自由选择工作项类型',
)
assert.ok(
  !templateEditorSource.includes('字段模板文本'),
  '模板编辑页不应再出现字段模板文本自由输入',
)
assert.ok(
  !templateEditorSource.includes('listSelectableTemplateWorkItems'),
  '模板编辑页不应再保留自由工作项库新增能力',
)
assert.ok(
  !templateEditorSource.includes('data-pcs-template-editor-action="open-library"'),
  '模板编辑页不应再保留工作项库弹窗入口',
)
assert.ok(
  templateEditorSource.includes('listProjectTemplateSchemas'),
  '模板编辑页应从正式模板矩阵读取模板结构',
)
assert.ok(
  templateEditorSource.includes('getProjectTemplateSchema'),
  '模板编辑页应基于正式模板契约加载节点配置',
)
assert.ok(
  templateEditorSource.includes('findSchemaByStyleType'),
  '模板新增流程应先按适用款式类型匹配正式模板骨架',
)
assert.ok(
  templateEditorSource.includes('data-pcs-template-editor-field="styleType"'),
  '模板新增页应先选择适用款式类型',
)
assert.ok(
  templateEditorSource.includes('data-pcs-template-editor-field="nodeSequenceNo"'),
  '模板编辑页应允许在正式规则内调整节点顺序',
)
assert.ok(
  templateEditorSource.includes('data-pcs-template-editor-field="nodeRequiredFlag"'),
  '模板编辑页应允许在正式规则内调整节点必做属性',
)
assert.ok(
  templateEditorSource.includes('data-pcs-template-editor-field="nodeMultiInstanceFlag"'),
  '模板编辑页应允许在正式规则内调整多实例开关',
)
assert.ok(
  templateEditorSource.includes('getTemplateNodeEditRule'),
  '模板编辑页应使用正式编辑规则约束节点可编辑项',
)

console.log('pcs-project-template-node-source.spec.ts PASS')
