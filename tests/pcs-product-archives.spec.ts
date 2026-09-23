import assert from 'node:assert/strict'

import { listStyleArchives } from '../src/data/pcs-style-archive-repository.ts'
import {
  ARCHIVE_WRITEBACK_FIELDS,
  applyArchiveWriteback,
  listArchiveWritebackFieldKeys,
  listExpectedMaterialsByStyleId,
} from '../src/data/pcs-archive-writeback-contract.ts'
import { PCS_CHANNEL_OPTIONS } from '../src/data/pcs-channel-options.ts'
import { menusBySystem } from '../src/data/app-shell-config.ts'
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
assert.match(styleListHtml, /新建款式/, '款式档案列表应提供直接创建入口')
assert.doesNotMatch(styleListHtml, /从项目生成/, '款式档案列表不应再提供从页面直接生成入口')
assert.match(styleListHtml, /无需测款历史/, '应说明无测款历史也可直接建档')
assert.match(styleListHtml, /当前生效版本/, '应展示当前生效版本列')

const firstStyle = listStyleArchives()[0]
assert.ok(firstStyle, '应存在款式档案演示数据')

const styleDetailHtml = renderPcsStyleArchiveDetailPage(firstStyle.styleId)
assert.match(styleDetailHtml, new RegExp(firstStyle.styleCode), '详情页应展示款式编码')
assert.match(styleDetailHtml, /技术包版本/, '详情页应提供技术包版本页签')
assert.match(styleDetailHtml, /规格档案/, '详情页应提供规格档案页签')
assert.match(styleDetailHtml, /完善资料/, '详情页应提供完善资料入口')
assert.match(styleDetailHtml, /渠道店铺商品/, '详情页应展示渠道店铺商品信息')
assert.doesNotMatch(styleDetailHtml, /从项目生成/, '详情页不应提供从项目生成入口')
assert.match(styleDetailHtml, /新建款式|新增规格/, '详情页应提供直接建档相关动作')

const skuListHtml = renderPcsSpecificationListPage()
assert.match(skuListHtml, /规格档案/, '应渲染规格档案列表标题')
assert.match(skuListHtml, /批量生成/, '应提供批量生成入口')
assert.match(skuListHtml, /渠道映射数/, '应展示渠道映射数字段')

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

assert.doesNotMatch(skuDetailHtml, /采购链接/, '规格详情不应展示采购链接入口（ARCH-007）')
assert.match(skuDetailHtml, /预计用料/, '规格详情应展示预计用料区（ARCH-006）')

const seededExpected = listSkuArchives().find((item) => item.expectedMaterials && item.expectedMaterials.length > 0)
assert.ok(seededExpected, '至少一个种子 SKU 应带预计用料（ARCH-006）')
assert.ok(seededExpected!.expectedMaterials![0].materialSkuCode, '预计用料行应含物料 SKU 编码')

const writebackKeys = listArchiveWritebackFieldKeys()
assert.deepEqual(
  writebackKeys,
  ['styleCode', 'styleName', 'skuCodes', 'lastTestingConclusion', 'bulkGoodsConclusion', 'bulkGoodsDecidedAt', 'channelProductIds'],
  '回写字段清单应冻结为设计 §6.2 基线（ARCH-008）',
)
assert.ok(ARCHIVE_WRITEBACK_FIELDS.every((field) => field.label && field.target), '回写字段应含中文标签与目标（ARCH-008）')

const writebackResult = applyArchiveWriteback({
  styleId: firstStyle.styleId,
  lastTestingConclusion: '已通过',
  source: '测试-档案回写',
  actor: '测试',
})
assert.equal(writebackResult.ok, true, '测款结论应可回写（ARCH-009）')
assert.ok(writebackResult.appliedFields.includes('lastTestingConclusion'), '应记录 lastTestingConclusion 已写入（ARCH-009）')
const reloadedStyle = listStyleArchives().find((item) => item.styleId === firstStyle.styleId)
assert.equal(reloadedStyle?.baseInfoStatus, '已通过', '测款结论应回写到款式档案状态（ARCH-010）')

const materialsByStyle = listExpectedMaterialsByStyleId(firstStyle.styleId)
assert.ok(materialsByStyle.some((row) => row.items.length > 0), '款式维度应能聚合预计用料（ARCH-006）')

assert.ok(PCS_CHANNEL_OPTIONS.some((item) => item.code === 'tiktok'), '渠道选项应含 TikTok（ARCH-004）')
assert.ok(PCS_CHANNEL_OPTIONS.some((item) => item.code === 'shopee'), '渠道选项应含虾皮/Shopee（ARCH-004）')

const productMenu = menusBySystem['pcs']?.flatMap((group) => group.items).find((group) => group.key === 'pcs-menu-products')
assert.ok(productMenu, 'PCS 应存在商品与物料档案菜单组（ARCH-004/005）')
assert.ok(
  productMenu!.children.some((item) => item.key === 'pcs-channel-products' && item.href === '/pcs/products/channel-products'),
  '渠道店铺商品应挂在档案菜单组（ARCH-005）',
)
assert.ok(
  productMenu!.children.some((item) => item.key === 'pcs-channel-stores' && item.href === '/pcs/channels/stores'),
  '渠道店铺管理应挂在档案菜单组（ARCH-004）',
)

assert.ok(
  listStyleArchives().some((item) => item.sourceProjectId === ''),
  '档案 Mock 应含无测款历史可直接建档的款式（ARCH-011）',
)

handlePcsProductArchiveEvent({
  dataset: { pcsProductArchiveAction: 'set-style-detail-tab', value: 'channels' },
  closest() {
    return this
  },
} as unknown as HTMLElement)
const styleChannelsHtml = renderPcsStyleArchiveDetailPage(firstStyle.styleId)
assert.match(
  styleChannelsHtml,
  /\/pcs\/products\/channel-products\//,
  '款式详情渠道页签应回链渠道商品详情（ARCH-003）',
)

console.log('pcs-product-archives.spec.ts PASS')
