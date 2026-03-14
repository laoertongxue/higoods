/**
 * AppShell 配置层：仅承载系统导航、菜单、标签页等壳层配置数据。
 * FCS 业务数据与业务类型统一来自 src/data/fcs/*。
 */

import type { System, MenuGroup } from './app-shell-types'

// 系统列表
export const systems: System[] = [
  { id: 'pcs', name: '商品中心系统', shortName: 'PCS', defaultPage: '/pcs/workspace/overview' },
  { id: 'pms', name: '采购管理系统', shortName: 'PMS', defaultPage: '/pms/purchase-order' },
  { id: 'fcs', name: '工厂生产协同系统', shortName: 'FCS', defaultPage: '/fcs/workbench/overview' },
  { id: 'wls', name: '仓储物流系统', shortName: 'WLS', defaultPage: '/wls/inventory' },
  { id: 'los', name: '直播运营系统', shortName: 'LOS', defaultPage: '/los/live-schedule' },
  { id: 'oms', name: '订单管理系统', shortName: 'OMS', defaultPage: '/oms/order-list' },
  { id: 'bfis', name: '业财一体化系统', shortName: 'BFIS', defaultPage: '/bfis/financial-report' },
  { id: 'dds', name: '数据决策系统', shortName: 'DDS', defaultPage: '/dds/dashboard' },
]

// 各系统菜单
export const menusBySystem: Record<string, MenuGroup[]> = {
  pcs: [
    {
      title: '工作台',
      items: [
        { key: 'pcs-workspace-overview', title: '概览看板', icon: 'LayoutDashboard', href: '/pcs/workspace/overview' },
        { key: 'pcs-workspace-todos', title: '我的待办', icon: 'CheckSquare', href: '/pcs/workspace/todos' },
        { key: 'pcs-workspace-alerts', title: '风险提醒', icon: 'AlertTriangle', href: '/pcs/workspace/alerts' },
      ],
    },
    {
      title: '商品项目管理',
      items: [
        { key: 'pcs-project-list', title: '商品项目列表', icon: 'FolderKanban', href: '/pcs/projects' },
        { key: 'pcs-template', title: '项目模板管理', icon: 'FileText', href: '/pcs/templates' },
        { key: 'pcs-work-items', title: '工作项库', icon: 'CheckSquare', href: '/pcs/work-items' },
      ],
    },
    {
      title: '测款与渠道管理',
      items: [
        { key: 'pcs-live-testing', title: '直播场次', icon: 'TestTube', href: '/pcs/testing/live' },
        { key: 'pcs-video-testing', title: '短视频记录', icon: 'TestTube', href: '/pcs/testing/video' },
        { key: 'pcs-channel-products', title: '渠道商品管理', icon: 'ShoppingCart', href: '/pcs/channels/products' },
        { key: 'pcs-channel-stores', title: '渠道店铺管理', icon: 'Store', href: '/pcs/channels/stores' },
      ],
    },
    {
      title: '样衣资产管理',
      items: [
        { key: 'pcs-sample-ledger', title: '样衣台账', icon: 'Shirt', href: '/pcs/samples/ledger' },
        { key: 'pcs-sample-inventory', title: '样衣库存', icon: 'Package', href: '/pcs/samples/inventory' },
        { key: 'pcs-sample-transfer', title: '样衣流转记录', icon: 'Layers', href: '/pcs/samples/transfer' },
        { key: 'pcs-sample-return', title: '样衣退货与处理', icon: 'AlertTriangle', href: '/pcs/samples/return' },
        { key: 'pcs-sample-application', title: '样衣使用申请', icon: 'CheckSquare', href: '/pcs/samples/application' },
        { key: 'pcs-sample-view', title: '样衣视图', icon: 'Palette', href: '/pcs/samples/view' },
      ],
    },
    {
      title: '制版与生产准备',
      items: [
        { key: 'pcs-revision-tasks', title: '改版任务', icon: 'FileText', href: '/pcs/patterns/revision' },
        { key: 'pcs-pattern-tasks', title: '制版任务', icon: 'Scissors', href: '/pcs/patterns' },
        { key: 'pcs-color-tasks', title: '花型任务', icon: 'Palette', href: '/pcs/patterns/colors' },
        { key: 'pcs-first-sample', title: '首单样衣打样', icon: 'Droplet', href: '/pcs/samples/first-order' },
        { key: 'pcs-pre-production', title: '产前版样衣', icon: 'CheckSquare', href: '/pcs/production/pre-check' },
      ],
    },
    {
      title: '商品档案',
      items: [
        { key: 'pcs-spu-list', title: '商品档案 - SPU', icon: 'Archive', href: '/pcs/products/spu' },
        { key: 'pcs-sku-list', title: '商品档案 - SKU', icon: 'Package', href: '/pcs/products/sku' },
        { key: 'pcs-yarn-list', title: '原料档案 - 纱线', icon: 'Layers', href: '/pcs/products/yarn' },
      ],
    },
    {
      title: '系统设置',
      items: [
        { key: 'pcs-config-workspace', title: '配置工作台', icon: 'Settings', href: '/pcs/settings/config-workspace' },
        { key: 'pcs-template-center', title: '模板中心', icon: 'FileText', href: '/pcs/settings/template-center' },
        { key: 'pcs-platform-config', title: '平台对接配置', icon: 'Settings', href: '/pcs/settings/platforms' },
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
      title: '工作台',
      items: [
        { key: 'workbench-overview', title: '概览看板', icon: 'LayoutDashboard', href: '/fcs/workbench/overview' },
        { key: 'workbench-todos', title: '我的待办', icon: 'ListTodo', href: '/fcs/workbench/todos' },
        { key: 'workbench-risks', title: '风险提醒', icon: 'AlertTriangle', href: '/fcs/workbench/risks' },
      ],
    },
    {
      title: '工厂池管理',
      items: [
        { key: 'factories-profile', title: '工厂档案', icon: 'Factory', href: '/fcs/factories/profile' },
        { key: 'factories-capability', title: '能力标签', icon: 'Tags', href: '/fcs/factories/capability' },
        { key: 'factories-settlement', title: '结算信息', icon: 'Receipt', href: '/fcs/factories/settlement' },
        { key: 'factories-status', title: '工厂状态', icon: 'ToggleLeft', href: '/fcs/factories/status' },
        { key: 'factories-performance', title: '工厂绩效', icon: 'BarChart3', href: '/fcs/factories/performance' },
      ],
    },
    {
      title: '生产单管理',
      items: [
        { key: 'production-demand-inbox', title: '生产需求接收', icon: 'Inbox', href: '/fcs/production/demand-inbox' },
        { key: 'production-orders', title: '生产单（台账）', icon: 'FilePlus2', href: '/fcs/production/orders' },
        { key: 'production-plan', title: '生产单计划', icon: 'CalendarClock', href: '/fcs/production/plan' },
        { key: 'production-delivery-warehouse', title: '交付仓配置', icon: 'Warehouse', href: '/fcs/production/delivery-warehouse' },
        { key: 'production-changes', title: '变更管理', icon: 'GitPullRequest', href: '/fcs/production/changes' },
        { key: 'production-status', title: '状态管理', icon: 'Workflow', href: '/fcs/production/status' },
        { key: 'production-craft-dict', title: '工序工艺字典', icon: 'BookOpen', href: '/fcs/production/craft-dict' },
      ],
    },
    // FCS 菜单基线：任务编排与执行准备模块，当前冻结，非必要不调整。
    {
      title: '任务编排与执行准备',
      items: [
        { key: 'process-task-breakdown', title: '任务清单', icon: 'Split', href: '/fcs/process/task-breakdown' },
        { key: 'process-dye-requirements', title: '染色需求单', icon: 'ClipboardList', href: '/fcs/process/dye-requirements' },
        { key: 'process-print-requirements', title: '印花需求单', icon: 'FileText', href: '/fcs/process/print-requirements' },
        { key: 'process-dye-orders', title: '染色加工单', icon: 'Package', href: '/fcs/process/dye-orders' },
        { key: 'process-print-orders', title: '印花加工单', icon: 'ClipboardSignature', href: '/fcs/process/print-orders' },
        { key: 'process-dependencies', title: '任务依赖配置', icon: 'Network', href: '/fcs/process/dependencies' },
        { key: 'process-qc-standards', title: '质检标准下发', icon: 'CheckSquare', href: '/fcs/process/qc-standards' },
      ],
    },
    // FCS 菜单基线更新：因"任务分配方式"与"任务分配看板"业务边界高度重叠，已收口为统一入口"任务分配"；当前菜单继续冻结，非必要不再调整。
    {
      title: '任务分配',
      items: [
        { key: 'dispatch-board', title: '任务分配', icon: 'LayoutGrid', href: '/fcs/dispatch/board' },
        { key: 'dispatch-tenders', title: '招标单管理', icon: 'Gavel', href: '/fcs/dispatch/tenders' },
        { key: 'dispatch-exceptions', title: '异常处理', icon: 'Siren', href: '/fcs/dispatch/exceptions' },
      ],
    },
    {
      title: '任务进度与异常',
      items: [
        { key: 'progress-board', title: '任务进度看板', icon: 'KanbanSquare', href: '/fcs/progress/board' },
        { key: 'progress-exceptions', title: '异常定位', icon: 'Search', href: '/fcs/progress/exceptions' },
        { key: 'progress-urge', title: '催办与通知', icon: 'BellRing', href: '/fcs/progress/urge' },
        { key: 'progress-handover', title: '交接链路追踪', icon: 'ScanLine', href: '/fcs/progress/handover' },
        { key: 'progress-material', title: '领料进度跟踪', icon: 'PackageSearch', href: '/fcs/progress/material' },
        { key: 'progress-status-writeback', title: '状态回写', icon: 'RefreshCw', href: '/fcs/progress/status-writeback' },
      ],
    },
    {
      title: '质量与扣款',
      items: [
        { key: 'quality-inspection', title: '质检记录', icon: 'ClipboardCheck', href: '/fcs/quality/qc-records' },
        { key: 'quality-rework', title: '返工/重做', icon: 'Repeat2', href: '/fcs/quality/rework' },
        { key: 'quality-penalty', title: '扣款计算', icon: 'Calculator', href: '/fcs/quality/deduction-calc' },
        { key: 'quality-arbitration', title: '争议仲裁', icon: 'Scale', href: '/fcs/quality/arbitration' },
        { key: 'quality-penalty-output', title: '扣款结果输出', icon: 'FileDown', href: '/fcs/quality/penalty-output' },
      ],
    },
    {
      title: '对账与结算',
      items: [
        { key: 'settlement-statements', title: '对账单生成', icon: 'FileText', href: '/fcs/settlement/statements' },
        { key: 'settlement-adjustments', title: '扣款/补差管理', icon: 'SlidersHorizontal', href: '/fcs/settlement/adjustments' },
        { key: 'settlement-batches', title: '结算批次进度', icon: 'Layers', href: '/fcs/settlement/batches' },
        { key: 'settlement-material-statements', title: '领料对账单生成', icon: 'ClipboardSignature', href: '/fcs/settlement/material-statements' },
        { key: 'settlement-payment-sync', title: '打款结果回写', icon: 'ArrowLeftRight', href: '/fcs/settlement/payment-sync' },
        { key: 'settlement-history', title: '历史对账与核算', icon: 'History', href: '/fcs/settlement/history' },
      ],
    },
    {
      title: '成衣溯源管理',
      items: [
        { key: 'trace-parent-codes', title: '扎包/周转包父码管理', icon: 'Boxes', href: '/fcs/trace/parent-codes' },
        { key: 'trace-unique-codes', title: '唯一码管理', icon: 'Fingerprint', href: '/fcs/trace/unique-codes' },
        { key: 'trace-mapping', title: '父子码映射', icon: 'Merge', href: '/fcs/trace/mapping' },
        { key: 'trace-unit-price', title: '单价追溯查询', icon: 'SearchCheck', href: '/fcs/trace/unit-price' },
      ],
    },
    {
      title: '产能日历',
      items: [
        { key: 'capacity-overview', title: '产能汇总看板', icon: 'LineChart', href: '/fcs/capacity/overview' },
        { key: 'capacity-risk', title: '任务占用与交付风险', icon: 'TrendingUp', href: '/fcs/capacity/risk' },
        { key: 'capacity-bottleneck', title: '瓶颈预警', icon: 'AlertOctagon', href: '/fcs/capacity/bottleneck' },
        { key: 'capacity-constraints', title: '派单/竞价约束', icon: 'Filter', href: '/fcs/capacity/constraints' },
        { key: 'capacity-policies', title: '调度策略（限额/优先级）', icon: 'Settings2', href: '/fcs/capacity/policies' },
      ],
    },
    {
      title: '工厂端（PDA）',
      items: [
        { key: 'pda-todo', title: '待办', icon: 'Bell', href: '/fcs/pda/notify' },
        { key: 'pda-task-receive', title: '接单', icon: 'ClipboardList', href: '/fcs/pda/task-receive' },
        { key: 'pda-exec', title: '执行', icon: 'Play', href: '/fcs/pda/exec' },
        { key: 'pda-handover', title: '交接', icon: 'ArrowLeftRight', href: '/fcs/pda/handover' },
        { key: 'pda-settlement', title: '结算', icon: 'Wallet', href: '/fcs/pda/settlement' },
      ],
    },
  ],
  wls: [
    {
      title: '仓储管理',
      items: [
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
