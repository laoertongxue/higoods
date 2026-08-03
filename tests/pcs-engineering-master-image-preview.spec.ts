import assert from 'node:assert/strict'

import {
  listEngineeringMasterOrders,
  resetEngineeringMasterRepository,
} from '../src/data/pcs-engineering-master-repository.ts'
import { resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import {
  handlePcsEngineeringMasterDetailEvent,
  renderPcsEngineeringMasterDetailPage,
} from '../src/pages/pcs-engineering-master-detail.ts'
import {
  handlePcsEngineeringMasterListEvent,
  renderPcsEngineeringMasterListPage,
} from '../src/pages/pcs-engineering-master-list.ts'

resetStyleArchiveRepository()
resetEngineeringMasterRepository()

const listHtml = renderPcsEngineeringMasterListPage()
assert.match(listHtml, /data-pcs-engineering-master-action="open-style-image-preview"/, '列表款式缩略图必须可打开大图')

const master = listEngineeringMasterOrders()[0]
assert.ok(master, '演示工程主单必须存在')
const detailHtml = renderPcsEngineeringMasterDetailPage(master.masterOrderId)
assert.match(detailHtml, /data-pcs-engineering-master-action="open-style-image-preview"/, '详情款式缩略图必须可打开大图')

const originalDocument = globalThis.document
Object.defineProperty(globalThis, 'document', {
  configurable: true,
  value: {
    querySelector() { return null },
    querySelectorAll() { return [] },
  },
})

const previewTarget = {
  closest(selector: string) {
    if (selector !== '[data-pcs-engineering-master-action]') return null
    return {
      dataset: {
        pcsEngineeringMasterAction: 'open-style-image-preview',
        imageUrl: 'https://file.higood.id/mock/style.webp',
        imageTitle: '测试款式',
      },
    }
  },
} as unknown as HTMLElement

assert.equal(handlePcsEngineeringMasterListEvent(previewTarget), true, '列表必须处理打开大图动作')
assert.match(renderPcsEngineeringMasterListPage(), /aria-label="款式大图预览"/, '列表必须渲染大图弹窗')

assert.equal(handlePcsEngineeringMasterDetailEvent(previewTarget), true, '详情必须处理打开大图动作')
assert.match(renderPcsEngineeringMasterDetailPage(master.masterOrderId), /aria-label="款式大图预览"/, '详情必须渲染大图弹窗')

Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument })

console.log('pcs-engineering-master-image-preview.spec.ts PASS')
