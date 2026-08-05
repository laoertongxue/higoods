import assert from 'node:assert/strict'

import { hasFormalProductionFact } from '../src/data/pcs-engineering-first-production-policy.ts'
import {
  listEngineeringMasterOrders,
  resetEngineeringMasterRepository,
} from '../src/data/pcs-engineering-master-repository.ts'
import {
  listStyleArchives,
  resetStyleArchiveRepository,
} from '../src/data/pcs-style-archive-repository.ts'
import {
  handlePcsEngineeringMasterListEvent,
  renderPcsEngineeringMasterListPage,
} from '../src/pages/pcs-engineering-master-list.ts'
import { renderPcsEngineeringMasterDetailPage } from '../src/pages/pcs-engineering-master-detail.ts'

resetStyleArchiveRepository()
resetEngineeringMasterRepository()

const initialHtml = renderPcsEngineeringMasterListPage()
assert.match(initialHtml, /新建工程主单/, '工程主单列表必须提供主动新建入口')

const originalDocument = globalThis.document
Object.defineProperty(globalThis, 'document', {
  configurable: true,
  value: {
    querySelector() { return null },
    querySelectorAll() { return [] },
  },
})

const opened = handlePcsEngineeringMasterListEvent({
  closest(selector: string) {
    if (selector !== '[data-pcs-engineering-master-action]') return null
    return {
      dataset: { pcsEngineeringMasterAction: 'open-create-dialog' },
    }
  },
} as unknown as HTMLElement)
assert.equal(opened, true, '点击新建入口必须由工程主单列表处理')

const dialogHtml = renderPcsEngineeringMasterListPage()
assert.match(dialogHtml, /选择商品／款式档案/, '新建弹窗必须选择已有商品／款式档案')
assert.match(dialogHtml, /搜索 SPU／款式名称/, '款式较多时必须支持搜索')
assert.match(dialogHtml, /跟单负责人/, '新建时必须明确工程主单跟单')
assert.match(dialogHtml, /<img[^>]+src=/, '款式候选必须展示对应款式图片')
assert.match(dialogHtml, /创建草稿/, '新建动作必须明确只创建草稿')

const beforeCreate = listEngineeringMasterOrders()
const usedStyleIds = new Set(beforeCreate.map((master) => master.styleId))
const candidate = listStyleArchives().find((style) =>
  !usedStyleIds.has(style.styleId)
  && !hasFormalProductionFact(style.styleCode)
  && style.archiveStatus !== 'ARCHIVED'
  && Boolean(style.mainImageUrl || style.galleryImageUrls[0]),
)
assert.ok(candidate, '默认 Mock 必须存在可创建工程主单的款式')

const selected = handlePcsEngineeringMasterListEvent({
  closest(selector: string) {
    if (selector !== '[data-pcs-engineering-master-action]') return null
    return {
      dataset: {
        pcsEngineeringMasterAction: 'select-create-style',
        styleId: candidate.styleId,
      },
    }
  },
} as unknown as HTMLElement)
assert.equal(selected, true, '选择可创建款式必须由工程主单列表处理')

const created = handlePcsEngineeringMasterListEvent({
  closest(selector: string) {
    if (selector !== '[data-pcs-engineering-master-action]') return null
    return {
      dataset: { pcsEngineeringMasterAction: 'create-master' },
    }
  },
} as unknown as HTMLElement)
assert.equal(created, true, '点击创建草稿必须由工程主单列表处理')
const createdMaster = listEngineeringMasterOrders().find((master) => master.styleId === candidate.styleId)
assert.ok(createdMaster, '选择标记为可创建的款式后必须真正生成工程主单')
assert.equal(createdMaster.status, '草稿', '主动新建的工程主单必须先进入草稿')
assert.doesNotThrow(
  () => renderPcsEngineeringMasterDetailPage(createdMaster.masterOrderId),
  '新建草稿跳转详情时不得被演示生命周期初始化误判为待关闭主单',
)

Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument })

console.log('pcs-engineering-master-create-entry.spec.ts PASS')
