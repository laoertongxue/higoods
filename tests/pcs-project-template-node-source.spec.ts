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
  templateEditorSource.includes('listSelectableTemplateWorkItems'),
  '模板编辑页新增节点时应从标准工作项库选择',
)
assert.ok(
  templateEditorSource.includes('data-pcs-template-editor-action="open-library"'),
  '模板编辑页应保留从工作项库选择的入口',
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

console.log('pcs-project-template-node-source.spec.ts PASS')
