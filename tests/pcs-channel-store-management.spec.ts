import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  handlePcsChannelStoresEvent,
  renderPcsChannelStoreDetailPage,
  renderPcsChannelStoreListPage,
} from '../src/pages/pcs-channel-stores.ts'

const listHtml = renderPcsChannelStoreListPage()

assert.doesNotMatch(listHtml, /提现账号管理/, '渠道店铺列表页不应再展示提现账号管理入口')
assert.doesNotMatch(listHtml, /授权状态/, '渠道店铺列表页不应再展示授权状态列或筛选')
assert.doesNotMatch(listHtml, /当前提现账号/, '渠道店铺列表页不应再展示当前提现账号列')
assert.doesNotMatch(listHtml, /收入归属主体/, '渠道店铺列表页不应再展示收入归属主体列')
assert.doesNotMatch(listHtml, /归属类型/, '渠道店铺列表页不应再展示归属类型筛选')
assert.match(listHtml, /所属团队/, '渠道店铺列表页应展示所属团队')
assert.match(listHtml, /店铺负责人/, '渠道店铺列表页应展示店铺负责人')

handlePcsChannelStoresEvent({
  closest: () => ({
    dataset: {
      pcsChannelStoreAction: 'open-store-create',
    },
  }),
} as unknown as HTMLElement)

const createHtml = renderPcsChannelStoreListPage()

assert.match(createHtml, /所属团队与负责人/, '新建渠道店铺应展示所属团队与负责人信息组')
assert.match(createHtml, /所属团队/, '新建渠道店铺应展示所属团队字段')
assert.match(createHtml, /店铺负责人/, '新建渠道店铺应展示店铺负责人字段')
assert.doesNotMatch(createHtml, /报价币种/, '新建渠道店铺不应再展示报价币种')

const detailHtml = renderPcsChannelStoreDetailPage('ST-001')

assert.doesNotMatch(detailHtml, /授权与连接/, '渠道店铺详情页不应再展示授权与连接标签')
assert.doesNotMatch(detailHtml, /上架策略/, '渠道店铺详情页不应再展示上架策略标签')
assert.doesNotMatch(detailHtml, /提现账号绑定/, '渠道店铺详情页不应再展示提现账号绑定标签')
assert.doesNotMatch(detailHtml, /同步与数据/, '渠道店铺详情页不应再展示同步与数据标签')
assert.doesNotMatch(detailHtml, /日志与附件/, '渠道店铺详情页不应再展示日志与附件标签')
assert.doesNotMatch(detailHtml, /重新授权/, '渠道店铺详情页不应再展示重新授权按钮')
assert.doesNotMatch(detailHtml, /变更提现账号/, '渠道店铺详情页不应再展示变更提现账号按钮')
assert.doesNotMatch(detailHtml, /查看绑定历史/, '渠道店铺详情页不应再展示查看绑定历史按钮')
assert.match(detailHtml, /店铺基础信息/, '渠道店铺详情页应一次性展示店铺基础信息')
assert.match(detailHtml, /团队与责任/, '渠道店铺详情页应一次性展示团队与责任')

const routeSource = readFileSync(new URL('../src/router/routes-pcs.ts', import.meta.url), 'utf8')

assert.doesNotMatch(routeSource, /\/pcs\/channels\/stores\/payout-accounts/, '路由源码中不应再保留提现账号页入口')

console.log('pcs-channel-store-management.spec.ts PASS')
