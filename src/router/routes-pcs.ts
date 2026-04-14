import type { RouteRegistry } from './route-types'
import { renderRouteRedirect } from './route-utils'
import * as renderers from './route-renderers'

function renderClearedPcsPage(title: string) {
  return () => renderers.renderPcsResetPlaceholderPage(title)
}

export const routes: RouteRegistry = {
  exactRoutes: {
    '/pcs': () => renderRouteRedirect('/pcs/workspace/overview', '正在跳转到商品中心工作台'),
    '/pcs/workspace': () => renderRouteRedirect('/pcs/workspace/overview', '正在跳转到商品中心工作台'),
    '/pcs/workspace/overview': renderClearedPcsPage('商品中心工作台'),
    '/pcs/workspace/todos': renderClearedPcsPage('商品中心待办'),
    '/pcs/workspace/alerts': renderClearedPcsPage('商品中心预警'),
    '/pcs/projects': () => renderers.renderPcsProjectListPage(),
    '/pcs/projects/create': () => renderers.renderPcsProjectCreatePage(),
    '/pcs/templates': () => renderers.renderPcsTemplateListPage(),
    '/pcs/templates/new': () => renderers.renderPcsTemplateEditorPage(),
    '/pcs/work-items': () => renderers.renderPcsWorkItemLibraryPage(),
    '/pcs/testing/live': () => renderers.renderPcsLiveTestingListPage(),
    '/pcs/testing/video': () => renderers.renderPcsVideoTestingListPage(),
    '/pcs/channels/products': renderClearedPcsPage('渠道商品'),
    '/pcs/channels/products/mapping': renderClearedPcsPage('渠道属性对应'),
    '/pcs/channels/products/store': renderClearedPcsPage('渠道商品店铺视图'),
    '/pcs/channels/stores': () => renderers.renderPcsChannelStoreListPage(),
    '/pcs/channels/stores/sync': () => renderers.renderPcsChannelStoreSyncPage(),
    '/pcs/channels/stores/payout-accounts': () => renderers.renderPcsPayoutAccountListPage(),
    '/pcs/samples/ledger': renderClearedPcsPage('样衣台账'),
    '/pcs/samples/inventory': renderClearedPcsPage('样衣库存'),
    '/pcs/samples/transfer': renderClearedPcsPage('样衣调拨'),
    '/pcs/samples/return': renderClearedPcsPage('样衣退回'),
    '/pcs/samples/application': renderClearedPcsPage('样衣申请'),
    '/pcs/samples/view': renderClearedPcsPage('样衣资产查看'),
    '/pcs/samples/first-sample': renderClearedPcsPage('首版样衣打样'),
    '/pcs/samples/first-order': renderClearedPcsPage('首版样衣打样'),
    '/pcs/samples/pre-production': renderClearedPcsPage('产前版样衣'),
    '/pcs/production/pre-check': renderClearedPcsPage('产前版样衣'),
    '/pcs/patterns': renderClearedPcsPage('制版任务'),
    '/pcs/patterns/part-templates': () => renderers.renderPcsPartTemplateLibraryPage(),
    '/pcs/patterns/colors': renderClearedPcsPage('花型任务'),
    '/pcs/patterns/revision': renderClearedPcsPage('改版任务'),
    '/pcs/patterns/plate-making': renderClearedPcsPage('制版任务'),
    '/pcs/patterns/artwork': renderClearedPcsPage('花型任务'),
    '/pcs/pattern-library': () => renderers.renderPcsPatternLibraryPage(),
    '/pcs/pattern-library/create': () => renderers.renderPcsPatternLibraryCreatePage(),
    '/pcs/pattern-library/config': () => renderers.renderPcsPatternLibraryConfigPage(),
    '/pcs/products/styles': renderClearedPcsPage('款式档案'),
    '/pcs/products/specifications': renderClearedPcsPage('规格档案'),
    '/pcs/products/channel-products': renderClearedPcsPage('渠道商品'),
    '/pcs/products/channel-products/store': renderClearedPcsPage('渠道商品店铺视图'),
    '/pcs/products/channel-attributes': renderClearedPcsPage('渠道属性对应'),
    '/pcs/products/coding-rules': renderClearedPcsPage('编码规则'),
    '/pcs/products/spu': renderClearedPcsPage('款式档案'),
    '/pcs/products/sku': renderClearedPcsPage('规格档案'),
    '/pcs/products/yarn': renderClearedPcsPage('纱线档案'),
    '/pcs/materials/fabric': renderClearedPcsPage('面料档案'),
    '/pcs/materials/fabric/new': renderClearedPcsPage('新建面料档案'),
    '/pcs/materials/accessory': renderClearedPcsPage('辅料档案'),
    '/pcs/materials/accessory/new': renderClearedPcsPage('新建辅料档案'),
    '/pcs/materials/yarn': renderClearedPcsPage('纱线档案'),
    '/pcs/materials/yarn/new': renderClearedPcsPage('新建纱线档案'),
    '/pcs/materials/consumable': renderClearedPcsPage('耗材档案'),
    '/pcs/materials/consumable/new': renderClearedPcsPage('新建耗材档案'),
    '/pcs/settings/cost-parameters': renderClearedPcsPage('成本参数'),
    '/pcs/settings/config-workspace': renderClearedPcsPage('配置工作台'),
    '/pcs/settings/template-center': renderClearedPcsPage('模板中心'),
    '/pcs/settings/platforms': renderClearedPcsPage('平台设置'),
  },
  dynamicRoutes: [
    {
      pattern: /^\/pcs\/projects\/([^/]+)\/work-items\/([^/]+)$/,
      render: (match) => renderers.renderPcsProjectWorkItemDetailPage(match[1], match[2]),
    },
    {
      pattern: /^\/pcs\/projects\/([^/]+)$/,
      render: (match) => renderers.renderPcsProjectDetailPage(match[1]),
    },
    {
      pattern: /^\/pcs\/testing\/live\/([^/]+)$/,
      render: (match) => renderers.renderPcsLiveTestingDetailPage(match[1]),
    },
    {
      pattern: /^\/pcs\/testing\/video\/([^/]+)$/,
      render: (match) => renderers.renderPcsVideoTestingDetailPage(match[1]),
    },
    {
      pattern: /^\/pcs\/channels\/stores\/payout-accounts\/([^/]+)$/,
      render: (match) => renderers.renderPcsPayoutAccountDetailPage(match[1]),
    },
    {
      pattern: /^\/pcs\/channels\/stores\/([^/]+)$/,
      render: (match) => renderers.renderPcsChannelStoreDetailPage(match[1]),
    },
    {
      pattern: /^\/pcs\/templates\/([^/]+)\/edit$/,
      render: (match) => renderers.renderPcsTemplateEditorPage(match[1]),
    },
    {
      pattern: /^\/pcs\/templates\/([^/]+)$/,
      render: (match) => renderers.renderPcsTemplateDetailPage(match[1]),
    },
    {
      pattern: /^\/pcs\/work-items\/([^/]+)$/,
      render: (match) => renderers.renderPcsWorkItemDetailPage(match[1]),
    },
    {
      pattern: /^\/pcs\/pattern-library\/([^/]+)$/,
      render: (match) => renderers.renderPcsPatternLibraryDetailPage(match[1]),
    },
    {
      pattern: /^\/pcs\/.+$/,
      render: () => renderers.renderPcsResetPlaceholderPage('PCS 页面'),
    },
  ],
}
