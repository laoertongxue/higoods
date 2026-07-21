/**
 * AppShell 配置层：仅承载系统导航、菜单、标签页等壳层配置数据。
 * FCS 业务数据与业务类型统一来自 src/data/fcs/*。
 */

import type { System, MenuGroup } from './app-shell-types.ts'
import {
  buildSpecialCraftDomainWaitHandoverWarehousePath,
  buildSpecialCraftDomainWaitProcessWarehousePath,
  buildSpecialCraftOperationSlug,
  buildSpecialCraftTaskOrdersPath,
  listEnabledAuxiliaryCraftOperationDefinitions,
  listEnabledSpecialTypeCraftOperationDefinitions,
  listVisibleSpecialCraftOperationsForFactory,
} from './fcs/special-craft-operations.ts'
import type { SpecialCraftOperationDefinition } from './fcs/special-craft-operations.ts'

type SpecialCraftMenuDomain = 'AUXILIARY_CRAFT_FACTORY' | 'SPECIAL_CRAFT_FACTORY'

const specialCraftMenuDomainConfig: Record<SpecialCraftMenuDomain, {
  title: string
  icon: string
  waitProcessTitle: string
  waitHandoverTitle: string
}> = {
  AUXILIARY_CRAFT_FACTORY: {
    title: '辅助工艺工厂管理',
    icon: 'Sparkles',
    waitProcessTitle: '辅助工艺待加工仓',
    waitHandoverTitle: '辅助工艺待交出仓',
  },
  SPECIAL_CRAFT_FACTORY: {
    title: '特种工艺工厂管理',
    icon: 'Sparkles',
    waitProcessTitle: '特种工艺待加工仓',
    waitHandoverTitle: '特种工艺待交出仓',
  },
}

function listSpecialCraftMenuOperationsByDomain(domain: SpecialCraftMenuDomain, factoryId?: string) {
  if (factoryId) {
    return listVisibleSpecialCraftOperationsForFactory(factoryId).filter((operation) => operation.managementDomain === domain)
  }
  if (domain === 'AUXILIARY_CRAFT_FACTORY') return listEnabledAuxiliaryCraftOperationDefinitions()
  return listEnabledSpecialTypeCraftOperationDefinitions()
}

function buildSpecialCraftMenuItems(domain: SpecialCraftMenuDomain, factoryId?: string) {
  const operations = listSpecialCraftMenuOperationsByDomain(domain, factoryId)
  return operations.map((operation) => {
    const operationSlug = buildSpecialCraftOperationSlug(operation)
    return {
      key: `pfos-special-${operationSlug}-tasks`,
      title: `${operation.operationName}加工单`,
      icon: 'Sparkles',
      href: buildSpecialCraftTaskOrdersPath(operation),
    }
  })
}

function buildSpecialCraftMenuGroup(domain: SpecialCraftMenuDomain, operations?: SpecialCraftOperationDefinition[]) {
  const config = specialCraftMenuDomainConfig[domain]
  const operationItems = operations
    ? operations.map((operation) => {
        const operationSlug = buildSpecialCraftOperationSlug(operation)
        return {
          key: `pfos-special-${operationSlug}-tasks`,
          title: `${operation.operationName}加工单`,
          icon: 'Sparkles',
          href: buildSpecialCraftTaskOrdersPath(operation),
        }
      })
    : buildSpecialCraftMenuItems(domain)
  const items = [
    ...operationItems,
    {
      key: `pfos-special-${domain}-wait-process-warehouse`,
      title: config.waitProcessTitle,
      icon: 'Warehouse',
      href: buildSpecialCraftDomainWaitProcessWarehousePath(domain),
    },
    {
      key: `pfos-special-${domain}-wait-handover-warehouse`,
      title: config.waitHandoverTitle,
      icon: 'PackageCheck',
      href: buildSpecialCraftDomainWaitHandoverWarehousePath(domain),
    },
  ]
  return {
    title: config.title,
    icon: config.icon,
    items,
  } as MenuGroup & { icon: string }
}

export function buildSpecialCraftMenuGroups(): MenuGroup[] {
  return [
    buildSpecialCraftMenuGroup('AUXILIARY_CRAFT_FACTORY'),
    buildSpecialCraftMenuGroup('SPECIAL_CRAFT_FACTORY'),
  ].filter((group) => group.items.length > 0)
}

export function buildSpecialCraftMenuGroupsForFactory(factoryId: string): MenuGroup[] {
  return (Object.keys(specialCraftMenuDomainConfig) as SpecialCraftMenuDomain[])
    .map((domain) => buildSpecialCraftMenuGroup(domain, listSpecialCraftMenuOperationsByDomain(domain, factoryId)))
    .filter((group) => group.items.length > 0)
}

const specialCraftMenuGroups: MenuGroup[] = buildSpecialCraftMenuGroups()

// 系统列表
export const systems: System[] = [
  { id: 'pcs', name: '商品中心系统', shortName: 'PCS', defaultPage: '/pcs/workspace/overview' },
  { id: 'pms', name: '采购管理系统', shortName: 'PMS', defaultPage: '/pms/purchase-order' },
  { id: 'fcs', name: '工厂生产协同系统', shortName: 'FCS', defaultPage: '/fcs/workbench/overview' },
  { id: 'pfos', name: '工艺工厂运营系统', shortName: 'PFOS', defaultPage: '/fcs/craft/workbench/overview' },
  { id: 'wls', name: '仓储物流系统', shortName: 'WLS', defaultPage: '/wls/fabric-demand-board' },
  { id: 'los', name: '直播运营系统', shortName: 'LOS', defaultPage: '/los/live-schedule' },
  { id: 'oms', name: '订单管理系统', shortName: 'OMS', defaultPage: '/oms/order-list' },
  { id: 'bfis', name: '业财一体化系统', shortName: 'BFIS', defaultPage: '/bfis/financial-report' },
  { id: 'dds', name: '数据决策系统', shortName: 'DDS', defaultPage: '/dds/dashboard' },
]

// 各系统菜单
export const menusBySystem: Record<string, MenuGroup[]> = {
  pcs: [
    {
      title: '商品中心系统',
      items: [
        {
          key: 'pcs-menu-workspace',
          title: '工作台',
          icon: 'LayoutDashboard',
          children: [
            { key: 'pcs-workspace-overview', title: '概览看板', icon: 'LayoutDashboard', href: '/pcs/workspace/overview' },
            { key: 'pcs-workspace-todos', title: '我的待办', icon: 'CheckSquare', href: '/pcs/workspace/todos' },
            { key: 'pcs-workspace-alerts', title: '风险提醒', icon: 'AlertTriangle', href: '/pcs/workspace/alerts' },
          ],
        },
        {
          key: 'pcs-menu-projects',
          title: '商品项目管理',
          icon: 'FolderKanban',
          children: [
            { key: 'pcs-project-list', title: '商品项目', icon: 'FolderKanban', href: '/pcs/projects' },
            { key: 'pcs-template', title: '项目模板管理', icon: 'FileText', href: '/pcs/templates' },
            { key: 'pcs-work-items', title: '工作项库', icon: 'CheckSquare', href: '/pcs/work-items' },
          ],
        },
        {
          key: 'pcs-menu-testing',
          title: '测款与渠道管理',
          icon: 'TestTube',
          children: [
            { key: 'pcs-live-testing', title: '直播测款', icon: 'TestTube', href: '/pcs/testing/live' },
            { key: 'pcs-video-testing', title: '短视频测款', icon: 'TestTube', href: '/pcs/testing/video' },
            { key: 'pcs-channel-stores', title: '渠道店铺管理', icon: 'Store', href: '/pcs/channels/stores' },
          ],
        },
        {
          key: 'pcs-menu-pattern',
          title: '工程开发与打样管理',
          icon: 'Scissors',
          children: [
            { key: 'pcs-revision-tasks', title: '改版任务', icon: 'FileText', href: '/pcs/patterns/revision' },
            { key: 'pcs-pattern-tasks', title: '制版任务', icon: 'Scissors', href: '/pcs/patterns' },
            { key: 'pcs-part-template-library', title: '部位模板库', icon: 'Library', href: '/pcs/patterns/part-templates' },
            { key: 'pcs-color-tasks', title: '花型任务', icon: 'Palette', href: '/pcs/patterns/colors' },
            { key: 'pcs-pattern-library', title: '花型库', icon: 'Image', href: '/pcs/pattern-library' },
            { key: 'pcs-first-sample', title: '首版样衣打样', icon: 'Droplet', href: '/pcs/samples/first-sample' },
            { key: 'pcs-first-order', title: '首单样衣打样', icon: 'CheckSquare', href: '/pcs/samples/first-order' },
          ],
        },
        {
          key: 'pcs-menu-samples',
          title: '样衣管理',
          icon: 'PackageSearch',
          children: [
            { key: 'pcs-sample-inventory', title: '样衣库存', icon: 'Package', href: '/pcs/samples/inventory' },
            { key: 'pcs-sample-application', title: '样衣使用申请', icon: 'ClipboardList', href: '/pcs/samples/application' },
            { key: 'pcs-sample-transfer', title: '样衣流转记录', icon: 'Truck', href: '/pcs/samples/transfer' },
            { key: 'pcs-sample-return', title: '样衣退货与处理', icon: 'RotateCcw', href: '/pcs/samples/return' },
            { key: 'pcs-sample-ledger', title: '样衣台账', icon: 'BookOpen', href: '/pcs/samples/ledger' },
            { key: 'pcs-sample-stocktake', title: '盘点差异追踪', icon: 'ScanLine', href: '/pcs/samples/ledger/stocktake' },
            { key: 'pcs-sample-view', title: '样衣视图', icon: 'LayoutGrid', href: '/pcs/samples/view' },
          ],
        },
        {
          key: 'pcs-menu-products',
          title: '商品档案',
          icon: 'Archive',
          children: [
            { key: 'pcs-style-list', title: '款式档案', icon: 'Archive', href: '/pcs/products/styles' },
            { key: 'pcs-spec-list', title: '规格档案', icon: 'Package', href: '/pcs/products/specifications' },
            { key: 'pcs-channel-products', title: '渠道店铺商品', icon: 'ShoppingCart', href: '/pcs/products/channel-products' },
          ],
        },
        {
          key: 'pcs-menu-materials',
          title: '物料档案',
          icon: 'Layers',
          children: [
            { key: 'pcs-fabric-list', title: '面料档案', icon: 'Layers', href: '/pcs/materials/fabric' },
            { key: 'pcs-accessory-list', title: '辅料档案', icon: 'Paperclip', href: '/pcs/materials/accessory' },
            { key: 'pcs-yarn-list', title: '纱线档案', icon: 'CircleDot', href: '/pcs/materials/yarn' },
            { key: 'pcs-consumable-list', title: '耗材档案', icon: 'Package', href: '/pcs/materials/consumable' },
            { key: 'pcs-packaging-list', title: '包材档案', icon: 'Tags', href: '/pcs/materials/packaging' },
            { key: 'pcs-parts-list', title: '配件档案', icon: 'Scissors', href: '/pcs/materials/parts' },
          ],
        },
        {
          key: 'pcs-menu-settings',
          title: '系统设置',
          icon: 'Settings',
          children: [
            { key: 'pcs-config-workspace', title: '基础配置', icon: 'Settings', href: '/pcs/settings/config-workspace' },
          ],
        },
      ],
    },
  ],
  pms: [
    {
      title: '采购管理',
      items: [
        { key: 'purchase-order', title: '采购订单', icon: 'FileText', href: '/pms/purchase-order' },
        { key: 'supplier', title: '供应商管理', icon: 'Building2', href: '/pms/supplier' },
        { key: 'contract', title: '合同管理', icon: 'FileSignature', href: '/pms/contract' },
      ],
    },
  ],
  fcs: [
    {
      title: '平台运营系统',
      icon: 'PanelsTopLeft',
      items: [
        {
          key: 'fcs-platform-workbench',
          title: '工作台',
          icon: 'LayoutDashboard',
          children: [
            { key: 'workbench-overview', title: '概览看板', icon: 'LayoutDashboard', href: '/fcs/workbench/overview' },
            { key: 'workbench-todos', title: '我的待办', icon: 'ListTodo', href: '/fcs/workbench/todos' },
          ],
        },
        {
          key: 'fcs-platform-factories',
          title: '工厂池管理',
          icon: 'Factory',
          children: [
            { key: 'factories-onboarding', title: '工厂入驻管理', icon: 'ClipboardCheck', href: '/fcs/factories/onboarding' },
            { key: 'factories-profile', title: '工厂档案', icon: 'Factory', href: '/fcs/factories/profile' },
            { key: 'factories-third-party-rating', title: '三方工厂评级', icon: 'ShieldCheck', href: '/fcs/factories/third-party-rating' },
            { key: 'factories-third-party-comprehensive-assessment', title: '三方车缝厂综合评定', icon: 'ChartNoAxesCombined', href: '/fcs/factories/third-party-comprehensive-assessment' },
            { key: 'factories-capacity-profile', title: '工厂产能档案', icon: 'Gauge', href: '/fcs/factories/capacity-profile' },
            { key: 'factories-capability', title: '能力标签', icon: 'Tags', href: '/fcs/factories/capability' },
            { key: 'factories-settlement', title: '结算信息', icon: 'Receipt', href: '/fcs/factories/settlement' },
            { key: 'factories-status', title: '工厂状态', icon: 'ToggleLeft', href: '/fcs/factories/status' },
            { key: 'factories-performance', title: '工厂绩效', icon: 'BarChart3', href: '/fcs/factories/performance' },
          ],
        },
        {
          key: 'fcs-platform-production',
          title: '生产单管理',
          icon: 'FilePlus2',
          children: [
            { key: 'production-task-generation-rules', title: '生产单任务生成规则', icon: 'Workflow', href: '/fcs/production/task-generation-rules' },
            { key: 'production-demand-inbox', title: '生产需求单', icon: 'Inbox', href: '/fcs/production/demand-inbox' },
            { key: 'production-orders', title: '生产单管理', icon: 'FilePlus2', href: '/fcs/production/orders' },
            { key: 'production-preparation-timing', title: '生产准备时效', icon: 'TimerReset', href: '/fcs/production/preparation-timing' },
            { key: 'production-preparation-timing-statistics', title: '生产准备时效统计', icon: 'BarChart3', href: '/fcs/production/preparation-timing-statistics' },
            { key: 'production-changes', title: '生产单变更管理', icon: 'GitPullRequest', href: '/fcs/production/changes' },
            { key: 'production-craft-dict', title: '工序工艺字典', icon: 'BookOpen', href: '/fcs/production/craft-dict' },
          ],
        },
        {
          key: 'fcs-platform-process',
          title: '任务编排与执行准备',
          icon: 'Split',
          children: [
            { key: 'process-task-breakdown', title: '任务清单', icon: 'Split', href: '/fcs/process/task-breakdown' },
            { key: 'process-water-soluble-orders', title: '水溶加工单', icon: 'Waves', href: '/fcs/process/water-soluble-orders' },
            { key: 'process-dye-orders', title: '染色加工单', icon: 'Package', href: '/fcs/process/dye-orders' },
            { key: 'process-print-orders', title: '印花加工单', icon: 'ClipboardSignature', href: '/fcs/process/print-orders' },
          ],
        },
        {
          key: 'fcs-platform-dispatch',
          title: '任务分配',
          icon: 'LayoutGrid',
          children: [
            { key: 'dispatch-non-sewing', title: '非车缝任务分配', icon: 'LayoutGrid', href: '/fcs/dispatch/non-sewing' },
            { key: 'dispatch-sewing-workbench', title: '车缝分配工作台', icon: 'Shirt', href: '/fcs/dispatch/sewing' },
            { key: 'dispatch-continuous', title: '连续工序任务分配', icon: 'GitMerge', href: '/fcs/dispatch/continuous' },
            { key: 'dispatch-acceptance-sla', title: '接单时效配置', icon: 'TimerReset', href: '/fcs/dispatch/acceptance-sla' },
            { key: 'dispatch-tenders', title: '招标单管理', icon: 'Gavel', href: '/fcs/dispatch/tenders' },
          ],
        },
        {
          key: 'fcs-platform-progress',
          title: '任务进度与异常',
          icon: 'KanbanSquare',
          children: [
            { key: 'progress-production-orders', title: '生产单进度跟踪', icon: 'GitBranch', href: '/fcs/progress/production-orders' },
            { key: 'progress-board', title: '任务进度跟踪', icon: 'ClipboardList', href: '/fcs/progress/board' },
            { key: 'progress-exceptions', title: '异常定位与处理', icon: 'Search', href: '/fcs/progress/exceptions' },
            { key: 'progress-urge', title: '催办与通知', icon: 'BellRing', href: '/fcs/progress/urge' },
            { key: 'progress-handover', title: '交接链路追踪', icon: 'ScanLine', href: '/fcs/progress/handover' },
            { key: 'progress-material', title: '领料进度跟踪', icon: 'PackageSearch', href: '/fcs/progress/material' },
            { key: 'progress-milestone-config', title: '节点上报配置', icon: 'Flag', href: '/fcs/progress/milestone-config' },
            { key: 'progress-cutting-overview', title: '裁片任务总览', icon: 'Scissors', href: '/fcs/progress/cutting-overview' },
            { key: 'progress-cutting-exception-center', title: '裁片专项异常中心', icon: 'AlertTriangle', href: '/fcs/progress/cutting-exception-center' },
          ],
        },
        {
          key: 'fcs-platform-quality',
          title: '质量与扣款',
          icon: 'ClipboardCheck',
          children: [
            { key: 'quality-inspection', title: '质检记录', icon: 'ClipboardCheck', href: '/fcs/quality/qc-records' },
            { key: 'quality-deduction-analysis', title: '扣款记录', icon: 'BarChart3', href: '/fcs/quality/deduction-analysis' },
          ],
        },
        {
          key: 'fcs-platform-settlement',
          title: '对账与结算',
          icon: 'FileText',
          children: [
            { key: 'settlement-statements', title: '对账单', icon: 'FileText', href: '/fcs/settlement/statements' },
            { key: 'settlement-adjustments', title: '预结算流水', icon: 'SlidersHorizontal', href: '/fcs/settlement/adjustments' },
            { key: 'settlement-material-statements', title: '车缝领料对账', icon: 'ClipboardSignature', href: '/fcs/settlement/material-statements' },
            { key: 'settlement-batches', title: '预付款批次', icon: 'Layers', href: '/fcs/settlement/batches' },
          ],
        },
        {
          key: 'fcs-platform-trace',
          title: '成本溯源管理',
          icon: 'SearchCheck',
          children: [
            { key: 'trace-parent-codes', title: '扎包周转包父码管理', icon: 'Boxes', href: '/fcs/trace/parent-codes' },
            { key: 'trace-unique-codes', title: '唯一码管理', icon: 'Fingerprint', href: '/fcs/trace/unique-codes' },
            { key: 'trace-mapping', title: '父子码映射', icon: 'Merge', href: '/fcs/trace/mapping' },
            { key: 'trace-unit-price', title: '单价追溯查询', icon: 'SearchCheck', href: '/fcs/trace/unit-price' },
          ],
        },
        {
          key: 'fcs-platform-capacity',
          title: '产能日历',
          icon: 'LineChart',
          children: [
            { key: 'capacity-overview', title: '供需总览', icon: 'LineChart', href: '/fcs/capacity/overview' },
            { key: 'capacity-constraints', title: '工厂日历', icon: 'Filter', href: '/fcs/capacity/constraints' },
            { key: 'capacity-risk', title: '任务产值风险', icon: 'TrendingUp', href: '/fcs/capacity/risk' },
            { key: 'capacity-bottleneck', title: '工艺瓶颈与待分配', icon: 'AlertOctagon', href: '/fcs/capacity/bottleneck' },
            { key: 'capacity-policies', title: '暂停例外', icon: 'Settings2', href: '/fcs/capacity/policies' },
          ],
        },
      ],
    } as MenuGroup & { icon: string },
    {
      key: 'fcs-material-prep',
      title: '配料管理',
      icon: 'PackageCheck',
      items: [
        { key: 'material-prep-list', title: '配料列表', icon: 'LayoutList', href: '/fcs/material-prep/list' },
        { key: 'material-prep-dyeing', title: '染色配料', icon: 'Droplets', href: '/fcs/material-prep/dyeing' },
        { key: 'material-prep-printing', title: '印花配料', icon: 'Palette', href: '/fcs/material-prep/printing' },
        { key: 'material-prep-cutting', title: '裁片配料', icon: 'Scissors', href: '/fcs/material-prep/cutting' },
        { key: 'material-prep-sewing', title: '车缝配料', icon: 'Component', href: '/fcs/material-prep/sewing' },
        { key: 'material-prep-other', title: '其他配料', icon: 'Package', href: '/fcs/material-prep/other' },
      ],
    } as MenuGroup & { icon: string },
    {
      title: '工厂入驻&登录',
      icon: 'LogIn',
      items: [
        { key: 'pda-auth-login', title: '登录', icon: 'LogIn', href: '/fcs/pda/auth/login' },
        { key: 'pda-auth-onboarding', title: '入驻', icon: 'ClipboardPen', href: '/fcs/pda/auth/onboarding' },
      ],
    } as MenuGroup & { icon: string },
    {
      title: '工厂端移动应用',
      icon: 'Smartphone',
      items: [
        { key: 'pda-task-receive', title: '接单', icon: 'ClipboardList', href: '/fcs/pda/task-receive' },
        { key: 'pda-exec', title: '执行', icon: 'Play', href: '/fcs/pda/exec' },
        { key: 'pda-handover', title: '交接', icon: 'ArrowLeftRight', href: '/fcs/pda/handover' },
        { key: 'pda-warehouse', title: '仓管', icon: 'Warehouse', href: '/fcs/pda/warehouse' },
        { key: 'pda-settlement', title: '结算', icon: 'Wallet', href: '/fcs/pda/settlement' },
      ],
    } as MenuGroup & { icon: string },
  ],
  pfos: [
    {
      title: '工作台',
      icon: 'LayoutDashboard',
      items: [
        {
          key: 'pfos-workbench',
          title: '工作台',
          icon: 'LayoutDashboard',
          children: [
            { key: 'pfos-workbench-overview', title: '总览', icon: 'LayoutDashboard', href: '/fcs/craft/workbench/overview' },
          ],
        },
      ],
    } as MenuGroup & { icon: string },
    {
      title: '裁床厂管理',
      icon: 'Scissors',
      items: [
        {
          key: 'pfos-cutting-overview',
          title: '裁床总览',
          icon: 'Scissors',
          children: [
            { key: 'pfos-cutting-production-order-progress', title: '生产单进度', icon: 'GitBranch', href: '/fcs/craft/cutting/production-order-progress' },
            { key: 'pfos-cutting-production-progress', title: '生产单总览', icon: 'ListTodo', href: '/fcs/craft/cutting/production-progress' },
          ],
        },
        {
          key: 'pfos-cutting-prep',
          title: '裁前准备',
          icon: 'PackageSearch',
          children: [
            { key: 'pfos-cutting-cut-orders', title: '裁片单', icon: 'ClipboardList', href: '/fcs/craft/cutting/cut-orders' },
            { key: 'pfos-cutting-marker-list', title: '唛架方案', icon: 'Layers', href: '/fcs/craft/cutting/marker-list' },
            { key: 'pfos-cutting-pickup-management', title: '领料管理', icon: 'PackageCheck', href: '/fcs/craft/cutting/pickup-management' },
          ],
        },
        {
          key: 'pfos-cutting-execution',
          title: '铺布执行',
          icon: 'Rows3',
          children: [
            { key: 'pfos-cutting-spreading-list', title: '铺布单', icon: 'Rows3', href: '/fcs/craft/cutting/spreading-list' },
          ],
        },
        {
          key: 'pfos-cutting-post',
          title: '裁后处理',
          icon: 'PackageCheck',
          children: [
            { key: 'pfos-cutting-binding-strip-orders', title: '捆条加工单', icon: 'Sparkles', href: '/fcs/craft/cutting/special-processes' },
            { key: 'pfos-cutting-fei-tickets', title: '部位菲票打印', icon: 'Ticket', href: '/fcs/craft/cutting/fei-tickets' },
            { key: 'pfos-cutting-binding-fei-tickets', title: '捆条菲票打印', icon: 'TicketCheck', href: '/fcs/craft/cutting/binding-fei-tickets' },
            { key: 'pfos-cutting-fei-ticket-numbering', title: '菲票打编号', icon: 'ScanLine', href: '/fcs/craft/cutting/fei-ticket-numbering' },
            { key: 'pfos-cutting-transfer-bags', title: '中转袋流转', icon: 'PackageCheck', href: '/fcs/craft/cutting/transfer-bags' },
            { key: 'pfos-cutting-summary', title: '裁剪结果核查', icon: 'ClipboardPen', href: '/fcs/craft/cutting/summary' },
            { key: 'pfos-cutting-cut-piece-release', title: '裁片放行管理', icon: 'ClipboardCheck', href: '/fcs/craft/cutting/cut-piece-release' },
            { key: 'pfos-cutting-supplement-management', title: '补料管理', icon: 'RefreshCw', href: '/fcs/craft/cutting/supplement-management' },
          ],
        },
        {
          key: 'pfos-cutting-warehouse-management',
          title: '裁床仓库管理',
          icon: 'Warehouse',
          children: [
            { key: 'pfos-cutting-warehouse-wait-process', title: '待加工仓', icon: 'PackageSearch', href: '/fcs/craft/cutting/warehouse-management/wait-process' },
            { key: 'pfos-cutting-warehouse-wait-handover', title: '待交出仓', icon: 'Archive', href: '/fcs/craft/cutting/warehouse-management/wait-handover' },
            { key: 'pfos-cutting-handover-orders', title: '交出单', icon: 'ArrowLeftRight', href: '/fcs/craft/cutting/handover-orders' },
            { key: 'pfos-cutting-warehouse-sample', title: '样衣仓', icon: 'Shirt', href: '/fcs/craft/cutting/warehouse-management/sample-warehouse' },
          ],
        },
        {
          key: 'pfos-cutting-statistics',
          title: '裁床统计',
          icon: 'ChartBar',
          children: [
            { key: 'pfos-cutting-statistics-daily-production', title: '裁床每日生产报表', icon: 'CalendarDays', href: '/fcs/craft/cutting/statistics/daily-production' },
            { key: 'pfos-cutting-statistics-ab-material', title: '20天待发裁床AB料', icon: 'TableProperties', href: '/fcs/craft/cutting/statistics/ab-material' },
          ],
        },
      ],
    } as MenuGroup & { icon: string },
    {
      title: '印花厂管理',
      icon: 'Palette',
      items: [
        {
          key: 'pfos-printing',
          title: '印花管理',
          icon: 'Palette',
          children: [
            { key: 'pfos-printing-work-orders', title: '印花加工单', icon: 'ClipboardList', href: '/fcs/craft/printing/work-orders' },
            { key: 'pfos-printing-wait-process-warehouse', title: '印花待加工仓', icon: 'Warehouse', href: '/fcs/craft/printing/wait-process-warehouse' },
            { key: 'pfos-printing-wait-handover-warehouse', title: '印花待交出仓', icon: 'PackageCheck', href: '/fcs/craft/printing/wait-handover-warehouse' },
            { key: 'pfos-printing-statistics', title: '印花统计', icon: 'BarChart3', href: '/fcs/craft/printing/statistics' },
            { key: 'pfos-printing-dashboards', title: '印花大屏', icon: 'Monitor', href: '/fcs/craft/printing/dashboards' },
          ],
        },
      ],
    } as MenuGroup & { icon: string },
    {
      title: '染厂管理',
      icon: 'Droplet',
      items: [
        {
          key: 'pfos-dyeing',
          title: '染厂管理',
          icon: 'Droplet',
          children: [
            { key: 'pfos-dyeing-work-orders', title: '染色加工单', icon: 'ClipboardList', href: '/fcs/craft/dyeing/work-orders' },
            { key: 'pfos-dyeing-combined-dyeing', title: '合并染色', icon: 'Merge', href: '/fcs/craft/dyeing/combined-dyeing' },
            { key: 'pfos-dyeing-water-soluble-orders', title: '水溶加工单', icon: 'Waves', href: '/fcs/craft/dyeing/water-soluble-orders' },
            { key: 'pfos-dyeing-wait-process-warehouse', title: '染色待加工仓', icon: 'Warehouse', href: '/fcs/craft/dyeing/wait-process-warehouse' },
            { key: 'pfos-dyeing-wait-handover-warehouse', title: '染色待交出仓', icon: 'PackageCheck', href: '/fcs/craft/dyeing/wait-handover-warehouse' },
            { key: 'pfos-dyeing-statistics', title: '染色统计', icon: 'BarChart3', href: '/fcs/craft/dyeing/reports' },
          ],
        },
      ],
    } as MenuGroup & { icon: string },
    {
      title: '毛织厂管理',
      icon: 'Shirt',
      items: [
        {
          key: 'pfos-wool',
          title: '毛织管理',
          icon: 'Shirt',
          children: [
            { key: 'pfos-wool-work-orders', title: '毛织加工单', icon: 'ClipboardList', href: '/fcs/craft/wool/work-orders' },
            { key: 'pfos-wool-machine-schedule', title: '横机排产', icon: 'CalendarClock', href: '/fcs/craft/wool/machine-schedule' },
            { key: 'pfos-wool-machines', title: '横机设备', icon: 'Settings2', href: '/fcs/craft/wool/machines' },
            { key: 'pfos-wool-wait-process-warehouse', title: '毛织待加工仓', icon: 'Warehouse', href: '/fcs/craft/wool/wait-process-warehouse' },
            { key: 'pfos-wool-wait-handover-warehouse', title: '毛织待交出仓', icon: 'PackageCheck', href: '/fcs/craft/wool/wait-handover-warehouse' },
            { key: 'pfos-wool-fei-tickets', title: '毛织菲票', icon: 'Ticket', href: '/fcs/craft/wool/fei-tickets' },
            { key: 'pfos-wool-statistics', title: '毛织统计', icon: 'BarChart3', href: '/fcs/craft/wool/statistics' },
          ],
        },
      ],
    } as MenuGroup & { icon: string },
    {
      title: '后道工厂管理',
      icon: 'PackageCheck',
      items: [
        {
          key: 'pfos-post-finishing',
          title: '后道工厂管理',
          icon: 'PackageCheck',
          children: [
            { key: 'pfos-post-finishing-tasks', title: '后道任务', icon: 'ListChecks', href: '/fcs/craft/post-finishing/tasks' },
            { key: 'pfos-post-finishing-qc-orders', title: '质检单', icon: 'ClipboardCheck', href: '/fcs/craft/post-finishing/qc-orders' },
            { key: 'pfos-post-finishing-work-orders', title: '后道单', icon: 'ClipboardList', href: '/fcs/craft/post-finishing/work-orders' },
            { key: 'pfos-post-finishing-recheck-orders', title: '复检单', icon: 'RefreshCw', href: '/fcs/craft/post-finishing/recheck-orders' },
            { key: 'pfos-post-finishing-wait-process-warehouse', title: '后道待加工仓', icon: 'Warehouse', href: '/fcs/craft/post-finishing/wait-process-warehouse' },
            { key: 'pfos-post-finishing-wait-handover-warehouse', title: '后道待交出仓', icon: 'PackageCheck', href: '/fcs/craft/post-finishing/wait-handover-warehouse' },
          ],
        },
      ],
    } as MenuGroup & { icon: string },
    ...specialCraftMenuGroups,
  ],
  wls: [
    {
      title: '仓储管理',
      items: [
        { key: 'wls-fabric-demand-board', title: '面料需求看板', icon: 'PanelsTopLeft', href: '/wls/fabric-demand-board' },
        { key: 'inventory', title: '库存管理', icon: 'Archive', href: '/wls/inventory' },
        { key: 'inbound', title: '入库管理', icon: 'ArrowDownToLine', href: '/wls/inbound' },
        { key: 'outbound', title: '出库管理', icon: 'ArrowUpFromLine', href: '/wls/outbound' },
      ],
    },
  ],
  los: [
    {
      title: '直播运营',
      items: [
        { key: 'live-schedule', title: '直播排期', icon: 'Video', href: '/los/live-schedule' },
        { key: 'live-room', title: '直播间管理', icon: 'Tv', href: '/los/live-room' },
        { key: 'anchor', title: '主播管理', icon: 'Users', href: '/los/anchor' },
      ],
    },
  ],
  oms: [
    {
      title: '订单管理',
      items: [
        { key: 'order-list', title: '订单列表', icon: 'ShoppingCart', href: '/oms/order-list' },
        { key: 'return-order', title: '退换货管理', icon: 'RotateCcw', href: '/oms/return-order' },
        { key: 'after-sale', title: '售后服务', icon: 'Headphones', href: '/oms/after-sale' },
      ],
    },
  ],
  bfis: [
    {
      title: '财务管理',
      items: [
        { key: 'financial-report', title: '财务报表', icon: 'BarChart3', href: '/bfis/financial-report' },
        { key: 'cost-analysis', title: '成本分析', icon: 'PieChart', href: '/bfis/cost-analysis' },
        { key: 'settlement', title: '结算管理', icon: 'Wallet', href: '/bfis/settlement' },
      ],
    },
  ],
  dds: [
    {
      title: '数据分析',
      items: [
        { key: 'dashboard', title: '数据看板', icon: 'LayoutDashboard', href: '/dds/dashboard' },
        { key: 'report', title: '报表中心', icon: 'FileBarChart', href: '/dds/report' },
        { key: 'bi', title: 'BI分析', icon: 'TrendingUp', href: '/dds/bi' },
      ],
    },
  ],
}
