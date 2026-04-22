/**
 * AppShell 配置层：仅承载系统导航、菜单、标签页等壳层配置数据。
 * FCS 业务数据与业务类型统一来自 src/data/fcs/*。
 */

import type { System, MenuGroup } from './app-shell-types.ts'

// 系统列表
export const systems: System[] = [
  { id: 'pcs', name: '商品中心系统', shortName: 'PCS', defaultPage: '/pcs/workspace/overview' },
  { id: 'pms', name: '采购管理系统', shortName: 'PMS', defaultPage: '/pms/purchase-order' },
  { id: 'fcs', name: '工厂生产协同系统', shortName: 'FCS', defaultPage: '/fcs/workbench/overview' },
  { id: 'pfos', name: '工艺工厂运营系统', shortName: 'PFOS', defaultPage: '/fcs/craft/workbench/overview' },
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
            { key: 'pcs-pre-production', title: '产前版样衣', icon: 'CheckSquare', href: '/pcs/samples/pre-production' },
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
            { key: 'factories-profile', title: '工厂档案', icon: 'Factory', href: '/fcs/factories/profile' },
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
            { key: 'production-demand-inbox', title: '生产需求接收', icon: 'Inbox', href: '/fcs/production/demand-inbox' },
            { key: 'production-orders', title: '生产单管理', icon: 'FilePlus2', href: '/fcs/production/orders' },
            { key: 'production-plan', title: '生产单计划', icon: 'CalendarClock', href: '/fcs/production/plan' },
            { key: 'production-delivery-warehouse', title: '交付仓配置', icon: 'Warehouse', href: '/fcs/production/delivery-warehouse' },
            { key: 'production-changes', title: '变更管理', icon: 'GitPullRequest', href: '/fcs/production/changes' },
            { key: 'production-status', title: '状态管理', icon: 'Workflow', href: '/fcs/production/status' },
            { key: 'production-craft-dict', title: '工序工艺字典', icon: 'BookOpen', href: '/fcs/production/craft-dict' },
          ],
        },
        {
          key: 'fcs-platform-process',
          title: '任务编排与执行准备',
          icon: 'Split',
          children: [
            { key: 'process-task-breakdown', title: '任务清单', icon: 'Split', href: '/fcs/process/task-breakdown' },
            { key: 'process-dye-requirements', title: '染色需求单', icon: 'ClipboardList', href: '/fcs/process/dye-requirements' },
            { key: 'process-print-requirements', title: '印花需求单', icon: 'FileText', href: '/fcs/process/print-requirements' },
            { key: 'process-dye-orders', title: '染色加工单', icon: 'Package', href: '/fcs/process/dye-orders' },
            { key: 'process-print-orders', title: '印花加工单', icon: 'ClipboardSignature', href: '/fcs/process/print-orders' },
          ],
        },
        {
          key: 'fcs-platform-dispatch',
          title: '任务分配',
          icon: 'LayoutGrid',
          children: [
            { key: 'dispatch-board', title: '任务分配', icon: 'LayoutGrid', href: '/fcs/dispatch/board' },
            { key: 'dispatch-tenders', title: '招标单管理', icon: 'Gavel', href: '/fcs/dispatch/tenders' },
          ],
        },
        {
          key: 'fcs-platform-progress',
          title: '任务进度与异常',
          icon: 'KanbanSquare',
          children: [
            { key: 'progress-board', title: '任务进度看板', icon: 'KanbanSquare', href: '/fcs/progress/board' },
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
            { key: 'quality-deduction-analysis', title: '扣款分析', icon: 'BarChart3', href: '/fcs/quality/deduction-analysis' },
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
            { key: 'capacity-risk', title: '任务工时风险', icon: 'TrendingUp', href: '/fcs/capacity/risk' },
            { key: 'capacity-bottleneck', title: '工艺瓶颈与待分配', icon: 'AlertOctagon', href: '/fcs/capacity/bottleneck' },
            { key: 'capacity-policies', title: '暂停例外', icon: 'Settings2', href: '/fcs/capacity/policies' },
          ],
        },
      ],
    } as MenuGroup & { icon: string },
    {
      title: '工厂端移动应用',
      icon: 'Smartphone',
      items: [
        { key: 'pda-todo', title: '待办', icon: 'Bell', href: '/fcs/pda/notify' },
        { key: 'pda-task-receive', title: '接单', icon: 'ClipboardList', href: '/fcs/pda/task-receive' },
        { key: 'pda-exec', title: '执行', icon: 'Play', href: '/fcs/pda/exec' },
        { key: 'pda-handover', title: '交接', icon: 'ArrowLeftRight', href: '/fcs/pda/handover' },
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
            { key: 'pfos-cutting-production-progress', title: '生产单进度', icon: 'ListTodo', href: '/fcs/craft/cutting/production-progress' },
            { key: 'pfos-cutting-cuttable-pool', title: '可裁排产', icon: 'CalendarClock', href: '/fcs/craft/cutting/cuttable-pool' },
            { key: 'pfos-cutting-merge-batches', title: '合并裁剪批次', icon: 'Layers', href: '/fcs/craft/cutting/merge-batches' },
          ],
        },
        {
          key: 'pfos-cutting-prep',
          title: '裁前准备',
          icon: 'PackageSearch',
          children: [
            { key: 'pfos-cutting-original-orders', title: '原始裁片单', icon: 'ClipboardList', href: '/fcs/craft/cutting/original-orders' },
            { key: 'pfos-cutting-material-prep', title: '仓库配料领料', icon: 'PackageSearch', href: '/fcs/craft/cutting/material-prep' },
            { key: 'pfos-cutting-marker-list', title: '唛架列表', icon: 'Ruler', href: '/fcs/craft/cutting/marker-list' },
          ],
        },
        {
          key: 'pfos-cutting-execution',
          title: '铺布执行',
          icon: 'Rows3',
          children: [
            { key: 'pfos-cutting-spreading-list', title: '铺布列表', icon: 'Rows3', href: '/fcs/craft/cutting/spreading-list' },
          ],
        },
        {
          key: 'pfos-cutting-post',
          title: '裁后处理',
          icon: 'PackageCheck',
          children: [
            { key: 'pfos-cutting-replenishment', title: '补料管理', icon: 'ShieldAlert', href: '/fcs/craft/cutting/replenishment' },
            { key: 'pfos-cutting-fei-tickets', title: '打印菲票', icon: 'Ticket', href: '/fcs/craft/cutting/fei-tickets' },
            { key: 'pfos-cutting-transfer-bags', title: '中转袋流转', icon: 'PackageCheck', href: '/fcs/craft/cutting/transfer-bags' },
            { key: 'pfos-cutting-cut-piece-warehouse', title: '裁片仓', icon: 'Archive', href: '/fcs/craft/cutting/cut-piece-warehouse' },
            { key: 'pfos-cutting-special-processes', title: '特殊工艺', icon: 'Sparkles', href: '/fcs/craft/cutting/special-processes' },
            { key: 'pfos-cutting-summary', title: '裁剪总结', icon: 'ClipboardPen', href: '/fcs/craft/cutting/summary' },
          ],
        },
        {
          key: 'pfos-cutting-handover',
          title: '裁片仓交接',
          icon: 'Warehouse',
          children: [
            { key: 'pfos-cutting-fabric-warehouse', title: '裁床仓', icon: 'Warehouse', href: '/fcs/craft/cutting/fabric-warehouse' },
            { key: 'pfos-cutting-sample-warehouse', title: '样衣仓', icon: 'Shirt', href: '/fcs/craft/cutting/sample-warehouse' },
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
            { key: 'pfos-printing-pending-review', title: '印花审核', icon: 'ClipboardCheck', href: '/fcs/craft/printing/pending-review' },
            { key: 'pfos-printing-progress', title: '印花进度', icon: 'KanbanSquare', href: '/fcs/craft/printing/progress' },
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
            { key: 'pfos-dyeing-dye-orders', title: '染料单', icon: 'Package', href: '/fcs/craft/dyeing/dye-orders' },
            { key: 'pfos-dyeing-reports', title: '染色报表', icon: 'BarChart3', href: '/fcs/craft/dyeing/reports' },
          ],
        },
      ],
    } as MenuGroup & { icon: string },
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
