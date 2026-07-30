import assert from 'node:assert/strict'

import { resetProjectChannelProductRepository, listProjectChannelProducts } from '../src/data/pcs-channel-product-project-repository.ts'
import { resetProjectRepository } from '../src/data/pcs-project-repository.ts'
import { resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import {
  renderPcsChannelProductDetailPage,
  renderPcsChannelProductListPage,
} from '../src/pages/pcs-channel-products.ts'

resetProjectRepository()
resetStyleArchiveRepository()
resetProjectChannelProductRepository()

const listHtml = renderPcsChannelProductListPage()
assert.match(listHtml, /渠道店铺商品/, '应渲染渠道店铺商品列表标题')
assert.match(listHtml, /SPU \/ 来源/, '列表应展示 SPU 与来源列')
assert.match(listHtml, /库存 \/ SKU/, '列表应展示库存与 SKU 列')
assert.match(listHtml, /平台商品 ID/, '列表应展示平台商品 ID 列')
assert.match(listHtml, /data-standard-list-page/, '列表应使用标准列表页')
assert.match(listHtml, /data-table-pagination/, '列表应保留分页')
assert.match(listHtml, /链路状态/, '列表应展示链路状态列')

const targetRecord = listProjectChannelProducts()[0]
assert.ok(targetRecord, '应存在渠道商品演示记录')
assert.match(listHtml, new RegExp(targetRecord!.projectCode), '列表应渲染来源项目编码')
assert.match(listHtml, new RegExp(targetRecord!.channelProductCode), '列表应渲染渠道商品编码')

const detailHtml = renderPcsChannelProductDetailPage(targetRecord!.channelProductId)
assert.match(detailHtml, /商品档案 \/ 渠道店铺商品/, '详情页应渲染渠道店铺商品面包屑')
assert.match(detailHtml, /来源与上架信息/, '详情页应渲染来源与上架信息卡片')
assert.match(detailHtml, /规格上传结果/, '详情页应渲染规格上传结果卡片')
assert.match(detailHtml, /测款与链路状态/, '详情页应渲染测款与链路状态卡片')
assert.match(detailHtml, /规格明细/, '详情页应渲染规格明细区域')
assert.match(detailHtml, /上游更新日志/, '详情页应渲染上游更新日志区域')
assert.match(detailHtml, /来源项目步骤/, '详情页应展示来源项目步骤')
assert.match(detailHtml, /来源商品上架批次/, '详情页应展示来源商品上架批次字段')
assert.match(detailHtml, /最后一次上游更新时间/, '详情页应渲染最后一次上游更新时间')
assert.match(detailHtml, /查看来源项目/, '详情页应提供查看来源项目按钮')
assert.match(detailHtml, /查看款式档案/, '详情页应提供查看款式档案按钮')
assert.doesNotMatch(detailHtml, /规格档案编码|规格档案名称/, '详情页不应再展示正式规格档案口径')
assert.match(detailHtml, /已生效已更新|已生效待更新|已上架待测款|待上传|已上传待确认|已作废/, '详情页应展示统一业务状态标签')

console.log('pcs-channel-products.spec.ts PASS')
