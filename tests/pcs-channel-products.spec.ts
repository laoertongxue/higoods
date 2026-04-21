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
assert.match(listHtml, /渠道商品上架批次/, '应渲染渠道商品上架批次列表标题')
assert.match(listHtml, /来源商品上架批次/, '列表应展示来源商品上架批次列')
assert.match(listHtml, /规格数量/, '列表应展示规格数量列')
assert.match(listHtml, /上游款式商品编号/, '列表应展示上游款式商品编号列')
assert.match(listHtml, /CP-216015-01/, '列表应渲染截图中的渠道商品编码')
assert.match(listHtml, /PRJ-20251216-015/, '列表应渲染来源项目编码')
assert.match(listHtml, /Shopee \/ 虾皮马来西亚店/, '列表应渲染渠道店铺名称')
assert.match(listHtml, /链路状态/, '列表应展示链路状态列')
assert.match(listHtml, /测款通过，已关联款式档案并完成上游最终更新/, '列表应渲染链路状态内容')

const targetRecord = listProjectChannelProducts().find((item) => item.projectCode === 'PRJ-20251216-015')
assert.ok(targetRecord, '应存在 PRJ-20251216-015 的渠道商品记录')

const detailHtml = renderPcsChannelProductDetailPage(targetRecord!.channelProductId)
assert.match(detailHtml, /商品档案 \/ 渠道商品上架批次/, '详情页应渲染批次面包屑')
assert.match(detailHtml, /来源与上架信息/, '详情页应渲染来源与上架信息卡片')
assert.match(detailHtml, /规格上传结果/, '详情页应渲染规格上传结果卡片')
assert.match(detailHtml, /测款与链路状态/, '详情页应渲染测款与链路状态卡片')
assert.match(detailHtml, /规格明细/, '详情页应渲染规格明细区域')
assert.match(detailHtml, /上游更新日志/, '详情页应渲染上游更新日志区域')
assert.match(detailHtml, /SPU-2024-005/, '详情页应渲染关联款式档案编码')
assert.match(detailHtml, /UP-216015-01/, '详情页应渲染上游渠道商品编码')
assert.match(detailHtml, /来源商品上架批次/, '详情页应展示来源商品上架批次字段')
assert.match(detailHtml, /2026-04-06 14:40/, '详情页应渲染最后一次上游更新时间')
assert.match(detailHtml, /查看来源项目/, '详情页应提供查看来源项目按钮')
assert.match(detailHtml, /查看款式档案/, '详情页应提供查看款式档案按钮')
assert.doesNotMatch(detailHtml, /规格档案编码|规格档案名称/, '详情页不应再展示正式规格档案口径')
assert.match(detailHtml, /已生效已更新|已生效待更新|已上架待测款|待上传|已上传待确认|已作废/, '详情页应展示统一业务状态标签')

console.log('pcs-channel-products.spec.ts PASS')
