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
assert.match(listHtml, /来源商品上架实例/, '列表应展示来源商品上架实例列')
assert.match(listHtml, /测款来源视角/, '列表应展示测款来源视角列')
assert.match(listHtml, /关联款式档案/, '列表应展示关联款式档案列')
assert.match(listHtml, /关联上游编码/, '列表应展示关联上游编码列')
assert.match(listHtml, /CP-216015-01/, '列表应渲染截图中的渠道商品编码')
assert.match(listHtml, /PRJ-20251216-015/, '列表应渲染来源项目编码')
assert.match(listHtml, /Shopee \/ 虾皮马来西亚店/, '列表应渲染渠道店铺名称')
assert.match(listHtml, /测款通过，已关联款式档案并完成上游最终更新/, '列表应渲染链路说明')

const targetRecord = listProjectChannelProducts().find((item) => item.projectCode === 'PRJ-20251216-015')
assert.ok(targetRecord, '应存在 PRJ-20251216-015 的渠道商品记录')

const detailHtml = renderPcsChannelProductDetailPage(targetRecord!.channelProductId)
assert.match(detailHtml, /商品档案 \/ 渠道商品 \/ 项目测款来源/, '详情页应渲染面包屑')
assert.match(detailHtml, /来源与节点/, '详情页应渲染来源与节点卡片')
assert.match(detailHtml, /测款与作废状态/, '详情页应渲染测款与作废状态卡片')
assert.match(detailHtml, /款式档案与上游更新/, '详情页应渲染款式档案与上游更新卡片')
assert.match(detailHtml, /三码关联结果/, '详情页应渲染三码关联结果区域')
assert.match(detailHtml, /上游更新日志/, '详情页应渲染上游更新日志区域')
assert.match(detailHtml, /SPU-2024-005/, '详情页应渲染关联款式档案编码')
assert.match(detailHtml, /UP-216015-01/, '详情页应渲染上游渠道商品编码')
assert.match(detailHtml, /来源商品上架实例/, '详情页应展示来源商品上架实例字段')
assert.match(detailHtml, /2026-04-06 14:40/, '详情页应渲染最后一次上游更新时间')
assert.match(detailHtml, /查看来源项目/, '详情页应提供查看来源项目按钮')
assert.match(detailHtml, /查看款式档案/, '详情页应提供查看款式档案按钮')

console.log('pcs-channel-products.spec.ts PASS')
