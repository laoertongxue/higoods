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
    '/pcs/engineering/masters': () => renderers.renderPcsEngineeringMasterListPage(),
    '/pcs/engineering/changes': () => renderers.renderPcsEngineeringChangeListPage(),
    '/pcs/engineering/changes/new': () => renderers.renderPcsEngineeringChangeCreatePage(),
    '/pcs/engineering/revision-sampling': () => renderers.renderPcsRevisionSamplingListPage(),
    '/pcs/engineering/design-sampling': () => renderers.renderPcsDesignSamplingListPage(),
    '/pcs/engineering/color': () => renderers.renderPcsColorTaskPage(),
    '/pcs/engineering/purchase': () => renderers.renderPcsPurchaseTaskPage(),
    '/pcs/engineering/tech-pack': () => renderers.renderPcsTechPackTaskPage(),
    '/pcs/testing/live': () => renderers.renderPcsLiveTestingListPage(),
    '/pcs/testing/video': () => renderers.renderPcsVideoTestingListPage(),
    '/pcs/channels/products': () => renderers.renderPcsChannelProductListPage(),
    '/pcs/channels/products/mapping': renderClearedPcsPage('渠道属性对应'),
    '/pcs/channels/products/store': () => renderers.renderPcsChannelProductListPage(),
    '/pcs/channels/stores': () => renderers.renderPcsChannelStoreListPage(),
    '/pcs/channels/stores/sync': () => renderers.renderPcsChannelStoreSyncPage(),
    '/pcs/samples': () => renderRouteRedirect('/pcs/samples/inventory', '正在跳转到样衣库存'),
    '/pcs/samples/inventory': () => renderers.renderPcsSampleInventoryPage(),
    '/pcs/samples/application': () => renderers.renderPcsSampleApplicationPage(),
    '/pcs/samples/transfer': () => renderers.renderPcsSampleTransferPage(),
    '/pcs/samples/return': () => renderers.renderPcsSampleReturnPage(),
    '/pcs/samples/ledger': () => renderers.renderPcsSampleLedgerPage(),
    '/pcs/samples/ledger/stocktake': () => renderers.renderPcsSampleStocktakePage(),
    '/pcs/samples/view': () => renderers.renderPcsSampleViewPage(),
    '/pcs/samples/first-sample': () => renderers.renderPcsFirstSampleTaskPage(),
    '/pcs/samples/first-order': () => renderers.renderPcsFirstOrderSampleTaskPage(),
    '/pcs/patterns/part-templates': () => renderers.renderPcsPartTemplateLibraryPage(),
    '/pcs/patterns/revision': () => renderers.renderPcsRevisionTaskPage(),
    '/pcs/patterns/plate-making': () => renderers.renderPcsPlateMakingTaskPage(),
    '/pcs/patterns/artwork': () => renderers.renderPcsPatternTaskPage(),
    '/pcs/technical-data/tech-packs': () => renderers.renderPcsTechnicalDataTechPackListPage(),
    '/pcs/technical-data/bom-pricing': () => renderers.renderPcsTechnicalDataBomPricingPage(),
    '/pcs/technical-data/tech-pack-templates': () => renderers.renderPcsTechnicalDataTemplateLibraryPage(),
    '/pcs/pattern-library': () => renderers.renderPcsPatternLibraryPage(),
    '/pcs/pattern-library/create': () => renderers.renderPcsPatternLibraryCreatePage(),
    '/pcs/pattern-library/config': () => renderers.renderPcsPatternLibraryConfigPage(),
    '/pcs/products/styles': () => renderers.renderPcsStyleArchiveListPage(),
    '/pcs/products/specifications': () => renderers.renderPcsSpecificationListPage(),
    '/pcs/products/channel-products': () => renderers.renderPcsChannelProductListPage(),
    '/pcs/products/channel-products/store': () => renderers.renderPcsChannelProductListPage(),
    '/pcs/products/spu': () => renderers.renderPcsStyleArchiveListPage(),
    '/pcs/products/sku': () => renderers.renderPcsSpecificationListPage(),
    '/pcs/products/yarn': () => renderers.renderPcsYarnArchiveListPage(),
    '/pcs/materials/fabric': () => renderers.renderPcsFabricArchiveListPage(),
    '/pcs/materials/fabric/new': () => renderers.renderPcsFabricArchiveCreatePage(),
    '/pcs/materials/accessory': () => renderers.renderPcsAccessoryArchiveListPage(),
    '/pcs/materials/accessory/new': () => renderers.renderPcsAccessoryArchiveCreatePage(),
    '/pcs/materials/yarn': () => renderers.renderPcsYarnArchiveListPage(),
    '/pcs/materials/yarn/new': () => renderers.renderPcsYarnArchiveCreatePage(),
    '/pcs/materials/consumable': () => renderers.renderPcsConsumableArchiveListPage(),
    '/pcs/materials/consumable/new': () => renderers.renderPcsConsumableArchiveCreatePage(),
    '/pcs/materials/packaging': () => renderers.renderPcsPackagingArchiveListPage(),
    '/pcs/materials/packaging/new': () => renderers.renderPcsPackagingArchiveCreatePage(),
    '/pcs/materials/parts': () => renderers.renderPcsPartsArchiveListPage(),
    '/pcs/materials/parts/new': () => renderers.renderPcsPartsArchiveCreatePage(),
    '/pcs/settings/cost-parameters': () => renderRouteRedirect('/pcs/settings/config-workspace', '系统设置已收口到基础配置'),
    '/pcs/settings/config-workspace': () => renderers.renderPcsConfigWorkspacePage(),
    '/pcs/settings/template-center': () => renderRouteRedirect('/pcs/settings/config-workspace', '系统设置已收口到基础配置'),
    '/pcs/settings/platforms': () => renderRouteRedirect('/pcs/settings/config-workspace', '系统设置已收口到基础配置'),
  },
  dynamicRoutes: [
    {
      pattern: /^\/pcs\/engineering\/masters\/([^/]+)$/,
      render: (match) => renderers.renderPcsEngineeringMasterDetailPage(match[1]),
    },
    {
      pattern: /^\/pcs\/engineering\/changes\/([^/]+)$/,
      render: (match) => renderers.renderPcsEngineeringChangeDetailPage(match[1]),
    },
    {
      pattern: /^\/pcs\/engineering\/(revision|design)-sampling\/([^/]+)$/,
      render: (match) => renderers.renderPcsIndependentSamplingDetailPage(match[1] === 'revision' ? 'REVISION' : 'DESIGN', match[2]),
    },
    {
      pattern: /^\/pcs\/engineering\/sampling-professional\/(.+)$/,
      render: (match) => renderers.renderPcsIndependentSamplingProfessionalTaskPage(match[1]),
    },
    {
      pattern: /^\/pcs\/engineering\/color\/([^/]+)$/,
      render: (match) => renderers.renderPcsColorTaskDetailPage(match[1]),
    },
    {
      pattern: /^\/pcs\/engineering\/purchase\/([^/]+)$/,
      render: (match) => renderers.renderPcsPurchaseTaskDetailPage(match[1]),
    },
    {
      pattern: /^\/pcs\/engineering\/tech-pack\/([^/]+)$/,
      render: (match) => renderers.renderPcsTechPackTaskDetailPage(match[1]),
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
      pattern: /^\/pcs\/channels\/products\/([^/]+)$/,
      render: (match) => renderers.renderPcsChannelProductDetailPage(match[1]),
    },
    {
      pattern: /^\/pcs\/products\/channel-products\/([^/]+)$/,
      render: (match) => renderers.renderPcsChannelProductDetailPage(match[1]),
    },
    {
      pattern: /^\/pcs\/channels\/stores\/([^/]+)$/,
      render: (match) => renderers.renderPcsChannelStoreDetailPage(match[1]),
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
      pattern: /^\/pcs\/patterns\/artwork\/([^/]+)$/,
      render: (match) => renderers.renderPcsPatternTaskDetailPage(match[1]),
    },
    {
      pattern: /^\/pcs\/samples\/first-sample\/([^/]+)$/,
      render: (match) => renderers.renderPcsFirstSampleTaskDetailPage(match[1]),
    },
    {
      pattern: /^\/pcs\/samples\/first-order\/([^/]+)$/,
      render: (match) => renderers.renderPcsFirstOrderSampleTaskDetailPage(match[1]),
    },
    {
      pattern: /^\/pcs\/samples\/detail\/([^/]+)$/,
      render: (match) => renderers.renderPcsSampleDetailPage(match[1]),
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
      pattern: /^\/pcs\/materials\/(fabric|accessory|yarn|consumable|packaging|parts)\/([^/]+)$/,
      render: (match) => renderers.renderPcsMaterialArchiveDetailPage(match[1], match[2]),
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
