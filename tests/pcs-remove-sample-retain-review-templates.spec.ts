import assert from 'node:assert/strict'

import { listProjectTemplates } from '../src/data/pcs-templates.ts'

const templates = listProjectTemplates().filter((item) => ['TPL-001', 'TPL-002', 'TPL-003', 'TPL-004'].includes(item.id))

assert.equal(templates.length, 4, '应存在 4 个内置商品项目模板')

for (const template of templates) {
  const nodeCodes = template.nodes.map((node) => node.workItemTypeCode)
  const nodeNames = template.nodes.map((node) => node.workItemTypeName)
  assert.ok(!nodeCodes.includes('SAMPLE_RETAIN_REVIEW'), `${template.name} 不应再包含 SAMPLE_RETAIN_REVIEW`)
  assert.ok(!nodeNames.includes('样衣留存评估'), `${template.name} 不应再包含样衣留存评估`)
  assert.ok(nodeCodes.includes('SAMPLE_RETURN_HANDLE'), `${template.name} 应保留样衣退回处理节点`)
  assert.ok(nodeNames.includes('样衣退回处理'), `${template.name} 应保留样衣退回处理名称`)

  const phaseNodes = template.nodes
    .filter((node) => node.phaseCode === 'PHASE_05')
    .sort((left, right) => left.sequenceNo - right.sequenceNo)
  assert.ok(phaseNodes.length > 0, `${template.name} 应存在项目收尾阶段节点`)
  assert.equal(
    phaseNodes[phaseNodes.length - 1]?.workItemTypeCode,
    'SAMPLE_RETURN_HANDLE',
    `${template.name} 的样衣退回处理应位于项目收尾阶段最后`,
  )
  assert.deepEqual(
    phaseNodes.map((node) => node.sequenceNo),
    phaseNodes.map((_, index) => index + 1),
    `${template.name} 的项目收尾阶段 sequenceNo 应连续`,
  )
}

const fastTemplate = templates.find((item) => item.id === 'TPL-002')
assert.ok(fastTemplate?.nodes.some((node) => node.workItemTypeCode === 'SAMPLE_RETURN_HANDLE'), '快时尚款模板应补齐样衣退回处理')

const revisionTemplate = templates.find((item) => item.id === 'TPL-003')
assert.ok(revisionTemplate?.nodes.some((node) => node.workItemTypeCode === 'SAMPLE_RETURN_HANDLE'), '改版款模板应补齐样衣退回处理')
