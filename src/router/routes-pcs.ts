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
    '/pcs/channels/products': () => renderers.renderPcsChannelProductListPage(),
    '/pcs/channels/products/mapping': renderClearedPcsPage('渠道属性对应'),
    '/pcs/channels/products/store': () => renderers.renderPcsChannelProductListPage(),
    '/pcs/channels/stores': () => renderers.renderPcsChannelStoreListPage(),
    '/pcs/channels/stores/sync': () => renderers.renderPcsChannelStoreSyncPage(),
    '/pcs/channels/stores/payout-accounts': () => renderers.renderPcsPayoutAccountListPage(),
    '/pcs/samples/ledger': () => renderRouteRedirect('/pcs/projects', '样衣资产管理已并入商品项目工作项'),
    '/pcs/samples/inventory': () => renderRouteRedirect('/pcs/projects', '样衣资产管理已并入商品项目工作项'),
    '/pcs/samples/transfer': () => renderRouteRedirect('/pcs/projects', '样衣资产管理已并入商品项目工作项'),
    '/pcs/samples/return': () => renderRouteRedirect('/pcs/projects', '样衣资产管理已并入商品项目工作项'),
    '/pcs/samples/application': () => renderRouteRedirect('/pcs/projects', '样衣资产管理已并入商品项目工作项'),
    '/pcs/samples/view': () => renderRouteRedirect('/pcs/projects', '样衣资产管理已并入商品项目工作项'),
    '/pcs/samples/first-sample': () => renderers.renderPcsFirstSampleTaskPage(),
    '/pcs/samples/first-order': () => renderers.renderPcsFirstSampleTaskPage(),
    '/pcs/samples/pre-production': () => renderers.renderPcsPreProductionSampleTaskPage(),
    '/pcs/production/pre-check': () => renderers.renderPcsPreProductionSampleTaskPage(),
    '/pcs/patterns': () => renderers.renderPcsPlateMakingTaskPage(),
    '/pcs/patterns/part-templates': () => renderers.renderPcsPartTemplateLibraryPage(),
    '/pcs/patterns/colors': () => renderers.renderPcsPatternTaskPage(),
    '/pcs/patterns/revision': () => renderers.renderPcsRevisionTaskPage(),
    '/pcs/patterns/plate-making': () => renderers.renderPcsPlateMakingTaskPage(),
    '/pcs/patterns/artwork': () => renderers.renderPcsPatternTaskPage(),
    '/pcs/pattern-library': () => renderers.renderPcsPatternLibraryPage(),
    '/pcs/pattern-library/create': () => renderers.renderPcsPatternLibraryCreatePage(),
    '/pcs/pattern-library/config': () => renderers.renderPcsPatternLibraryConfigPage(),
    '/pcs/products/styles': () => renderers.renderPcsStyleArchiveListPage(),
    '/pcs/products/specifications': () => renderers.renderPcsSpecificationListPage(),
    '/pcs/products/channel-products': () => renderers.renderPcsChannelProductListPage(),
    '/pcs/products/channel-products/store': () => renderers.renderPcsChannelProductListPage(),
    '/pcs/products/channel-attributes': renderClearedPcsPage('渠道属性对应'),
    '/pcs/products/coding-rules': renderClearedPcsPage('编码规则'),
    '/pcs/products/spu': () => renderers.renderPcsStyleArchiveListPage(),
    '/pcs/products/sku': () => renderers.renderPcsSpecificationListPage(),
    '/pcs/products/yarn': renderClearedPcsPage('纱线档案'),
    '/pcs/materials/fabric': renderClearedPcsPage('面料档案'),
    '/pcs/materials/fabric/new': renderClearedPcsPage('新建面料档案'),
    '/pcs/materials/accessory': renderClearedPcsPage('辅料档案'),
    '/pcs/materials/accessory/new': renderClearedPcsPage('新建辅料档案'),
    '/pcs/materials/yarn': renderClearedPcsPage('纱线档案'),
    '/pcs/materials/yarn/new': renderClearedPcsPage('新建纱线档案'),
    '/pcs/materials/consumable': renderClearedPcsPage('耗材档案'),
    '/pcs/materials/consumable/new': renderClearedPcsPage('新建耗材档案'),
    '/pcs/settings/cost-parameters': () => renderRouteRedirect('/pcs/settings/config-workspace', '系统设置已收口到基础配置'),
    '/pcs/settings/config-workspace': () => renderers.renderPcsConfigWorkspacePage(),
    '/pcs/settings/template-center': () => renderRouteRedirect('/pcs/settings/config-workspace', '系统设置已收口到基础配置'),
    '/pcs/settings/platforms': () => renderRouteRedirect('/pcs/settings/config-workspace', '系统设置已收口到基础配置'),
  },
  dynamicRoutes: [
    {
      pattern: /^\/pcs\/projects\/([^/]+)\/work-items\/([^/]+)$/,
      render: (match) => renderRouteRedirect(`/pcs/projects/${match[1]}`, '工作项已并入商品项目页内处理'),
    },
    {
      pattern: /^\/pcs\/projects\/([^/]+)$/,
      render: (match) => renderers.renderPcsProjectDetailPage(match[1]),
    },
    {
      pattern: /^\/pcs\/testing\/live\/([^/]+)$/,
      render: () => renderRouteRedirect('/pcs/testing/live', '直播测款已改为列表内查看'),
    },
    {
      pattern: /^\/pcs\/testing\/video\/([^/]+)$/,
      render: () => renderRouteRedirect('/pcs/testing/video', '短视频测款已改为列表内查看'),
    },
    {
      pattern: /^\/pcs\/channels\/products\/([^/]+)$/,
      render: (match) => renderers.renderPcsChannelProductDetailPage(match[1]),
    },
    {
      pattern: /^\/pcs\/products\/channel-products\/([^/]+)$/,
      render: (match) => renderers.renderPcsChannelProductDetailPage(match[1]),
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
      pattern: /^\/pcs\/patterns\/revision\/([^/]+)$/,
      render: (match) => renderers.renderPcsRevisionTaskDetailPage(match[1]),
    },
    {
      pattern: /^\/pcs\/patterns\/plate-making\/([^/]+)$/,
      render: (match) => renderers.renderPcsPlateMakingTaskDetailPage(match[1]),
    },
    {
      pattern: /^\/pcs\/patterns\/colors\/([^/]+)$/,
      render: (match) => renderers.renderPcsPatternTaskDetailPage(match[1]),
    },
    {
      pattern: /^\/pcs\/patterns\/artwork\/([^/]+)$/,
      render: (match) => renderers.renderPcsPatternTaskDetailPage(match[1]),
    },
    {
      pattern: /^\/pcs\/patterns\/([^/]+)$/,
      render: (match) => renderers.renderPcsPlateMakingTaskDetailPage(match[1]),
    },
    {
      pattern: /^\/pcs\/samples\/first-sample\/([^/]+)$/,
      render: (match) => renderers.renderPcsFirstSampleTaskDetailPage(match[1]),
    },
    {
      pattern: /^\/pcs\/samples\/first-order\/([^/]+)$/,
      render: (match) => renderers.renderPcsFirstSampleTaskDetailPage(match[1]),
    },
    {
      pattern: /^\/pcs\/samples\/pre-production\/([^/]+)$/,
      render: (match) => renderers.renderPcsPreProductionSampleTaskDetailPage(match[1]),
    },
    {
      pattern: /^\/pcs\/production\/pre-check\/([^/]+)$/,
      render: (match) => renderers.renderPcsPreProductionSampleTaskDetailPage(match[1]),
    },
    {
      pattern: /^\/pcs\/pattern-library\/([^/]+)$/,
      render: (match) => renderers.renderPcsPatternLibraryDetailPage(match[1]),
    },
    {
      pattern: /^\/pcs\/products\/styles\/([^/]+)$/,
      render: (match) => renderers.renderPcsStyleArchiveDetailPage(match[1]),
    },
    {
      pattern: /^\/pcs\/products\/specifications\/([^/]+)$/,
      render: (match) => renderers.renderPcsSpecificationDetailPage(match[1]),
    },
    {
      pattern: /^\/pcs\/products\/spu\/([^/]+)$/,
      render: (match) => renderers.renderPcsStyleArchiveDetailPage(match[1]),
    },
    {
      pattern: /^\/pcs\/products\/sku\/([^/]+)$/,
      render: (match) => renderers.renderPcsSpecificationDetailPage(match[1]),
    },
    {
      pattern: /^\/pcs\/products\/styles\/([^/]+)\/technical-data\/([^/]+)$/,
      render: (match) => renderers.renderTechPackPage(match[1], { styleId: match[1], technicalVersionId: match[2] }),
    },
    {
      pattern: /^\/pcs\/.+$/,
      render: () => renderers.renderPcsResetPlaceholderPage('PCS 页面'),
    },
  ],
}
