import assert from 'node:assert/strict'

import { listStyleArchives } from '../src/data/pcs-style-archive-repository.ts'
import { getSkuArchiveById, listSkuArchives, resetSkuArchiveRepository } from '../src/data/pcs-sku-archive-repository.ts'
import {
  handlePcsProductArchiveEvent,
  renderPcsSpecificationDetailPage,
  renderPcsSpecificationListPage,
  renderPcsStyleArchiveDetailPage,
  renderPcsStyleArchiveListPage,
  resetPcsProductArchiveState,
} from '../src/pages/pcs-product-archives.ts'

resetPcsProductArchiveState()
resetSkuArchiveRepository()

const styleListHtml = renderPcsStyleArchiveListPage()
assert.match(styleListHtml, /款式档案/, '应渲染款式档案列表标题')
assert.match(styleListHtml, /新建款式档案/, '应提供款式档案创建入口')
assert.match(styleListHtml, /当前生效版本/, '应展示当前生效版本列')

const firstStyle = listStyleArchives()[0]
assert.ok(firstStyle, '应存在款式档案演示数据')

const styleDetailHtml = renderPcsStyleArchiveDetailPage(firstStyle.styleId)
assert.match(styleDetailHtml, new RegExp(firstStyle.styleCode), '详情页应展示款式编码')
assert.match(styleDetailHtml, /技术包版本/, '详情页应提供技术包版本页签')
assert.match(styleDetailHtml, /规格档案/, '详情页应提供规格档案页签')

const skuListHtml = renderPcsSpecificationListPage()
assert.match(skuListHtml, /规格档案/, '应渲染规格档案列表标题')
assert.match(skuListHtml, /批量生成/, '应提供批量生成入口')
assert.match(skuListHtml, /渠道映射数/, '应展示渠道映射数字段')

handlePcsProductArchiveEvent({
  dataset: { pcsProductArchiveAction: 'open-style-create', mode: 'new' },
  closest() {
    return this
  },
} as unknown as HTMLElement)

const styleCreateHtml = renderPcsStyleArchiveListPage()
assert.match(styleCreateHtml, /来源：配置工作台 \/ 品类/, '款式档案建档应提示类目来源于配置工作台')
assert.match(styleCreateHtml, /上衣/, '款式档案建档应展示配置工作台品类')

handlePcsProductArchiveEvent({
  dataset: { pcsProductArchiveAction: 'open-sku-create', mode: 'single' },
  closest() {
    return this
  },
} as unknown as HTMLElement)

const skuCreateHtml = renderPcsSpecificationListPage()
assert.match(skuCreateHtml, /来源：配置工作台 \/ 颜色/, '规格建档应提示颜色来源于配置工作台')
assert.match(skuCreateHtml, /来源：配置工作台 \/ 尺码/, '规格建档应提示尺码来源于配置工作台')
assert.match(skuCreateHtml, /Rose/, '规格建档应展示配置工作台颜色')
assert.match(skuCreateHtml, /One Size/, '规格建档应展示配置工作台尺码')

const firstSku = listSkuArchives()[0]
assert.ok(firstSku, '应存在规格档案演示数据')

handlePcsProductArchiveEvent({
  dataset: { pcsProductArchiveAction: 'toggle-sku-status', skuId: firstSku.skuId },
  closest() {
    return this
  },
} as unknown as HTMLElement)

const updatedSku = getSkuArchiveById(firstSku.skuId)
assert.ok(updatedSku, '切换状态后仍应能找到规格档案')
assert.notEqual(updatedSku?.archiveStatus, firstSku.archiveStatus, '规格档案状态应发生变化')

const skuDetailHtml = renderPcsSpecificationDetailPage(firstSku.skuId)
assert.match(skuDetailHtml, /渠道映射/, '规格详情应提供渠道映射页签')
assert.match(skuDetailHtml, /外部编码/, '规格详情应提供外部编码页签')
assert.match(skuDetailHtml, new RegExp(firstSku.styleCode), '规格详情应展示所属款式信息')

console.log('pcs-product-archives.spec.ts PASS')
