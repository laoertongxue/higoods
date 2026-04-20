import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const liveSource = readFileSync(new URL('../src/pages/pcs-live-testing.ts', import.meta.url), 'utf8')
const videoSource = readFileSync(new URL('../src/pages/pcs-video-testing.ts', import.meta.url), 'utf8')
const channelSource = readFileSync(new URL('../src/pages/pcs-channel-products.ts', import.meta.url), 'utf8')
const storeSource = readFileSync(new URL('../src/pages/pcs-channel-stores.ts', import.meta.url), 'utf8')

assert.doesNotMatch(liveSource, /直播说明|本页用于|该模块用于|用于帮助/, '直播测款页不应再出现说明型文案')
assert.doesNotMatch(videoSource, /短视频说明|本页用于|该模块用于|用于帮助/, '短视频测款页不应再出现说明型文案')
assert.doesNotMatch(channelSource, /渠道说明|本页用于|该模块用于|用于帮助/, '渠道商品页不应再出现说明型文案')
assert.doesNotMatch(storeSource, /店铺说明|本页用于|该模块用于|用于帮助/, '渠道店铺页不应再出现说明型文案')

assert.match(liveSource, /工作项字段/, '直播测款页应保留工作项字段')
assert.match(videoSource, /工作项字段/, '短视频测款页应保留工作项字段')
assert.match(channelSource, /链路状态/, '渠道商品页应保留链路状态')
assert.match(storeSource, /渠道店铺/, '渠道店铺页应保留店铺对象本身')

console.log('pcs-page-slimming-channel-testing.spec.ts PASS')
