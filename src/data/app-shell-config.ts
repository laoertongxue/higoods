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
  { id: 'pcs', name: '商品中心系统', shortName: 'PCS', defaultPage: '/pcs/products/styles' },
  { id: 'pms', name: '采购管理系统', shortName: 'PMS', defaultPage: '/pms/workbench/overview' },
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
          key: 'pcs-menu-testing',
          title: '商品测款',
          icon: 'TestTube',
          children: [
            { key: 'pcs-testing-order-list', title: '测款单', icon: 'ClipboardCheck', href: '/pcs/testing/orders' },
          ],
        },
        {
          key: 'pcs-menu-engineering',
          title: '生产准备管理',
          icon: 'Scissors',
          children: [
            { key: 'pcs-engineering-masters', title: '生产准备单', icon: 'FolderKanban', href: '/pcs/production-preparation/orders' },
            { key: 'pcs-design-revision-tasks', title: '设计改款任务', icon: 'FileText', href: '/pcs/production-preparation/design-revision' },
            { key: 'pcs-pattern-tasks', title: '制版任务', icon: 'Scissors', href: '/pcs/production-preparation/plate-making' },
            { key: 'pcs-color-tasks', title: '花型任务', icon: 'Palette', href: '/pcs/production-preparation/artwork' },
            { key: 'pcs-engineering-color-tasks', title: '调色任务', icon: 'Droplets', href: '/pcs/production-preparation/color' },
            { key: 'pcs-engineering-purchase-tasks', title: '辅料下单任务', icon: 'ShoppingCart', href: '/pcs/production-preparation/purchase' },
            { key: 'pcs-engineering-tech-pack-tasks', title: '技术包确认任务', icon: 'FileCheck', href: '/pcs/production-preparation/tech-pack' },
            { key: 'pcs-display-sample', title: '销售展示样衣任务', icon: 'Shirt', href: '/pcs/production-preparation/display-sample' },
            { key: 'pcs-first-sample', title: '首单样衣任务', icon: 'Droplet', href: '/pcs/production-preparation/first-sample' },
          ],
        },
        {
          key: 'pcs-menu-technical-data',
          title: '技术资料',
          icon: 'BookOpen',
          children: [
            { key: 'pcs-tech-pack-library', title: '技术包', icon: 'FileText', href: '/pcs/technical-data/tech-packs' },
            { key: 'pcs-bom-pricing', title: 'BOM 与价格', icon: 'Receipt', href: '/pcs/technical-data/bom-pricing' },
            { key: 'pcs-pattern-library', title: '花型库', icon: 'Image', href: '/pcs/pattern-library' },
            { key: 'pcs-part-template-library', title: '部位模板库', icon: 'Library', href: '/pcs/patterns/part-templates' },
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
          title: '商品&物料档案',
          icon: 'Archive',
          children: [
            { key: 'pcs-style-list', title: '款式档案', icon: 'Archive', href: '/pcs/products/styles' },
            { key: 'pcs-spec-list', title: '规格档案', icon: 'Package', href: '/pcs/products/specifications' },
            { key: 'pcs-channel-products', title: '渠道店铺商品', icon: 'ShoppingCart', href: '/pcs/products/channel-products' },
            { key: 'pcs-channel-stores', title: '渠道店铺管理', icon: 'Store', href: '/pcs/channels/stores' },
            { key: 'pcs-fabric-list', title: '面料档案', icon: 'Layers', href: '/pcs/materials/fabric' },
            { key: 'pcs-accessory-list', title: '辅料档案', icon: 'Paperclip', href: '/pcs/materials/accessory' },
            { key: 'pcs-yarn-list', title: '纱线档案', icon: 'CircleDot', href: '/pcs/materials/yarn' },
            { key: 'pcs-consumable-list', title: '耗材档案', icon: 'Package', href: '/pcs/materials/consumable' },
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
      title: '采购工作台',
      items: [
        { key: 'pms-workbench', title: '采购工作台', icon: 'LayoutDashboard', href: '/pms/workbench/overview' },
      ],
    },
    {
      title: '采购管理',
      items: [
        { key: 'purchase-order', title: '采购订单', icon: 'FileText', href: '/pms/purchase-order' },
      ],
    },
    {
      title: '基础资料',
      items: [
        { key: 'pms-trade-subjects', title: '贸易主体管理', icon: 'Landmark', href: '/pms/trade-subjects' },
        { key: 'pms-suppliers', title: '商品供应商管理', icon: 'Building2', href: '/pms/suppliers' },
        { key: 'pms-supplier-supply-archives', title: '供应商供货档案', icon: 'Handshake', href: '/pms/supplier-supply-archives' },
        { key: 'pms-material-archives', title: '面辅料列表', icon: 'Layers', href: '/pms/material-archives' },
        { key: 'pms-garment-skus', title: '成衣列表', icon: 'Shirt', href: '/pms/garment-skus' },
        { key: 'pms-sample-skus', title: '样衣列表', icon: 'Scissors', href: '/pms/sample-skus' },
        { key: 'pms-warehouses', title: '仓库管理', icon: 'Warehouse', href: '/pms/warehouses' },
        { key: 'pms-units', title: '单位管理', icon: 'Ruler', href: '/pms/units' },
        { key: 'pms-bom-templates', title: 'BOM/样板管理', icon: 'Boxes', href: '/pms/bom-templates' },
      ],
    },
    {
      title: '原料管理',
      items: [
        { key: 'pms-material-inventory', title: '面辅料库存监控', icon: 'Radar', href: '/pms/material-inventory' },
      ],
    },
    {
      title: '中转仓',
      items: [
        { key: 'pms-transit-dashboard', title: '数据总览', icon: 'LayoutDashboard', href: '/pms/transit/dashboard' },
        { key: 'pms-transit-receipts', title: '中转收货单列表', icon: 'PackageCheck', href: '/pms/transit/receipts' },
        { key: 'pms-transit-order-checks', title: '生产单校验', icon: 'ClipboardCheck', href: '/pms/transit/order-checks' },
        { key: 'pms-transit-preparation-tasks', title: '配料任务', icon: 'ListChecks', href: '/pms/transit/preparation-tasks' },
      ],
    },
    {
      title: '采购建议',
      items: [
        { key: 'pms-purchase-suggestions', title: '商品采购建议', icon: 'Lightbulb', href: '/pms/purchase-suggestions' },
        { key: 'pms-kol-demands', title: 'KOL采购需求', icon: 'Megaphone', href: '/pms/kol-demands' },
      ],
    },
    {
      title: '商品采购',
      items: [
        { key: 'pms-product-purchase-orders', title: '商品采购单', icon: 'ClipboardList', href: '/pms/product-purchase-orders' },
      ],
    },
    {
      title: '面辅料采购',
      items: [
        { key: 'pms-material-requirements', title: '面辅料需求分析', icon: 'Puzzle', href: '/pms/material-requirements' },
        { key: 'pms-material-purchase-orders', title: '面辅料采购单', icon: 'PackageSearch', href: '/pms/material-purchase-orders' },
        { key: 'pms-material-purchase-tracking', title: '面辅料采购跟踪', icon: 'Truck', href: '/pms/material-purchase-tracking' },
      ],
    },
    {
      title: '面辅料供应商确认',
      items: [
        { key: 'pms-material-supplier-confirmations', title: '面辅料供应商确认单', icon: 'BadgeCheck', href: '/pms/material-supplier-confirmations' },
      ],
    },
    {
      title: '头程物流',
      items: [
        { key: 'pms-first-leg-shipments', title: '头程物流', icon: 'Ship', href: '/pms/first-leg-shipments' },
        { key: 'pms-first-leg-carriers', title: '头程物流商管理', icon: 'Building2', href: '/pms/first-leg-carriers' },
      ],
    },
    {
      title: '采购对账',
      items: [
        { key: 'pms-subject-operations', title: '主体经营明细', icon: 'ChartNoAxesCombined', href: '/pms/subject-operations' },
        { key: 'pms-material-reconciliations', title: '面辅料采购对账', icon: 'ReceiptText', href: '/pms/material-reconciliations' },
        { key: 'pms-material-payment-requests', title: '面辅料采购请款', icon: 'Banknote', href: '/pms/material-payment-requests' },
        { key: 'pms-logistics-reconciliations', title: '物流费用对账', icon: 'ClipboardCheck', href: '/pms/logistics-reconciliations' },
        { key: 'pms-logistics-payment-requests', title: '物流费用请款', icon: 'Wallet', href: '/pms/logistics-payment-requests' },
      ],
    },
    {
      title: '系统设置',
      items: [
        { key: 'pms-users', title: '用户管理', icon: 'Users', href: '/pms/users' },
        { key: 'pms-roles', title: '角色权限', icon: 'ShieldCheck', href: '/pms/roles' },
        { key: 'pms-dictionaries', title: '字典配置', icon: 'BookOpen', href: '/pms/dictionaries' },
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
            { key: 'dispatch-workbench', title: '任务分配工作台', icon: 'LayoutGrid', href: '/fcs/dispatch/workbench' },
            { key: 'dispatch-acceptance-sla', title: '接单时效配置', icon: 'TimerReset', href: '/fcs/dispatch/acceptance-sla' },
            { key: 'dispatch-tenders', title: '招标单管理', icon: 'Gavel', href: '/fcs/dispatch/tenders' },
            { key: 'production-contracts', title: '生产合同管理', icon: 'FileSignature', href: '/fcs/contracts' },
          ],
        },
        {
          key: 'fcs-platform-progress',
          title: '任务进度与异常',
          icon: 'KanbanSquare',
          children: [
            { key: 'progress-production-orders', title: '生产单进度跟踪', icon: 'GitBranch', href: '/fcs/production_order_track/index' },
            { key: 'progress-board', title: '任务进度跟踪', icon: 'ClipboardList', href: '/fcs/progress/board' },
            { key: 'progress-exceptions', title: '异常定位与处理', icon: 'Search', href: '/fcs/progress/exceptions' },
            { key: 'progress-urge', title: '催办与通知', icon: 'BellRing', href: '/fcs/progress/urge' },
            { key: 'progress-handover', title: '交接链路追踪', icon: 'ScanLine', href: '/fcs/progress/handover' },
            { key: 'progress-material', title: '接收进度跟踪', icon: 'PackageSearch', href: '/fcs/progress/material' },
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
            { key: 'settlement-material-statements', title: '车缝接收对账', icon: 'ClipboardSignature', href: '/fcs/settlement/material-statements' },
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
      ],
    } as MenuGroup & { icon: string },
    {
      key: 'fcs-sewing-outsourcing',
      title: '车缝外发协同',
      icon: 'Workflow',
      items: [
        { key: 'sewing-outsourcing-workbench', title: '我的工作台', icon: 'LayoutDashboard', href: '/fcs/sewing-outsourcing/workbench' },
        { key: 'sewing-outsourcing-production-order-duration', title: '生成单全流程耗时', icon: 'Clock', href: '/fcs/sewing-outsourcing/production-order-duration' },
        { key: 'sewing-outsourcing-tasks', title: '车缝任务', icon: 'ListTodo', href: '/fcs/sewing-outsourcing/tasks' },
        { key: 'sewing-outsourcing-cut-piece-handover', title: '交出与欠片', icon: 'PackageOpen', href: '/fcs/sewing-outsourcing/cut-piece-handover' },
        { key: 'sewing-outsourcing-sample-approval', title: '批版建议', icon: 'ClipboardCheck', href: '/fcs/sewing-outsourcing/sample-approval-suggestions' },
        { key: 'sewing-outsourcing-returns', title: '回货跟进', icon: 'PackageCheck', href: '/fcs/sewing-outsourcing/returns' },
        { key: 'sewing-outsourcing-supplements', title: '补料跟进', icon: 'PackagePlus', href: '/fcs/sewing-outsourcing/supplements' },
        { key: 'sewing-outsourcing-cut-piece-returns', title: '裁片退仓', icon: 'RotateCcw', href: '/fcs/sewing-outsourcing/cut-piece-returns' },
        { key: 'sewing-outsourcing-responsibility-transfers', title: '责任移交', icon: 'UserRoundCog', href: '/fcs/sewing-outsourcing/responsibility-transfers' },
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
          ],
        },
        {
          key: 'pfos-cutting-pickup',
          title: '接收管理',
          icon: 'PackageCheck',
          children: [
            { key: 'pfos-cutting-pickup-ready', title: '已配齐待接收', icon: 'PackageCheck', href: '/fcs/craft/cutting/pickup-management/ready' },
            { key: 'pfos-cutting-pickup-incomplete', title: '未配齐配料', icon: 'MapPin', href: '/fcs/craft/cutting/pickup-management/incomplete' },
            { key: 'pfos-cutting-pickup-history', title: '已接收', icon: 'History', href: '/fcs/craft/cutting/pickup-management/history' },
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
            { key: 'pfos-cutting-cut-piece-return-processing', title: '裁片退仓接收入仓', icon: 'ArchiveRestore', href: '/fcs/craft/cutting/cut-piece-return-processing' },
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
            { key: 'pfos-printing-pending-receipts', title: '待接收', icon: 'ScanLine', href: '/fcs/craft/printing/pending-receipts' },
            { key: 'pfos-printing-work-orders', title: '印花加工单', icon: 'ClipboardList', href: '/fcs/craft/printing/work-orders' },
            { key: 'pfos-printing-wait-process-warehouse', title: '印花待加工仓', icon: 'Warehouse', href: '/fcs/craft/printing/wait-process-warehouse' },
            { key: 'pfos-printing-wait-handover-warehouse', title: '印花待交出仓', icon: 'PackageCheck', href: '/fcs/craft/printing/wait-handover-warehouse' },
            { key: 'pfos-printing-pending-handover', title: '印花待交出列表', icon: 'ListChecks', href: '/fcs/craft/printing/pending-handover' },
            { key: 'pfos-printing-handover-documents', title: '印花交出单据', icon: 'FileText', href: '/fcs/craft/printing/handover-documents' },
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
            { key: 'pfos-dyeing-pending-receipts', title: '待接收', icon: 'ScanLine', href: '/fcs/craft/dyeing/pending-receipts' },
            { key: 'pfos-dyeing-work-orders', title: '染色加工单', icon: 'ClipboardList', href: '/fcs/craft/dyeing/work-orders' },
            { key: 'pfos-dyeing-water-soluble-orders', title: '水溶加工单', icon: 'Waves', href: '/fcs/craft/dyeing/water-soluble-orders' },
            { key: 'pfos-water-pending-handover', title: '水溶待交出列表', icon: 'ListTodo', href: '/fcs/craft/dyeing/water-soluble-pending-handover' },
            { key: 'pfos-water-handover-documents', title: '水溶交出单据', icon: 'Files', href: '/fcs/craft/dyeing/water-soluble-handover-documents' },
            { key: 'pfos-dyeing-wait-process-warehouse', title: '染色待加工仓', icon: 'Warehouse', href: '/fcs/craft/dyeing/wait-process-warehouse' },
            { key: 'pfos-dyeing-wait-handover-warehouse', title: '染色待交出仓', icon: 'PackageCheck', href: '/fcs/craft/dyeing/wait-handover-warehouse' },
            { key: 'pfos-dyeing-pending-handover', title: '染色待交出列表', icon: 'ListTodo', href: '/fcs/craft/dyeing/pending-handover' },
            { key: 'pfos-dyeing-handover-documents', title: '染色交出单据', icon: 'Files', href: '/fcs/craft/dyeing/handover-documents' },
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
            { key: 'pfos-wool-pending-receipts', title: '毛织待接收', icon: 'PackageCheck', href: '/fcs/craft/wool/pending-receipts' },
            { key: 'pfos-wool-knitting-orders', title: '横机加工单', icon: 'ClipboardList', href: '/fcs/craft/wool/knitting-orders' },
            { key: 'pfos-wool-linking-orders', title: '缝盘加工单', icon: 'ClipboardList', href: '/fcs/craft/wool/linking-orders' },
            { key: 'pfos-wool-machine-associations', title: '横机生产关联', icon: 'Link2', href: '/fcs/process-factory/wool/machine-associations' },
            { key: 'pfos-wool-machines', title: '横机设备', icon: 'Settings2', href: '/fcs/craft/wool/machines' },
            { key: 'pfos-wool-wait-process-warehouse', title: '毛织待加工仓', icon: 'Warehouse', href: '/fcs/craft/wool/wait-process-warehouse' },
            { key: 'pfos-wool-wait-handover-warehouse', title: '毛织待交出仓', icon: 'PackageCheck', href: '/fcs/craft/wool/wait-handover-warehouse' },
          ],
        },
      ],
    } as MenuGroup & { icon: string },
    {
      title: '辅料工厂管理',
      icon: 'Paperclip',
      items: [
        {
          key: 'pfos-accessory-lace',
          title: '花边厂管理',
          icon: 'Flower2',
          children: [
            { key: 'pfos-accessory-lace-purchase-demands', title: '采购需求', icon: 'ShoppingCart', href: '/fcs/craft/accessory/lace/purchase-demands' },
            { key: 'pfos-accessory-lace-work-orders', title: '花边生产单', icon: 'ClipboardList', href: '/fcs/craft/accessory/lace/work-orders' },
            { key: 'pfos-accessory-lace-handovers', title: '交出记录', icon: 'ArrowLeftRight', href: '/fcs/craft/accessory/lace/handover-records' },
          ],
        },
        {
          key: 'pfos-accessory-webbing', title: '织带厂管理', icon: 'Paperclip',
          children: [
            { key: 'pfos-accessory-webbing-purchase-demands', title: '采购需求', icon: 'ShoppingCart', href: '/fcs/craft/accessory/webbing/purchase-demands' },
            { key: 'pfos-accessory-webbing-base-orders', title: '基础生产单', icon: 'ClipboardList', href: '/fcs/craft/accessory/webbing/base-orders' },
            { key: 'pfos-accessory-webbing-work-orders', title: '生产加工单', icon: 'Workflow', href: '/fcs/craft/accessory/webbing/work-orders' },
            { key: 'pfos-accessory-webbing-pending-receipts', title: '待接收', icon: 'Inbox', href: '/fcs/craft/accessory/webbing/pending-receipts' },
            { key: 'pfos-accessory-webbing-handover-records', title: '交出记录', icon: 'ArrowLeftRight', href: '/fcs/craft/accessory/webbing/handover-records' },
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
            { key: 'pfos-post-finishing-tasks', title: '后道生产任务', icon: 'ListTodo', href: '/fcs/craft/post-finishing/tasks' },
            { key: 'pfos-post-finishing-material-transfers', title: '后道辅料调拨单', icon: 'PackageOpen', href: '/fcs/craft/post-finishing/material-transfers' },
            { key: 'pfos-post-finishing-qc-orders', title: '质检单', icon: 'ClipboardCheck', href: '/fcs/craft/post-finishing/qc-orders' },
            { key: 'pfos-post-finishing-work-orders', title: '后道加工单', icon: 'ClipboardList', href: '/fcs/craft/post-finishing/work-orders' },
            { key: 'pfos-post-finishing-recheck-orders', title: '复检单', icon: 'RefreshCw', href: '/fcs/craft/post-finishing/recheck-orders' },
            { key: 'pfos-post-finishing-wait-process-warehouse', title: '后道待加工仓', icon: 'Warehouse', href: '/fcs/craft/post-finishing/wait-process-warehouse' },
            { key: 'pfos-post-finishing-wait-handover-warehouse', title: '后道待交出仓', icon: 'PackageCheck', href: '/fcs/craft/post-finishing/wait-handover-warehouse' },
            { key: 'pfos-post-finishing-outbound-orders', title: '后道出货单', icon: 'Truck', href: '/fcs/craft/post-finishing/outbound-orders' },
            { key: 'pfos-post-finishing-audit-records', title: '差异与操作日志', icon: 'History', href: '/fcs/craft/post-finishing/audit-records' },
            { key: 'pfos-post-finishing-authorization-code', title: '我的动态授权码', icon: 'KeyRound', href: '/fcs/craft/post-finishing/authorization-code' },
            { key: 'pfos-post-finishing-garment-spu-replacements', title: '成衣 SPU 替换', icon: 'RefreshCw', href: '/fcs/craft/post-finishing/garment-spu-replacements' },
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
        { key: 'wls-accessory-receipts', title: '中央辅料仓收货', icon: 'PackageCheck', href: '/wls/accessory-receipts' },
        { key: 'wls-accessory-base-materials', title: '织带基础原料收发', icon: 'Boxes', href: '/wls/accessory-base-materials' },
        { key: 'wls-accessory-material-preparation', title: '织带连续料备料', icon: 'Boxes', href: '/wls/accessory-material-preparation' },
        { key: 'wls-accessory-continuous-stock', title: '织带半成品库存', icon: 'Boxes', href: '/wls/accessory-continuous-stock' },
        { key: 'wls-accessory-production-stock', title: '辅料加工产出库存', icon: 'Boxes', href: '/wls/accessory-production-stock' },
        { key: 'wls-accessory-production-receipts', title: '生产领料确认', icon: 'PackageCheck', href: '/wls/accessory-production-receipts' },
        { key: 'wls-garment-spu-replacements', title: '成衣 SPU 替换', icon: 'RefreshCw', href: '/wls/garment-spu-replacements' },
        { key: 'wls-garment-relabel-tasks', title: '成衣仓换码任务', icon: 'Tags', href: '/wls/garment-relabel-tasks' },
        { key: 'inbound', title: '入库管理', icon: 'ArrowDownToLine', href: '/wls/inbound' },
        { key: 'finished-inbound', title: '成衣仓收货', icon: 'ArrowDownToLine', href: '/wls/finished-inbound' },
      ],
    },
    {
      title: '成衣仓',
      items: [
        { key: 'wls-finished-dashboard', title: '成衣仓首页', icon: 'LayoutDashboard', href: '/wls/finished/dashboard' },
        { key: 'wls-finished-ship-scan', title: '扫码出库', icon: 'ScanBarcode', href: '/wls/finished/ship-scan' },
        { key: 'wls-finished-pre-inbound', title: '预入库管理', icon: 'ClipboardList', href: '/wls/finished/pre-inbound' },
        { key: 'wls-finished-putaway', title: '入库单列表', icon: 'ArrowDownToLine', href: '/wls/finished/putaway' },
        { key: 'wls-finished-return-orders', title: '退货收货列表', icon: 'RotateCcw', href: '/wls/finished/return-orders' },
        { key: 'wls-finished-return-quality', title: '退货质检列表', icon: 'ShieldCheck', href: '/wls/finished/return-quality' },
        { key: 'wls-finished-return-inbound', title: '退货入库列表', icon: 'PackageCheck', href: '/wls/finished/return-inbound' },
        { key: 'wls-finished-pre-outbound', title: '预出库管理', icon: 'FileText', href: '/wls/finished/pre-outbound' },
        { key: 'wls-finished-outbound-orders', title: '出库单列表', icon: 'ArrowUpFromLine', href: '/wls/finished/outbound-orders' },
        { key: 'wls-finished-wave-manage', title: '波次管理', icon: 'Waves', href: '/wls/finished/wave-manage' },
        { key: 'wls-finished-multi-item-packing', title: '多件打包', icon: 'Package', href: '/wls/finished/multi-item-packing' },
        { key: 'wls-finished-collection-orders', title: '集货订单', icon: 'ShoppingBag', href: '/wls/finished/collection/orders' },
        { key: 'wls-finished-collection-picking', title: '集货拣货波次', icon: 'ListChecks', href: '/wls/finished/collection/picking' },
        { key: 'wls-finished-collection-sorting', title: '二次分拨列表', icon: 'GitBranch', href: '/wls/finished/collection/sorting' },
        { key: 'wls-finished-collection-removal', title: '移出集货', icon: 'MoveRight', href: '/wls/finished/collection/removal' },
        { key: 'wls-finished-collection-records', title: '集货记录', icon: 'History', href: '/wls/finished/collection/records' },
        { key: 'wls-finished-stock-realtime', title: '即时库存查询', icon: 'Archive', href: '/wls/finished/stock/realtime' },
        { key: 'wls-finished-stock-location', title: '仓位库存查询', icon: 'MapPin', href: '/wls/finished/stock/location' },
        { key: 'wls-finished-stock-flow', title: '库存流水查询', icon: 'ArrowLeftRight', href: '/wls/finished/stock/flow' },
        { key: 'wls-finished-stock-transfer', title: '移货操作', icon: 'ArrowRightLeft', href: '/wls/finished/stock/transfer' },
        { key: 'wls-finished-stock-inventory-count', title: '库存盘点', icon: 'ClipboardCheck', href: '/wls/finished/stock/inventory-count' },
        { key: 'wls-finished-sorter-machine', title: '分拣机配置', icon: 'Settings', href: '/wls/finished/sorter/machine-config' },
        { key: 'wls-finished-sorter-gate', title: '格口配置', icon: 'Grid3x3', href: '/wls/finished/sorter/gate-config' },
        { key: 'wls-finished-sorter-records', title: '异常记录', icon: 'AlertTriangle', href: '/wls/finished/sorter/records' },
      ],
    },
    {
      title: '中转仓',
      items: [
        { key: 'wls-transit-dashboard', title: '中转仓首页', icon: 'LayoutDashboard', href: '/wls/transit/dashboard' },
        { key: 'wls-transit-overview', title: '数据总览', icon: 'BarChart3', href: '/wls/transit/overview' },
        { key: 'wls-transit-receive-manage', title: '预入库单管理', icon: 'ClipboardList', href: '/wls/transit/receive-manage' },
        { key: 'wls-transit-inbound-manage', title: '收货单管理', icon: 'PackageCheck', href: '/wls/transit/inbound-manage' },
        { key: 'wls-transit-kit-center', title: '齐套校验中心', icon: 'ShieldCheck', href: '/wls/transit/kit-center' },
        { key: 'wls-transit-allocation-manage', title: '配料任务管理', icon: 'ListOrdered', href: '/wls/transit/allocation-manage' },
        { key: 'wls-transit-putaway-manage', title: '上架任务管理', icon: 'ArrowUpToLine', href: '/wls/transit/putaway-manage' },
        { key: 'wls-transit-work-area', title: '作业区管理', icon: 'Warehouse', href: '/wls/transit/work-area-manage' },
        { key: 'wls-transit-outbound-manage', title: '出库单管理', icon: 'ArrowUpFromLine', href: '/wls/transit/outbound-manage' },
        { key: 'wls-transit-inventory', title: '中转仓库存', icon: 'Archive', href: '/wls/transit/inventory' },
        { key: 'wls-transit-location', title: '中转仓库位', icon: 'MapPin', href: '/wls/transit/location' },
        { key: 'wls-transit-warehouse-transfer', title: '中转仓调拨', icon: 'ArrowRightLeft', href: '/wls/transit/warehouse-transfer' },
      ],
    },
    {
      title: '原料仓',
      items: [
        { key: 'wls-raw-dashboard', title: '原料仓首页', icon: 'LayoutDashboard', href: '/wls/raw/dashboard' },
        { key: 'wls-raw-arrival-list', title: '原料到货列表', icon: 'Truck', href: '/wls/raw/arrival-list' },
        { key: 'wls-raw-inbound-list', title: '入库单列表', icon: 'ArrowDownToLine', href: '/wls/raw/inbound-list' },
        { key: 'wls-raw-requisition-list', title: '领料单列表', icon: 'FileText', href: '/wls/raw/requisition-list' },
        { key: 'wls-raw-issue-list', title: '配料单列表', icon: 'ListOrdered', href: '/wls/raw/issue-list' },
        { key: 'wls-raw-outbound-list', title: '出库单列表', icon: 'ArrowUpFromLine', href: '/wls/raw/outbound-list' },
        { key: 'wls-raw-stock-realtime', title: '原料即时库存', icon: 'Archive', href: '/wls/raw/stock/realtime' },
        { key: 'wls-raw-stock-location', title: '原料仓位库存', icon: 'MapPin', href: '/wls/raw/stock/location' },
        { key: 'wls-raw-stock-flow', title: '原料库存流水', icon: 'ArrowLeftRight', href: '/wls/raw/stock/flow' },
        { key: 'wls-raw-stock-fabric-count', title: '面料盘点', icon: 'ClipboardCheck', href: '/wls/raw/stock/fabric-inventory-count' },
        { key: 'wls-raw-stock-accessory-count', title: '辅料盘点', icon: 'ClipboardCheck', href: '/wls/raw/stock/accessory-inventory-count' },
        { key: 'wls-raw-stock-fabric-transfer', title: '面料调拨', icon: 'ArrowRightLeft', href: '/wls/raw/stock/fabric-transfer' },
        { key: 'wls-raw-stock-accessory-transfer', title: '辅料调拨', icon: 'ArrowRightLeft', href: '/wls/raw/stock/accessory-transfer' },
        { key: 'wls-raw-fabric-score', title: '面料评分', icon: 'Star', href: '/wls/raw/fabric-score' },
      ],
    },
    {
      title: '基础数据',
      items: [
        { key: 'wls-basic-warehouse', title: '仓库管理', icon: 'Warehouse', href: '/wls/basic/warehouse' },
        { key: 'wls-basic-subject', title: '主体管理', icon: 'Users', href: '/wls/basic/subject' },
        { key: 'wls-basic-zone-location', title: '库区库位管理', icon: 'MapPin', href: '/wls/basic/zone-location' },
        { key: 'wls-basic-barcode-rule', title: '条码规则管理', icon: 'Barcode', href: '/wls/basic/barcode-rule' },
        { key: 'wls-basic-label-config', title: '标签配置', icon: 'Tags', href: '/wls/basic/label-config' },
        { key: 'wls-basic-product-center', title: '商品 / 物料中心', icon: 'ShoppingCart', href: '/wls/basic/product-center' },
        { key: 'wls-basic-supplier', title: '供应商管理', icon: 'Truck', href: '/wls/basic/supplier' },
        { key: 'wls-basic-processor', title: '加工方管理', icon: 'Factory', href: '/wls/basic/processor' },
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
    { title: '供应链域', items: [{ key: 'material-decision', title: '物料监控与决策', icon: 'Boxes', children: [
      { key: 'material-overview', title: '决策总览', icon: 'BarChart3', href: '/dds/supply-chain/materials/overview' },
      { key: 'material-panorama', title: '物料全景', icon: 'BarChart3', href: '/dds/supply-chain/materials/panorama' },
      { key: 'material-planning', title: '供需计划', icon: 'BarChart3', href: '/dds/supply-chain/materials/planning' },
      { key: 'material-consumption', title: '消耗与经营分析', icon: 'BarChart3', href: '/dds/supply-chain/materials/consumption' },
      { key: 'material-risks', title: '风险与决策', icon: 'BarChart3', href: '/dds/supply-chain/materials/risks' },
      { key: 'material-quality', title: '数据质量', icon: 'BarChart3', href: '/dds/supply-chain/materials/quality' },
      { key: 'material-configuration', title: '规则与配置', icon: 'BarChart3', href: '/dds/supply-chain/materials/configuration' },
    ] }, { key: 'production-fulfillment', title: '生产与履约时效', icon: 'Timer', children: [
      { key: 'production-fulfillment-overview', title: '时效总览', icon: 'BarChart3', href: '/dds/supply-chain/production-fulfillment/overview' },
      { key: 'production-fulfillment-tasks', title: '生产任务', icon: 'ListChecks', href: '/dds/supply-chain/production-fulfillment/tasks' },
      { key: 'production-fulfillment-follow-up', title: '我的跟单', icon: 'UserRound', href: '/dds/supply-chain/production-fulfillment/follow-up' },
      { key: 'production-fulfillment-work-items', title: '工作项监控', icon: 'Activity', href: '/dds/supply-chain/production-fulfillment/work-items' },
      { key: 'production-fulfillment-teams', title: '团队与工厂', icon: 'Factory', href: '/dds/supply-chain/production-fulfillment/teams' },
      { key: 'production-fulfillment-fulfillment', title: '订单履约分析', icon: 'Truck', href: '/dds/supply-chain/production-fulfillment/fulfillment' },
      { key: 'production-fulfillment-configuration', title: '规则与配置', icon: 'Settings', href: '/dds/supply-chain/production-fulfillment/configuration' },
    ] }] },
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
