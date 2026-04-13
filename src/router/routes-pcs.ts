import type { MaterialArchiveKind } from '../data/pcs-material-archives'
import type { RouteRegistry } from './route-types'
import { renderRouteRedirect } from './route-utils'
import * as renderers from './route-renderers'

export const routes: RouteRegistry = {
  exactRoutes: {
    '/pcs': () => renderRouteRedirect('/pcs/workspace/overview', '正在跳转到商品中心工作台'),
    '/pcs/workspace': () => renderRouteRedirect('/pcs/workspace/overview', '正在跳转到商品中心工作台'),
    '/pcs/workspace/overview': () => renderers.renderPcsOverviewPage(),
    '/pcs/workspace/todos': () => renderers.renderPcsTodosPage(),
    '/pcs/workspace/alerts': () => renderers.renderPcsAlertsPage(),
    '/pcs/projects': () => renderers.renderPcsProjectsPage(),
    '/pcs/projects/create': () => renderers.renderPcsProjectCreatePage(),
    '/pcs/templates': () => renderers.renderPcsTemplatesPage(),
    '/pcs/templates/new': () => renderers.renderPcsTemplateCreatePage(),
    '/pcs/work-items': () => renderers.renderPcsWorkItemsPage(),
    '/pcs/testing/live': () => renderers.renderPcsLiveSessionsPage(),
    '/pcs/testing/video': () => renderers.renderPcsVideoRecordsPage(),
    '/pcs/channels/products': () =>
      renderRouteRedirect('/pcs/products/channel-products', '正在跳转到渠道商品'),
    '/pcs/channels/products/mapping': () =>
      renderRouteRedirect('/pcs/products/channel-attributes', '正在跳转到渠道属性对应'),
    '/pcs/channels/products/store': () =>
      renderRouteRedirect('/pcs/products/channel-products/store', '正在跳转到渠道商品店铺视图'),
    '/pcs/channels/stores': () => renderers.renderPcsChannelStoresPage(),
    '/pcs/channels/stores/sync': () => renderers.renderPcsChannelStoreSyncPage(),
    '/pcs/channels/stores/payout-accounts': () => renderers.renderPcsChannelStorePayoutAccountsPage(),
    '/pcs/samples/ledger': () => renderers.renderSampleLedgerPage(),
    '/pcs/samples/inventory': () => renderers.renderSampleInventoryPage(),
    '/pcs/samples/transfer': () => renderers.renderSampleTransferPage(),
    '/pcs/samples/return': () => renderers.renderSampleReturnPage(),
    '/pcs/samples/application': () => renderers.renderSampleApplicationPage(),
    '/pcs/samples/view': () => renderers.renderSampleViewPage(),
    '/pcs/samples/first-sample': () => renderers.renderFirstOrderSamplePage(),
    '/pcs/samples/first-order': () =>
      renderRouteRedirect('/pcs/samples/first-sample', '正在跳转到首版样衣打样'),
    '/pcs/samples/pre-production': () => renderers.renderPreProductionSamplePage(),
    '/pcs/production/pre-check': () =>
      renderRouteRedirect('/pcs/samples/pre-production', '正在跳转到产前版样衣'),
    '/pcs/patterns': () => renderers.renderPlateMakingPage(),
    '/pcs/patterns/part-templates': () => renderers.renderPcsPartTemplateLibraryPage(),
    '/pcs/patterns/colors': () => renderers.renderPatternTaskPage(),
    '/pcs/patterns/revision': () => renderers.renderRevisionTaskPage(),
    '/pcs/patterns/plate-making': () => renderers.renderPlateMakingPage(),
    '/pcs/patterns/artwork': () => renderers.renderPatternTaskPage(),
    '/pcs/pattern-library': () => renderers.renderPcsPatternLibraryPage(),
    '/pcs/pattern-library/create': () => renderers.renderPcsPatternLibraryCreatePage(),
    '/pcs/pattern-library/config': () => renderers.renderPcsPatternLibraryConfigPage(),
    '/pcs/products/styles': () => renderers.renderProductSpuPage(),
    '/pcs/products/specifications': () => renderers.renderProductSkuPage(),
    '/pcs/products/channel-products': () => renderers.renderPcsChannelProductsPage(),
    '/pcs/products/channel-products/store': () => renderers.renderPcsChannelProductStoreViewPage(),
    '/pcs/products/channel-attributes': () => renderers.renderPcsChannelProductMappingPage(),
    '/pcs/products/coding-rules': () => renderers.renderPcsCodingRulesPage(),
    '/pcs/products/spu': () =>
      renderRouteRedirect('/pcs/products/styles', '正在跳转到款式档案'),
    '/pcs/products/sku': () =>
      renderRouteRedirect('/pcs/products/specifications', '正在跳转到规格档案'),
    '/pcs/products/yarn': () => renderRouteRedirect('/pcs/materials/yarn', '正在跳转到纱线档案'),
    '/pcs/materials/fabric': () => renderers.renderPcsMaterialArchiveListPage('fabric'),
    '/pcs/materials/fabric/new': () => renderers.renderPcsMaterialArchiveEditorPage('fabric'),
    '/pcs/materials/accessory': () => renderers.renderPcsMaterialArchiveListPage('accessory'),
    '/pcs/materials/accessory/new': () => renderers.renderPcsMaterialArchiveEditorPage('accessory'),
    '/pcs/materials/yarn': () => renderers.renderPcsMaterialArchiveListPage('yarn'),
    '/pcs/materials/yarn/new': () => renderers.renderPcsMaterialArchiveEditorPage('yarn'),
    '/pcs/materials/consumable': () => renderers.renderPcsMaterialArchiveListPage('consumable'),
    '/pcs/materials/consumable/new': () => renderers.renderPcsMaterialArchiveEditorPage('consumable'),
    '/pcs/settings/cost-parameters': () => renderers.renderPcsCostParametersPage(),
    '/pcs/settings/config-workspace': () => renderers.renderConfigWorkspacePage(),
    '/pcs/settings/template-center': () => renderers.renderPcsTemplatesPage(),
    '/pcs/settings/platforms': () => renderers.renderPlatformConfigPage(),
  },
  dynamicRoutes: [
    {
      pattern: /^\/pcs\/templates\/([^/]+)\/edit$/,
      render: (match) => renderers.renderPcsTemplateEditPage(match[1]),
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
      pattern: /^\/pcs\/materials\/(fabric|accessory|yarn|consumable)\/([^/]+)\/edit$/,
      render: (match) =>
        renderers.renderPcsMaterialArchiveEditorPage(match[1] as MaterialArchiveKind, match[2]),
    },
    {
      pattern: /^\/pcs\/materials\/(fabric|accessory|yarn|consumable)\/([^/]+)$/,
      render: (match) =>
        renderers.renderPcsMaterialArchiveDetailPage(match[1] as MaterialArchiveKind, match[2]),
    },
    {
      pattern: /^\/pcs\/products\/styles\/([^/]+)$/,
      render: (match) => renderers.renderPcsProductStyleDetailPage(decodeURIComponent(match[1])),
    },
    {
      pattern: /^\/pcs\/products\/spu\/([^/]+)$/,
      render: (match) =>
        renderRouteRedirect(`/pcs/products/styles/${match[1]}`, '正在跳转到款式档案详情'),
    },
    {
      pattern: /^\/pcs\/products\/channel-products\/([^/]+)$/,
      render: (match) => renderers.renderPcsChannelProductDetailPage(match[1]),
    },
    {
      pattern: /^\/pcs\/channels\/products\/([^/]+)$/,
      render: (match) =>
        renderRouteRedirect(`/pcs/products/channel-products/${match[1]}`, '正在跳转到渠道商品详情'),
    },
    {
      pattern: /^\/pcs\/products\/sku\/([^/]+)$/,
      render: () =>
        renderRouteRedirect('/pcs/products/specifications', '正在跳转到规格档案'),
    },
    {
      pattern: /^\/pcs\/products\/styles\/([^/]+)\/technical-data\/([^/]+)$/,
      render: (match) =>
        renderers.renderTechPackPage(match[2], {
          styleId: decodeURIComponent(match[1]),
          technicalVersionId: decodeURIComponent(match[2]),
        }),
    },
    {
      pattern: /^\/pcs\/projects\/([^/]+)\/work-items\/([^/]+)$/,
      render: (match) => {
        const [, projectId, projectNodeId] = match
        return renderers.renderPcsProjectWorkItemDetailPage(projectId, projectNodeId)
      },
    },
    {
      pattern: /^\/pcs\/projects\/([^/]+)\/archive$/,
      render: (match) => renderers.renderPcsProjectArchivePage(match[1]),
    },
    {
      pattern: /^\/pcs\/projects\/([^/]+)$/,
      render: (match) => renderers.renderPcsProjectDetailPage(match[1]),
    },
    {
      pattern: /^\/pcs\/testing\/live\/([^/]+)$/,
      render: (match) => renderers.renderPcsLiveSessionDetailPage(match[1]),
    },
    {
      pattern: /^\/pcs\/testing\/video\/([^/]+)$/,
      render: (match) => renderers.renderPcsVideoRecordDetailPage(match[1]),
    },
    {
      pattern: /^\/pcs\/channels\/stores\/([^/]+)$/,
      render: (match) => renderers.renderPcsChannelStoreDetailPage(match[1]),
    },
  ],
}
