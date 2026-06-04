import assert from 'node:assert/strict'

import {
  renderPcsChannelStoreDetailPage,
  renderPcsChannelStoreListPage,
  renderPcsChannelStoreSyncPage,
  renderPcsPayoutAccountDetailPage,
  renderPcsPayoutAccountListPage,
} from '../src/pages/pcs-channel-stores.ts'

const listHtml = renderPcsChannelStoreListPage()
assert.match(listHtml, /渠道店铺管理/)
assert.match(listHtml, /新建店铺/)
assert.match(listHtml, /TikTok 印尼主店/)
assert.match(listHtml, /\/pcs\/channels\/stores\/ST-001/)

const detailHtml = renderPcsChannelStoreDetailPage('ST-001')
assert.match(detailHtml, /店铺基础信息/)
assert.match(detailHtml, /团队与责任/)
assert.match(detailHtml, /项目引用信息/)
assert.match(detailHtml, /store-tiktok-01/)

const syncHtml = renderPcsChannelStoreSyncPage()
assert.match(syncHtml, /同步状态与错误回执/)
assert.match(syncHtml, /商品同步/)
assert.match(syncHtml, /订单同步/)

const payoutListHtml = renderPcsPayoutAccountListPage()
assert.match(payoutListHtml, /提现账号管理/)
assert.match(payoutListHtml, /新建提现账号/)
assert.match(payoutListHtml, /\/pcs\/channels\/stores\/payout-accounts\/PA-002/)

const payoutDetailHtml = renderPcsPayoutAccountDetailPage('PA-002')
assert.match(payoutDetailHtml, /关联店铺/)
assert.match(payoutDetailHtml, /附件与日志/)
assert.match(payoutDetailHtml, /PT HIGOOD LIVE - IDN Payout/)

console.log('pcs-channel-stores.spec.ts PASS')
