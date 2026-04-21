import assert from 'node:assert/strict'

import { listProjectTemplates } from '../src/data/pcs-templates.ts'

const expectedNextNodeByTemplateName = new Map([
  ['基础款 - 完整测款转档模板', 'VIDEO_TEST'],
  ['快时尚款 - 直播快反模板', 'LIVE_TEST'],
  ['改版款 - 改版测款转档模板', 'LIVE_TEST'],
  ['设计款 - 设计验证模板', 'VIDEO_TEST'],
])

for (const template of listProjectTemplates()) {
  const sortedNodes = template.nodes
    .slice()
    .sort((a, b) => (a.phaseCode === b.phaseCode ? a.sequenceNo - b.sequenceNo : a.phaseCode.localeCompare(b.phaseCode)))

  const listingIndex = sortedNodes.findIndex((node) => node.workItemTypeCode === 'CHANNEL_PRODUCT_LISTING')
  const styleArchiveIndex = sortedNodes.findIndex((node) => node.workItemTypeCode === 'STYLE_ARCHIVE_CREATE')

  assert.notEqual(listingIndex, -1, `${template.name} 应保留商品上架节点`)
  assert.notEqual(styleArchiveIndex, -1, `${template.name} 应保留生成款式档案节点`)
  assert.ok(listingIndex < styleArchiveIndex, `${template.name} 不得把生成款式档案提前到商品上架之前`)

  const nextNode = sortedNodes[listingIndex + 1]
  assert.ok(nextNode, `${template.name} 的商品上架后应仍存在模板顺序下一个节点`)
  assert.equal(
    nextNode.workItemTypeCode,
    expectedNextNodeByTemplateName.get(template.name),
    `${template.name} 的商品上架完成后应按模板顺序进入下一个工作项`,
  )
}

console.log('pcs-channel-listing-template-next-node.spec.ts PASS')
