import {
  buildSpecialCraftDomainWaitHandoverWarehousePath,
  buildSpecialCraftDomainWaitProcessWarehousePath,
  buildSpecialCraftOperationSlug,
  buildSpecialCraftTaskOrdersPath,
  listEnabledAuxiliaryCraftOperationDefinitions,
  listEnabledSpecialTypeCraftOperationDefinitions,
  listVisibleSpecialCraftOperationsForFactory
} from "./fcs/special-craft-operations.ts";
const specialCraftMenuDomainConfig = {
  AUXILIARY_CRAFT_FACTORY: {
    title: "\u8F85\u52A9\u5DE5\u827A\u5DE5\u5382\u7BA1\u7406",
    icon: "Sparkles",
    waitProcessTitle: "\u8F85\u52A9\u5DE5\u827A\u5F85\u52A0\u5DE5\u4ED3",
    waitHandoverTitle: "\u8F85\u52A9\u5DE5\u827A\u5F85\u4EA4\u51FA\u4ED3"
  },
  SPECIAL_CRAFT_FACTORY: {
    title: "\u7279\u79CD\u5DE5\u827A\u5DE5\u5382\u7BA1\u7406",
    icon: "Sparkles",
    waitProcessTitle: "\u7279\u79CD\u5DE5\u827A\u5F85\u52A0\u5DE5\u4ED3",
    waitHandoverTitle: "\u7279\u79CD\u5DE5\u827A\u5F85\u4EA4\u51FA\u4ED3"
  }
};
function listSpecialCraftMenuOperationsByDomain(domain, factoryId) {
  if (factoryId) {
    return listVisibleSpecialCraftOperationsForFactory(factoryId).filter((operation) => operation.managementDomain === domain);
  }
  if (domain === "AUXILIARY_CRAFT_FACTORY") return listEnabledAuxiliaryCraftOperationDefinitions();
  return listEnabledSpecialTypeCraftOperationDefinitions();
}
function buildSpecialCraftMenuItems(domain, factoryId) {
  const operations = listSpecialCraftMenuOperationsByDomain(domain, factoryId);
  return operations.map((operation) => {
    const operationSlug = buildSpecialCraftOperationSlug(operation);
    return {
      key: `pfos-special-${operationSlug}-tasks`,
      title: `${operation.operationName}\u52A0\u5DE5\u5355`,
      icon: "Sparkles",
      href: buildSpecialCraftTaskOrdersPath(operation)
    };
  });
}
function buildSpecialCraftMenuGroup(domain, operations) {
  const config = specialCraftMenuDomainConfig[domain];
  const operationItems = operations ? operations.map((operation) => {
    const operationSlug = buildSpecialCraftOperationSlug(operation);
    return {
      key: `pfos-special-${operationSlug}-tasks`,
      title: `${operation.operationName}\u52A0\u5DE5\u5355`,
      icon: "Sparkles",
      href: buildSpecialCraftTaskOrdersPath(operation)
    };
  }) : buildSpecialCraftMenuItems(domain);
  const items = [
    ...operationItems,
    {
      key: `pfos-special-${domain}-wait-process-warehouse`,
      title: config.waitProcessTitle,
      icon: "Warehouse",
      href: buildSpecialCraftDomainWaitProcessWarehousePath(domain)
    },
    {
      key: `pfos-special-${domain}-wait-handover-warehouse`,
      title: config.waitHandoverTitle,
      icon: "PackageCheck",
      href: buildSpecialCraftDomainWaitHandoverWarehousePath(domain)
    }
  ];
  return {
    title: config.title,
    icon: config.icon,
    items
  };
}
function buildSpecialCraftMenuGroups() {
  return [
    buildSpecialCraftMenuGroup("AUXILIARY_CRAFT_FACTORY"),
    buildSpecialCraftMenuGroup("SPECIAL_CRAFT_FACTORY")
  ].filter((group) => group.items.length > 0);
}
function buildSpecialCraftMenuGroupsForFactory(factoryId) {
  return Object.keys(specialCraftMenuDomainConfig).map((domain) => buildSpecialCraftMenuGroup(domain, listSpecialCraftMenuOperationsByDomain(domain, factoryId))).filter((group) => group.items.length > 0);
}
const specialCraftMenuGroups = buildSpecialCraftMenuGroups();
const systems = [
  { id: "pcs", name: "\u5546\u54C1\u4E2D\u5FC3\u7CFB\u7EDF", shortName: "PCS", defaultPage: "/pcs/workspace/overview" },
  { id: "pms", name: "\u91C7\u8D2D\u7BA1\u7406\u7CFB\u7EDF", shortName: "PMS", defaultPage: "/pms/purchase-order" },
  { id: "fcs", name: "\u5DE5\u5382\u751F\u4EA7\u534F\u540C\u7CFB\u7EDF", shortName: "FCS", defaultPage: "/fcs/workbench/overview" },
  { id: "pfos", name: "\u5DE5\u827A\u5DE5\u5382\u8FD0\u8425\u7CFB\u7EDF", shortName: "PFOS", defaultPage: "/fcs/craft/workbench/overview" },
  { id: "wls", name: "\u4ED3\u50A8\u7269\u6D41\u7CFB\u7EDF", shortName: "WLS", defaultPage: "/wls/inventory" },
  { id: "los", name: "\u76F4\u64AD\u8FD0\u8425\u7CFB\u7EDF", shortName: "LOS", defaultPage: "/los/live-schedule" },
  { id: "oms", name: "\u8BA2\u5355\u7BA1\u7406\u7CFB\u7EDF", shortName: "OMS", defaultPage: "/oms/order-list" },
  { id: "bfis", name: "\u4E1A\u8D22\u4E00\u4F53\u5316\u7CFB\u7EDF", shortName: "BFIS", defaultPage: "/bfis/financial-report" },
  { id: "dds", name: "\u6570\u636E\u51B3\u7B56\u7CFB\u7EDF", shortName: "DDS", defaultPage: "/dds/dashboard" }
];
const menusBySystem = {
  pcs: [
    {
      title: "\u5546\u54C1\u4E2D\u5FC3\u7CFB\u7EDF",
      items: [
        {
          key: "pcs-menu-workspace",
          title: "\u5DE5\u4F5C\u53F0",
          icon: "LayoutDashboard",
          children: [
            { key: "pcs-workspace-overview", title: "\u6982\u89C8\u770B\u677F", icon: "LayoutDashboard", href: "/pcs/workspace/overview" },
            { key: "pcs-workspace-todos", title: "\u6211\u7684\u5F85\u529E", icon: "CheckSquare", href: "/pcs/workspace/todos" },
            { key: "pcs-workspace-alerts", title: "\u98CE\u9669\u63D0\u9192", icon: "AlertTriangle", href: "/pcs/workspace/alerts" }
          ]
        },
        {
          key: "pcs-menu-projects",
          title: "\u5546\u54C1\u9879\u76EE\u7BA1\u7406",
          icon: "FolderKanban",
          children: [
            { key: "pcs-project-list", title: "\u5546\u54C1\u9879\u76EE", icon: "FolderKanban", href: "/pcs/projects" },
            { key: "pcs-template", title: "\u9879\u76EE\u6A21\u677F\u7BA1\u7406", icon: "FileText", href: "/pcs/templates" },
            { key: "pcs-work-items", title: "\u5DE5\u4F5C\u9879\u5E93", icon: "CheckSquare", href: "/pcs/work-items" }
          ]
        },
        {
          key: "pcs-menu-testing",
          title: "\u6D4B\u6B3E\u4E0E\u6E20\u9053\u7BA1\u7406",
          icon: "TestTube",
          children: [
            { key: "pcs-live-testing", title: "\u76F4\u64AD\u6D4B\u6B3E", icon: "TestTube", href: "/pcs/testing/live" },
            { key: "pcs-video-testing", title: "\u77ED\u89C6\u9891\u6D4B\u6B3E", icon: "TestTube", href: "/pcs/testing/video" },
            { key: "pcs-channel-stores", title: "\u6E20\u9053\u5E97\u94FA\u7BA1\u7406", icon: "Store", href: "/pcs/channels/stores" }
          ]
        },
        {
          key: "pcs-menu-pattern",
          title: "\u5DE5\u7A0B\u5F00\u53D1\u4E0E\u6253\u6837\u7BA1\u7406",
          icon: "Scissors",
          children: [
            { key: "pcs-revision-tasks", title: "\u6539\u7248\u4EFB\u52A1", icon: "FileText", href: "/pcs/patterns/revision" },
            { key: "pcs-pattern-tasks", title: "\u5236\u7248\u4EFB\u52A1", icon: "Scissors", href: "/pcs/patterns" },
            { key: "pcs-part-template-library", title: "\u90E8\u4F4D\u6A21\u677F\u5E93", icon: "Library", href: "/pcs/patterns/part-templates" },
            { key: "pcs-color-tasks", title: "\u82B1\u578B\u4EFB\u52A1", icon: "Palette", href: "/pcs/patterns/colors" },
            { key: "pcs-pattern-library", title: "\u82B1\u578B\u5E93", icon: "Image", href: "/pcs/pattern-library" },
            { key: "pcs-first-sample", title: "\u9996\u7248\u6837\u8863\u6253\u6837", icon: "Droplet", href: "/pcs/samples/first-sample" },
            { key: "pcs-first-order", title: "\u9996\u5355\u6837\u8863\u6253\u6837", icon: "CheckSquare", href: "/pcs/samples/first-order" }
          ]
        },
        {
          key: "pcs-menu-products",
          title: "\u5546\u54C1\u6863\u6848",
          icon: "Archive",
          children: [
            { key: "pcs-style-list", title: "\u6B3E\u5F0F\u6863\u6848", icon: "Archive", href: "/pcs/products/styles" },
            { key: "pcs-spec-list", title: "\u89C4\u683C\u6863\u6848", icon: "Package", href: "/pcs/products/specifications" },
            { key: "pcs-channel-products", title: "\u6E20\u9053\u5E97\u94FA\u5546\u54C1", icon: "ShoppingCart", href: "/pcs/products/channel-products" }
          ]
        },
        {
          key: "pcs-menu-materials",
          title: "\u7269\u6599\u6863\u6848",
          icon: "Layers",
          children: [
            { key: "pcs-fabric-list", title: "\u9762\u6599\u6863\u6848", icon: "Layers", href: "/pcs/materials/fabric" },
            { key: "pcs-accessory-list", title: "\u8F85\u6599\u6863\u6848", icon: "Paperclip", href: "/pcs/materials/accessory" },
            { key: "pcs-yarn-list", title: "\u7EB1\u7EBF\u6863\u6848", icon: "CircleDot", href: "/pcs/materials/yarn" },
            { key: "pcs-consumable-list", title: "\u8017\u6750\u6863\u6848", icon: "Package", href: "/pcs/materials/consumable" }
          ]
        },
        {
          key: "pcs-menu-settings",
          title: "\u7CFB\u7EDF\u8BBE\u7F6E",
          icon: "Settings",
          children: [
            { key: "pcs-config-workspace", title: "\u57FA\u7840\u914D\u7F6E", icon: "Settings", href: "/pcs/settings/config-workspace" }
          ]
        }
      ]
    }
  ],
  pms: [
    {
      title: "\u91C7\u8D2D\u7BA1\u7406",
      items: [
        { key: "purchase-order", title: "\u91C7\u8D2D\u8BA2\u5355", icon: "FileText", href: "/pms/purchase-order" },
        { key: "supplier", title: "\u4F9B\u5E94\u5546\u7BA1\u7406", icon: "Building2", href: "/pms/supplier" },
        { key: "contract", title: "\u5408\u540C\u7BA1\u7406", icon: "FileSignature", href: "/pms/contract" }
      ]
    }
  ],
  fcs: [
    {
      title: "\u5E73\u53F0\u8FD0\u8425\u7CFB\u7EDF",
      icon: "PanelsTopLeft",
      items: [
        {
          key: "fcs-platform-workbench",
          title: "\u5DE5\u4F5C\u53F0",
          icon: "LayoutDashboard",
          children: [
            { key: "workbench-overview", title: "\u6982\u89C8\u770B\u677F", icon: "LayoutDashboard", href: "/fcs/workbench/overview" },
            { key: "workbench-todos", title: "\u6211\u7684\u5F85\u529E", icon: "ListTodo", href: "/fcs/workbench/todos" }
          ]
        },
        {
          key: "fcs-platform-factories",
          title: "\u5DE5\u5382\u6C60\u7BA1\u7406",
          icon: "Factory",
          children: [
            { key: "factories-onboarding", title: "\u5DE5\u5382\u5165\u9A7B\u7BA1\u7406", icon: "ClipboardCheck", href: "/fcs/factories/onboarding" },
            { key: "factories-profile", title: "\u5DE5\u5382\u6863\u6848", icon: "Factory", href: "/fcs/factories/profile" },
            { key: "factories-warehouse", title: "\u5DE5\u5382\u4ED3\u5E93", icon: "Warehouse", href: "/fcs/factory/warehouse" },
            { key: "factories-capacity-profile", title: "\u5DE5\u5382\u4EA7\u80FD\u6863\u6848", icon: "Gauge", href: "/fcs/factories/capacity-profile" },
            { key: "factories-capability", title: "\u80FD\u529B\u6807\u7B7E", icon: "Tags", href: "/fcs/factories/capability" },
            { key: "factories-settlement", title: "\u7ED3\u7B97\u4FE1\u606F", icon: "Receipt", href: "/fcs/factories/settlement" },
            { key: "factories-status", title: "\u5DE5\u5382\u72B6\u6001", icon: "ToggleLeft", href: "/fcs/factories/status" },
            { key: "factories-performance", title: "\u5DE5\u5382\u7EE9\u6548", icon: "BarChart3", href: "/fcs/factories/performance" }
          ]
        },
        {
          key: "fcs-platform-production",
          title: "\u751F\u4EA7\u5355\u7BA1\u7406",
          icon: "FilePlus2",
          children: [
            { key: "production-demand-inbox", title: "\u751F\u4EA7\u9700\u6C42\u63A5\u6536", icon: "Inbox", href: "/fcs/production/demand-inbox" },
            { key: "production-orders", title: "\u751F\u4EA7\u5355\u7BA1\u7406", icon: "FilePlus2", href: "/fcs/production/orders" },
            { key: "production-plan", title: "\u751F\u4EA7\u5355\u8BA1\u5212", icon: "CalendarClock", href: "/fcs/production/plan" },
            { key: "production-delivery-warehouse", title: "\u4EA4\u4ED8\u4ED3\u914D\u7F6E", icon: "Warehouse", href: "/fcs/production/delivery-warehouse" },
            { key: "production-changes", title: "\u53D8\u66F4\u7BA1\u7406", icon: "GitPullRequest", href: "/fcs/production/changes" },
            { key: "production-status", title: "\u72B6\u6001\u7BA1\u7406", icon: "Workflow", href: "/fcs/production/status" },
            { key: "production-craft-dict", title: "\u5DE5\u5E8F\u5DE5\u827A\u5B57\u5178", icon: "BookOpen", href: "/fcs/production/craft-dict" }
          ]
        },
        {
          key: "fcs-platform-process",
          title: "\u4EFB\u52A1\u7F16\u6392\u4E0E\u6267\u884C\u51C6\u5907",
          icon: "Split",
          children: [
            { key: "process-task-breakdown", title: "\u4EFB\u52A1\u6E05\u5355", icon: "Split", href: "/fcs/process/task-breakdown" },
            { key: "process-dye-requirements", title: "\u67D3\u8272\u9700\u6C42\u5355", icon: "ClipboardList", href: "/fcs/process/dye-requirements" },
            { key: "process-print-requirements", title: "\u5370\u82B1\u9700\u6C42\u5355", icon: "FileText", href: "/fcs/process/print-requirements" },
            { key: "process-dye-orders", title: "\u67D3\u8272\u52A0\u5DE5\u5355", icon: "Package", href: "/fcs/process/dye-orders" },
            { key: "process-print-orders", title: "\u5370\u82B1\u52A0\u5DE5\u5355", icon: "ClipboardSignature", href: "/fcs/process/print-orders" }
          ]
        },
        {
          key: "fcs-platform-dispatch",
          title: "\u4EFB\u52A1\u5206\u914D",
          icon: "LayoutGrid",
          children: [
            { key: "dispatch-board", title: "\u4EFB\u52A1\u5206\u914D", icon: "LayoutGrid", href: "/fcs/dispatch/board" },
            { key: "dispatch-tenders", title: "\u62DB\u6807\u5355\u7BA1\u7406", icon: "Gavel", href: "/fcs/dispatch/tenders" }
          ]
        },
        {
          key: "fcs-platform-progress",
          title: "\u4EFB\u52A1\u8FDB\u5EA6\u4E0E\u5F02\u5E38",
          icon: "KanbanSquare",
          children: [
            { key: "progress-board", title: "\u4EFB\u52A1\u8FDB\u5EA6\u770B\u677F", icon: "KanbanSquare", href: "/fcs/progress/board" },
            { key: "progress-exceptions", title: "\u5F02\u5E38\u5B9A\u4F4D\u4E0E\u5904\u7406", icon: "Search", href: "/fcs/progress/exceptions" },
            { key: "progress-urge", title: "\u50AC\u529E\u4E0E\u901A\u77E5", icon: "BellRing", href: "/fcs/progress/urge" },
            { key: "progress-handover", title: "\u4EA4\u63A5\u94FE\u8DEF\u8FFD\u8E2A", icon: "ScanLine", href: "/fcs/progress/handover" },
            { key: "progress-material", title: "\u9886\u6599\u8FDB\u5EA6\u8DDF\u8E2A", icon: "PackageSearch", href: "/fcs/progress/material" },
            { key: "progress-milestone-config", title: "\u8282\u70B9\u4E0A\u62A5\u914D\u7F6E", icon: "Flag", href: "/fcs/progress/milestone-config" },
            { key: "progress-cutting-overview", title: "\u88C1\u7247\u4EFB\u52A1\u603B\u89C8", icon: "Scissors", href: "/fcs/progress/cutting-overview" },
            { key: "progress-cutting-exception-center", title: "\u88C1\u7247\u4E13\u9879\u5F02\u5E38\u4E2D\u5FC3", icon: "AlertTriangle", href: "/fcs/progress/cutting-exception-center" }
          ]
        },
        {
          key: "fcs-platform-quality",
          title: "\u8D28\u91CF\u4E0E\u6263\u6B3E",
          icon: "ClipboardCheck",
          children: [
            { key: "quality-inspection", title: "\u8D28\u68C0\u8BB0\u5F55", icon: "ClipboardCheck", href: "/fcs/quality/qc-records" },
            { key: "quality-deduction-analysis", title: "\u6263\u6B3E\u5206\u6790", icon: "BarChart3", href: "/fcs/quality/deduction-analysis" }
          ]
        },
        {
          key: "fcs-platform-settlement",
          title: "\u5BF9\u8D26\u4E0E\u7ED3\u7B97",
          icon: "FileText",
          children: [
            { key: "settlement-statements", title: "\u5BF9\u8D26\u5355", icon: "FileText", href: "/fcs/settlement/statements" },
            { key: "settlement-adjustments", title: "\u9884\u7ED3\u7B97\u6D41\u6C34", icon: "SlidersHorizontal", href: "/fcs/settlement/adjustments" },
            { key: "settlement-material-statements", title: "\u8F66\u7F1D\u9886\u6599\u5BF9\u8D26", icon: "ClipboardSignature", href: "/fcs/settlement/material-statements" },
            { key: "settlement-batches", title: "\u9884\u4ED8\u6B3E\u6279\u6B21", icon: "Layers", href: "/fcs/settlement/batches" }
          ]
        },
        {
          key: "fcs-platform-trace",
          title: "\u6210\u672C\u6EAF\u6E90\u7BA1\u7406",
          icon: "SearchCheck",
          children: [
            { key: "trace-parent-codes", title: "\u624E\u5305\u5468\u8F6C\u5305\u7236\u7801\u7BA1\u7406", icon: "Boxes", href: "/fcs/trace/parent-codes" },
            { key: "trace-unique-codes", title: "\u552F\u4E00\u7801\u7BA1\u7406", icon: "Fingerprint", href: "/fcs/trace/unique-codes" },
            { key: "trace-mapping", title: "\u7236\u5B50\u7801\u6620\u5C04", icon: "Merge", href: "/fcs/trace/mapping" },
            { key: "trace-unit-price", title: "\u5355\u4EF7\u8FFD\u6EAF\u67E5\u8BE2", icon: "SearchCheck", href: "/fcs/trace/unit-price" }
          ]
        },
        {
          key: "fcs-platform-capacity",
          title: "\u4EA7\u80FD\u65E5\u5386",
          icon: "LineChart",
          children: [
            { key: "capacity-overview", title: "\u4F9B\u9700\u603B\u89C8", icon: "LineChart", href: "/fcs/capacity/overview" },
            { key: "capacity-constraints", title: "\u5DE5\u5382\u65E5\u5386", icon: "Filter", href: "/fcs/capacity/constraints" },
            { key: "capacity-risk", title: "\u4EFB\u52A1\u5DE5\u65F6\u98CE\u9669", icon: "TrendingUp", href: "/fcs/capacity/risk" },
            { key: "capacity-bottleneck", title: "\u5DE5\u827A\u74F6\u9888\u4E0E\u5F85\u5206\u914D", icon: "AlertOctagon", href: "/fcs/capacity/bottleneck" },
            { key: "capacity-policies", title: "\u6682\u505C\u4F8B\u5916", icon: "Settings2", href: "/fcs/capacity/policies" }
          ]
        }
      ]
    },
    {
      title: "\u5DE5\u5382\u5165\u9A7B&\u767B\u5F55",
      icon: "LogIn",
      items: [
        { key: "pda-auth-login", title: "\u767B\u5F55", icon: "LogIn", href: "/fcs/pda/auth/login" },
        { key: "pda-auth-onboarding", title: "\u5165\u9A7B", icon: "ClipboardPen", href: "/fcs/pda/auth/onboarding" }
      ]
    },
    {
      title: "\u5DE5\u5382\u7AEF\u79FB\u52A8\u5E94\u7528",
      icon: "Smartphone",
      items: [
        { key: "pda-task-receive", title: "\u63A5\u5355", icon: "ClipboardList", href: "/fcs/pda/task-receive" },
        { key: "pda-exec", title: "\u6267\u884C", icon: "Play", href: "/fcs/pda/exec" },
        { key: "pda-handover", title: "\u4EA4\u63A5", icon: "ArrowLeftRight", href: "/fcs/pda/handover" },
        { key: "pda-warehouse", title: "\u4ED3\u7BA1", icon: "Warehouse", href: "/fcs/pda/warehouse" },
        { key: "pda-settlement", title: "\u7ED3\u7B97", icon: "Wallet", href: "/fcs/pda/settlement" }
      ]
    }
  ],
  pfos: [
    {
      title: "\u5DE5\u4F5C\u53F0",
      icon: "LayoutDashboard",
      items: [
        {
          key: "pfos-workbench",
          title: "\u5DE5\u4F5C\u53F0",
          icon: "LayoutDashboard",
          children: [
            { key: "pfos-workbench-overview", title: "\u603B\u89C8", icon: "LayoutDashboard", href: "/fcs/craft/workbench/overview" }
          ]
        }
      ]
    },
    {
      title: "\u88C1\u5E8A\u5382\u7BA1\u7406",
      icon: "Scissors",
      items: [
        {
          key: "pfos-cutting-overview",
          title: "\u88C1\u5E8A\u603B\u89C8",
          icon: "Scissors",
          children: [
            { key: "pfos-cutting-production-progress", title: "\u751F\u4EA7\u5355\u8FDB\u5EA6", icon: "ListTodo", href: "/fcs/craft/cutting/production-progress" }
          ]
        },
        {
          key: "pfos-cutting-prep",
          title: "\u88C1\u524D\u51C6\u5907",
          icon: "PackageSearch",
          children: [
            { key: "pfos-cutting-cut-orders", title: "\u88C1\u7247\u5355", icon: "ClipboardList", href: "/fcs/craft/cutting/cut-orders" },
            { key: "pfos-cutting-cuttable-pool", title: "\u53EF\u6392\u551B\u67B6\u88C1\u7247\u5355", icon: "CalendarClock", href: "/fcs/craft/cutting/cuttable-pool" },
            { key: "pfos-cutting-marker-list", title: "\u551B\u67B6\u65B9\u6848", icon: "Layers", href: "/fcs/craft/cutting/marker-list" }
          ]
        },
        {
          key: "pfos-cutting-execution",
          title: "\u94FA\u5E03\u6267\u884C",
          icon: "Rows3",
          children: [
            { key: "pfos-cutting-spreading-list", title: "\u94FA\u5E03\u5355", icon: "Rows3", href: "/fcs/craft/cutting/spreading-list" }
          ]
        },
        {
          key: "pfos-cutting-post",
          title: "\u88C1\u540E\u5904\u7406",
          icon: "PackageCheck",
          children: [
            { key: "pfos-cutting-replenishment", title: "\u8865\u6599\u7BA1\u7406", icon: "ShieldAlert", href: "/fcs/craft/cutting/replenishment" },
            { key: "pfos-cutting-binding-strip-orders", title: "\u6346\u6761\u52A0\u5DE5\u5355", icon: "Sparkles", href: "/fcs/craft/cutting/special-processes" },
            { key: "pfos-cutting-fei-tickets", title: "\u6253\u5370\u83F2\u7968", icon: "Ticket", href: "/fcs/craft/cutting/fei-tickets" },
            { key: "pfos-cutting-transfer-bags", title: "\u4E2D\u8F6C\u888B\u6D41\u8F6C", icon: "PackageCheck", href: "/fcs/craft/cutting/transfer-bags" },
            { key: "pfos-cutting-summary", title: "\u88C1\u526A\u603B\u7ED3", icon: "ClipboardPen", href: "/fcs/craft/cutting/summary" }
          ]
        },
        {
          key: "pfos-cutting-warehouse-management",
          title: "\u88C1\u5E8A\u4ED3\u5E93\u7BA1\u7406",
          icon: "Warehouse",
          children: [
            { key: "pfos-cutting-warehouse-wait-process", title: "\u5F85\u52A0\u5DE5\u4ED3", icon: "PackageSearch", href: "/fcs/craft/cutting/warehouse-management/wait-process" },
            { key: "pfos-cutting-warehouse-wait-handover", title: "\u5F85\u4EA4\u51FA\u4ED3", icon: "Archive", href: "/fcs/craft/cutting/warehouse-management/wait-handover" },
            { key: "pfos-cutting-handover-orders", title: "\u4EA4\u51FA\u5355", icon: "ArrowLeftRight", href: "/fcs/craft/cutting/handover-orders" },
            { key: "pfos-cutting-warehouse-sample", title: "\u6837\u8863\u4ED3", icon: "Shirt", href: "/fcs/craft/cutting/warehouse-management/sample-warehouse" }
          ]
        }
      ]
    },
    {
      title: "\u5370\u82B1\u5382\u7BA1\u7406",
      icon: "Palette",
      items: [
        {
          key: "pfos-printing",
          title: "\u5370\u82B1\u7BA1\u7406",
          icon: "Palette",
          children: [
            { key: "pfos-printing-work-orders", title: "\u5370\u82B1\u52A0\u5DE5\u5355", icon: "ClipboardList", href: "/fcs/craft/printing/work-orders" },
            { key: "pfos-printing-wait-process-warehouse", title: "\u5370\u82B1\u5F85\u52A0\u5DE5\u4ED3", icon: "Warehouse", href: "/fcs/craft/printing/wait-process-warehouse" },
            { key: "pfos-printing-wait-handover-warehouse", title: "\u5370\u82B1\u5F85\u4EA4\u51FA\u4ED3", icon: "PackageCheck", href: "/fcs/craft/printing/wait-handover-warehouse" },
            { key: "pfos-printing-statistics", title: "\u5370\u82B1\u7EDF\u8BA1", icon: "BarChart3", href: "/fcs/craft/printing/statistics" },
            { key: "pfos-printing-dashboards", title: "\u5370\u82B1\u5927\u5C4F", icon: "Monitor", href: "/fcs/craft/printing/dashboards" }
          ]
        }
      ]
    },
    {
      title: "\u67D3\u5382\u7BA1\u7406",
      icon: "Droplet",
      items: [
        {
          key: "pfos-dyeing",
          title: "\u67D3\u5382\u7BA1\u7406",
          icon: "Droplet",
          children: [
            { key: "pfos-dyeing-work-orders", title: "\u67D3\u8272\u52A0\u5DE5\u5355", icon: "ClipboardList", href: "/fcs/craft/dyeing/work-orders" },
            { key: "pfos-dyeing-wait-process-warehouse", title: "\u67D3\u8272\u5F85\u52A0\u5DE5\u4ED3", icon: "Warehouse", href: "/fcs/craft/dyeing/wait-process-warehouse" },
            { key: "pfos-dyeing-wait-handover-warehouse", title: "\u67D3\u8272\u5F85\u4EA4\u51FA\u4ED3", icon: "PackageCheck", href: "/fcs/craft/dyeing/wait-handover-warehouse" },
            { key: "pfos-dyeing-statistics", title: "\u67D3\u8272\u7EDF\u8BA1", icon: "BarChart3", href: "/fcs/craft/dyeing/reports" }
          ]
        }
      ]
    },
    {
      title: "\u6BDB\u7EC7\u5382\u7BA1\u7406",
      icon: "Shirt",
      items: [
        {
          key: "pfos-wool",
          title: "\u6BDB\u7EC7\u7BA1\u7406",
          icon: "Shirt",
          children: [
            { key: "pfos-wool-work-orders", title: "\u6BDB\u7EC7\u52A0\u5DE5\u5355", icon: "ClipboardList", href: "/fcs/craft/wool/work-orders" },
            { key: "pfos-wool-machine-schedule", title: "\u6A2A\u673A\u6392\u4EA7", icon: "CalendarClock", href: "/fcs/craft/wool/machine-schedule" },
            { key: "pfos-wool-machines", title: "\u6A2A\u673A\u8BBE\u5907", icon: "Settings2", href: "/fcs/craft/wool/machines" },
            { key: "pfos-wool-wait-process-warehouse", title: "\u6BDB\u7EC7\u5F85\u52A0\u5DE5\u4ED3", icon: "Warehouse", href: "/fcs/craft/wool/wait-process-warehouse" },
            { key: "pfos-wool-wait-handover-warehouse", title: "\u6BDB\u7EC7\u5F85\u4EA4\u51FA\u4ED3", icon: "PackageCheck", href: "/fcs/craft/wool/wait-handover-warehouse" },
            { key: "pfos-wool-fei-tickets", title: "\u6BDB\u7EC7\u83F2\u7968", icon: "Ticket", href: "/fcs/craft/wool/fei-tickets" },
            { key: "pfos-wool-statistics", title: "\u6BDB\u7EC7\u7EDF\u8BA1", icon: "BarChart3", href: "/fcs/craft/wool/statistics" }
          ]
        }
      ]
    },
    {
      title: "\u540E\u9053\u5DE5\u5382\u7BA1\u7406",
      icon: "PackageCheck",
      items: [
        {
          key: "pfos-post-finishing",
          title: "\u540E\u9053\u5DE5\u5382\u7BA1\u7406",
          icon: "PackageCheck",
          children: [
            { key: "pfos-post-finishing-tasks", title: "\u540E\u9053\u4EFB\u52A1", icon: "ListChecks", href: "/fcs/craft/post-finishing/tasks" },
            { key: "pfos-post-finishing-qc-orders", title: "\u8D28\u68C0\u5355", icon: "ClipboardCheck", href: "/fcs/craft/post-finishing/qc-orders" },
            { key: "pfos-post-finishing-work-orders", title: "\u540E\u9053\u5355", icon: "ClipboardList", href: "/fcs/craft/post-finishing/work-orders" },
            { key: "pfos-post-finishing-recheck-orders", title: "\u590D\u68C0\u5355", icon: "RefreshCw", href: "/fcs/craft/post-finishing/recheck-orders" },
            { key: "pfos-post-finishing-wait-process-warehouse", title: "\u540E\u9053\u5F85\u52A0\u5DE5\u4ED3", icon: "Warehouse", href: "/fcs/craft/post-finishing/wait-process-warehouse" },
            { key: "pfos-post-finishing-wait-handover-warehouse", title: "\u540E\u9053\u5F85\u4EA4\u51FA\u4ED3", icon: "PackageCheck", href: "/fcs/craft/post-finishing/wait-handover-warehouse" }
          ]
        }
      ]
    },
    ...specialCraftMenuGroups
  ],
  wls: [
    {
      title: "\u4ED3\u50A8\u7BA1\u7406",
      items: [
        { key: "inventory", title: "\u5E93\u5B58\u7BA1\u7406", icon: "Archive", href: "/wls/inventory" },
        { key: "inbound", title: "\u5165\u5E93\u7BA1\u7406", icon: "ArrowDownToLine", href: "/wls/inbound" },
        { key: "outbound", title: "\u51FA\u5E93\u7BA1\u7406", icon: "ArrowUpFromLine", href: "/wls/outbound" }
      ]
    }
  ],
  los: [
    {
      title: "\u76F4\u64AD\u8FD0\u8425",
      items: [
        { key: "live-schedule", title: "\u76F4\u64AD\u6392\u671F", icon: "Video", href: "/los/live-schedule" },
        { key: "live-room", title: "\u76F4\u64AD\u95F4\u7BA1\u7406", icon: "Tv", href: "/los/live-room" },
        { key: "anchor", title: "\u4E3B\u64AD\u7BA1\u7406", icon: "Users", href: "/los/anchor" }
      ]
    }
  ],
  oms: [
    {
      title: "\u8BA2\u5355\u7BA1\u7406",
      items: [
        { key: "order-list", title: "\u8BA2\u5355\u5217\u8868", icon: "ShoppingCart", href: "/oms/order-list" },
        { key: "return-order", title: "\u9000\u6362\u8D27\u7BA1\u7406", icon: "RotateCcw", href: "/oms/return-order" },
        { key: "after-sale", title: "\u552E\u540E\u670D\u52A1", icon: "Headphones", href: "/oms/after-sale" }
      ]
    }
  ],
  bfis: [
    {
      title: "\u8D22\u52A1\u7BA1\u7406",
      items: [
        { key: "financial-report", title: "\u8D22\u52A1\u62A5\u8868", icon: "BarChart3", href: "/bfis/financial-report" },
        { key: "cost-analysis", title: "\u6210\u672C\u5206\u6790", icon: "PieChart", href: "/bfis/cost-analysis" },
        { key: "settlement", title: "\u7ED3\u7B97\u7BA1\u7406", icon: "Wallet", href: "/bfis/settlement" }
      ]
    }
  ],
  dds: [
    {
      title: "\u6570\u636E\u5206\u6790",
      items: [
        { key: "dashboard", title: "\u6570\u636E\u770B\u677F", icon: "LayoutDashboard", href: "/dds/dashboard" },
        { key: "report", title: "\u62A5\u8868\u4E2D\u5FC3", icon: "FileBarChart", href: "/dds/report" },
        { key: "bi", title: "BI\u5206\u6790", icon: "TrendingUp", href: "/dds/bi" }
      ]
    }
  ]
};
export {
  buildSpecialCraftMenuGroups,
  buildSpecialCraftMenuGroupsForFactory,
  menusBySystem,
  systems
};
