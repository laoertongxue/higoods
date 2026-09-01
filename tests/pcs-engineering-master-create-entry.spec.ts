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
import {
  handlePcsEngineeringMasterDetailEvent,
  renderPcsEngineeringMasterDetailPage,
} from '../src/pages/pcs-engineering-master-detail.ts'
import { buildEngineeringMasterDetailModel } from '../src/data/pcs-engineering-master-view-model.ts'

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
const createdDetailHtml = renderPcsEngineeringMasterDetailPage(createdMaster.masterOrderId)
assert.match(createdDetailHtml, /请选择生产准备类型/, '缺少结构化准备类型时必须让跟单选择')
assert.doesNotMatch(createdDetailHtml, /已选 0\/0 项/, '新建草稿不得展示没有任务的假方案')

const originalWindow = globalThis.window
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    location: { pathname: `/pcs/engineering/masters/${createdMaster.masterOrderId}` },
    dispatchEvent() { return true },
  },
})
const preparationSelected = handlePcsEngineeringMasterDetailEvent({
  closest(selector: string) {
    if (selector !== '[data-pcs-engineering-master-action]') return null
    return {
      value: 'PURE_WOVEN',
      dataset: { pcsEngineeringMasterAction: 'select-preparation-type' },
    }
  },
} as unknown as HTMLElement)
assert.equal(preparationSelected, true, '跟单选择生产准备类型必须由详情页处理')
const plannedDetailHtml = renderPcsEngineeringMasterDetailPage(createdMaster.masterOrderId)
assert.match(plannedDetailHtml, /梭织基码纸样/, '选择纯梭织后必须立即展示对应任务')
assert.match(plannedDetailHtml, /首单样衣/, '选择纯梭织后必须展示样衣任务')
assert.match(plannedDetailHtml, /技术包确认任务/, '四类准备类型都必须生成技术包确认任务')
const plannedModel = buildEngineeringMasterDetailModel(createdMaster.masterOrderId, 'PURE_WOVEN')
const sampleTask = plannedModel?.taskPlanSuggestions.find((item) => item.taskType === 'PRE_PRODUCTION_SAMPLE')
const knitBaseTask = plannedModel?.taskPlanSuggestions.find((item) => item.taskType === 'BASE_PATTERN_KNIT')
assert.equal(sampleTask?.dependencyText, '梭织基码纸样', '页面只能展示当前准备类型实际生效的固定前置')
assert.equal(knitBaseTask?.notApplicable, true, '纯梭织方案中的毛织任务必须明确为不适用且不可选择')

Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow })
Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument })

console.log('pcs-engineering-master-create-entry.spec.ts PASS')
