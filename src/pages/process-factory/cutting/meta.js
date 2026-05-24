import { escapeHtml } from "../../../utils.ts";
const CUTTING_PAGE_META = {
  "production-progress": {
    key: "production-progress",
    canonicalPath: "/fcs/craft/cutting/production-progress",
    aliases: [],
    menuGroupTitle: "\u88C1\u5E8A\u603B\u89C8",
    pageTitle: "\u751F\u4EA7\u5355\u8FDB\u5EA6",
    pageSubtitle: "",
    isPlaceholder: false,
    shortDescription: "\u6309\u751F\u4EA7\u5355\u67E5\u770B\u88C1\u7247\u8FDB\u5EA6\u3002"
  },
  "cuttable-pool": {
    key: "cuttable-pool",
    canonicalPath: "/fcs/craft/cutting/cuttable-pool",
    aliases: [],
    menuGroupTitle: "\u88C1\u524D\u51C6\u5907",
    pageTitle: "\u53EF\u6392\u551B\u67B6\u88C1\u7247\u5355",
    pageSubtitle: "",
    isPlaceholder: false,
    shortDescription: "\u67E5\u770B\u53EF\u8FDB\u5165\u551B\u67B6\u65B9\u6848\u7684\u88C1\u7247\u5355\u3002"
  },
  "cut-orders": {
    key: "cut-orders",
    canonicalPath: "/fcs/craft/cutting/cut-orders",
    aliases: [],
    menuGroupTitle: "\u88C1\u524D\u51C6\u5907",
    pageTitle: "\u88C1\u7247\u5355",
    pageSubtitle: "",
    isPlaceholder: false,
    shortDescription: "\u67E5\u770B\u88C1\u7247\u5355\u4E0E\u6267\u884C\u8BB0\u5F55\u3002"
  },
  "marker-list": {
    key: "marker-list",
    canonicalPath: "/fcs/craft/cutting/marker-list",
    aliases: [],
    menuGroupTitle: "\u88C1\u524D\u51C6\u5907",
    pageTitle: "\u551B\u67B6\u65B9\u6848",
    pageSubtitle: "",
    isPlaceholder: false,
    shortDescription: "\u67E5\u770B\u551B\u67B6\u65B9\u6848\u4E0E\u551B\u67B6\u7F16\u53F7\u3002"
  },
  "marker-create": {
    key: "marker-create",
    canonicalPath: "/fcs/craft/cutting/marker-create",
    aliases: [],
    menuGroupTitle: "\u88C1\u524D\u51C6\u5907",
    pageTitle: "\u65B0\u5EFA\u551B\u67B6\u65B9\u6848",
    pageSubtitle: "",
    isPlaceholder: false,
    shortDescription: "\u4ECE\u53EF\u6392\u551B\u67B6\u88C1\u7247\u5355\u65B0\u5EFA\u551B\u67B6\u65B9\u6848\u3002"
  },
  "spreading-list": {
    key: "spreading-list",
    canonicalPath: "/fcs/craft/cutting/spreading-list",
    aliases: [],
    menuGroupTitle: "\u94FA\u5E03\u6267\u884C",
    pageTitle: "\u94FA\u5E03\u5355",
    pageSubtitle: "",
    isPlaceholder: false,
    shortDescription: "\u67E5\u770B\u94FA\u5E03\u5355\u3001\u8BA1\u5212\u5B9E\u9645\u5BF9\u6BD4\u3001PDA \u5199\u56DE\u4E0E\u5DEE\u5F02\u590D\u6838\u3002"
  },
  "spreading-create": {
    key: "spreading-create",
    canonicalPath: "/fcs/craft/cutting/spreading-create",
    aliases: [],
    menuGroupTitle: "\u94FA\u5E03\u6267\u884C",
    pageTitle: "\u65B0\u5EFA\u94FA\u5E03",
    pageSubtitle: "",
    isPlaceholder: false,
    shortDescription: "\u57FA\u4E8E\u551B\u67B6\u65B9\u6848\u4E2D\u7684\u551B\u67B6\u7F16\u53F7\u65B0\u5EFA\u94FA\u5E03\u4EFB\u52A1\u3002"
  },
  "marker-spreading": {
    key: "marker-spreading",
    canonicalPath: "/fcs/craft/cutting/marker-spreading",
    aliases: [],
    menuGroupTitle: "\u94FA\u5E03\u6267\u884C",
    pageTitle: "\u94FA\u5E03\u8BB0\u5F55",
    pageSubtitle: "",
    isPlaceholder: false,
    shortDescription: "\u67E5\u770B\u94FA\u5E03\u8BB0\u5F55\u4E0E\u6267\u884C\u72B6\u6001\u3002"
  },
  "marker-detail": {
    key: "marker-detail",
    canonicalPath: "/fcs/craft/cutting/marker-detail",
    aliases: [],
    menuGroupTitle: "\u88C1\u524D\u51C6\u5907",
    pageTitle: "\u551B\u67B6\u65B9\u6848\u8BE6\u60C5",
    pageSubtitle: "",
    isPlaceholder: false,
    shortDescription: "\u67E5\u770B\u551B\u67B6\u65B9\u6848\u3001\u5E8A\u6B21\u548C\u56FE\u7247\u3002"
  },
  "marker-edit": {
    key: "marker-edit",
    canonicalPath: "/fcs/craft/cutting/marker-edit",
    aliases: [],
    menuGroupTitle: "\u88C1\u524D\u51C6\u5907",
    pageTitle: "\u7F16\u8F91\u551B\u67B6\u65B9\u6848",
    pageSubtitle: "",
    isPlaceholder: false,
    shortDescription: "\u7F16\u8F91\u551B\u67B6\u65B9\u6848\u8BA1\u5212\u3002"
  },
  "spreading-detail": {
    key: "spreading-detail",
    canonicalPath: "/fcs/craft/cutting/spreading-detail",
    aliases: [],
    menuGroupTitle: "\u94FA\u5E03\u6267\u884C",
    pageTitle: "\u94FA\u5E03\u5355\u8BE6\u60C5",
    pageSubtitle: "",
    isPlaceholder: false,
    shortDescription: "\u67E5\u770B\u94FA\u5E03\u5355\u8BA1\u5212\u3001\u5B9E\u9645\u3001\u5377\u8BB0\u5F55\u3001\u4EBA\u5458\u8BB0\u5F55\u548C PDA \u5199\u56DE\u3002"
  },
  "spreading-edit": {
    key: "spreading-edit",
    canonicalPath: "/fcs/craft/cutting/spreading-edit",
    aliases: [],
    menuGroupTitle: "\u94FA\u5E03\u6267\u884C",
    pageTitle: "\u94FA\u5E03\u7F16\u8F91",
    pageSubtitle: "",
    isPlaceholder: false,
    shortDescription: "\u7F16\u8F91\u94FA\u5E03\u3002"
  },
  "fei-tickets": {
    key: "fei-tickets",
    canonicalPath: "/fcs/craft/cutting/fei-tickets",
    aliases: [],
    menuGroupTitle: "\u88C1\u540E\u5904\u7406",
    pageTitle: "\u6253\u5370\u83F2\u7968",
    pageSubtitle: "",
    isPlaceholder: false,
    shortDescription: "\u67E5\u770B\u53EF\u6253\u5370\u5355\u5143\u4E0E\u6253\u5370\u72B6\u6001\u3002"
  },
  "fei-ticket-detail": {
    key: "fei-ticket-detail",
    canonicalPath: "/fcs/craft/cutting/fei-ticket-detail",
    aliases: [],
    menuGroupTitle: "\u88C1\u540E\u5904\u7406",
    pageTitle: "\u6253\u5370\u83F2\u7968\u8BE6\u60C5",
    pageSubtitle: "",
    isPlaceholder: false,
    shortDescription: "\u67E5\u770B\u6253\u5370\u5355\u5143\u3001\u83F2\u7968\u7801\u4E0E\u6253\u5370\u8BB0\u5F55\u3002"
  },
  "fei-ticket-printed": {
    key: "fei-ticket-printed",
    canonicalPath: "/fcs/craft/cutting/fei-ticket-printed",
    aliases: [],
    menuGroupTitle: "\u88C1\u540E\u5904\u7406",
    pageTitle: "\u5DF2\u6253\u5370\u83F2\u7968",
    pageSubtitle: "",
    isPlaceholder: false,
    shortDescription: "\u67E5\u770B\u5DF2\u6253\u5370\u83F2\u7968\u4E0E\u4F5C\u5E9F\u8BB0\u5F55\u3002"
  },
  "fei-ticket-records": {
    key: "fei-ticket-records",
    canonicalPath: "/fcs/craft/cutting/fei-ticket-records",
    aliases: [],
    menuGroupTitle: "\u88C1\u540E\u5904\u7406",
    pageTitle: "\u6253\u5370\u83F2\u7968\u8BB0\u5F55",
    pageSubtitle: "",
    isPlaceholder: false,
    shortDescription: "\u67E5\u770B\u6253\u5370\u6D41\u6C34\u3002"
  },
  "fei-ticket-print": {
    key: "fei-ticket-print",
    canonicalPath: "/fcs/craft/cutting/fei-ticket-print",
    aliases: [],
    menuGroupTitle: "\u88C1\u540E\u5904\u7406",
    pageTitle: "\u6253\u5370\u83F2\u7968",
    pageSubtitle: "",
    isPlaceholder: false,
    shortDescription: "\u9996\u6B21\u6253\u5370\u83F2\u7968\u3002"
  },
  "fei-ticket-reprint": {
    key: "fei-ticket-reprint",
    canonicalPath: "/fcs/craft/cutting/fei-ticket-reprint",
    aliases: [],
    menuGroupTitle: "\u88C1\u540E\u5904\u7406",
    pageTitle: "\u8865\u6253\u83F2\u7968",
    pageSubtitle: "",
    isPlaceholder: false,
    shortDescription: "\u8865\u6253\u83F2\u7968\u3002"
  },
  "fei-ticket-void": {
    key: "fei-ticket-void",
    canonicalPath: "/fcs/craft/cutting/fei-ticket-void",
    aliases: [],
    menuGroupTitle: "\u88C1\u540E\u5904\u7406",
    pageTitle: "\u4F5C\u5E9F\u83F2\u7968",
    pageSubtitle: "",
    isPlaceholder: false,
    shortDescription: "\u4F5C\u5E9F\u5355\u5F20\u83F2\u7968\u3002"
  },
  "warehouse-management-wait-process": {
    key: "warehouse-management-wait-process",
    canonicalPath: "/fcs/craft/cutting/warehouse-management/wait-process",
    aliases: [],
    menuGroupTitle: "\u88C1\u5E8A\u4ED3\u5E93\u7BA1\u7406",
    pageTitle: "\u5F85\u52A0\u5DE5\u4ED3",
    pageSubtitle: "",
    isPlaceholder: false,
    shortDescription: "\u5728\u5F85\u52A0\u5DE5\u603B\u89C8\u3001\u88C1\u5E8A\u4ED3\u548C\u7279\u6B8A\u5DE5\u827A\u5F85\u52A0\u5DE5 / \u4EA4\u51FA\u4E4B\u95F4\u5207\u6362\u3002"
  },
  "warehouse-management-wait-handover": {
    key: "warehouse-management-wait-handover",
    canonicalPath: "/fcs/craft/cutting/warehouse-management/wait-handover",
    aliases: [],
    menuGroupTitle: "\u88C1\u5E8A\u4ED3\u5E93\u7BA1\u7406",
    pageTitle: "\u88C1\u5E8A\u5F85\u4EA4\u51FA\u4ED3",
    pageSubtitle: "",
    isPlaceholder: false,
    shortDescription: "\u67E5\u770B\u88C1\u540E\u5F85\u5165\u4ED3\u786E\u8BA4\u3001\u4E8C\u6B21\u5206\u62E3\u3001\u91CD\u65B0\u88C5\u888B\u3001\u4EA4\u51FA\u8BB0\u5F55\u548C\u63A5\u6536\u5DEE\u5F02\u3002"
  },
  "fabric-warehouse": {
    key: "fabric-warehouse",
    canonicalPath: "/fcs/craft/cutting/warehouse-management/wait-process?tab=fabric-warehouse",
    aliases: [],
    menuGroupTitle: "\u88C1\u5E8A\u4ED3\u5E93\u7BA1\u7406",
    pageTitle: "\u88C1\u5E8A\u4ED3",
    pageSubtitle: "",
    isPlaceholder: false,
    shortDescription: "\u67E5\u770B\u88C1\u5E8A\u4ED3\u5E93\u5B58\u3002"
  },
  "cut-piece-warehouse": {
    key: "cut-piece-warehouse",
    canonicalPath: "/fcs/craft/cutting/warehouse-management/wait-handover?tab=cut-piece-warehouse",
    aliases: [],
    menuGroupTitle: "\u88C1\u5E8A\u4ED3\u5E93\u7BA1\u7406",
    pageTitle: "\u88C1\u7247\u4ED3",
    pageSubtitle: "",
    isPlaceholder: false,
    shortDescription: "\u67E5\u770B\u88C1\u7247\u4ED3\u72B6\u6001\u3002"
  },
  "sample-warehouse": {
    key: "sample-warehouse",
    canonicalPath: "/fcs/craft/cutting/sample-warehouse",
    aliases: [],
    menuGroupTitle: "\u88C1\u5E8A\u4ED3\u5E93\u7BA1\u7406",
    pageTitle: "\u6837\u8863\u4ED3",
    pageSubtitle: "",
    isPlaceholder: false,
    shortDescription: "\u5728\u6837\u8863\u5E93\u5B58\u3001\u6837\u8863\u6D41\u8F6C\u548C\u6837\u8863\u5F02\u5E38 / \u5F85\u5F52\u8FD8\u4E4B\u95F4\u5207\u6362\u3002"
  },
  "transfer-bags": {
    key: "transfer-bags",
    canonicalPath: "/fcs/craft/cutting/transfer-bags",
    aliases: [],
    menuGroupTitle: "\u88C1\u540E\u5904\u7406",
    pageTitle: "\u4E2D\u8F6C\u888B\u6D41\u8F6C",
    pageSubtitle: "",
    isPlaceholder: false,
    shortDescription: "\u67E5\u770B\u4E2D\u8F6C\u888B\u6D41\u8F6C\u72B6\u6001\u3001\u7B5B\u9009\u5BF9\u8C61\u5E76\u8FDB\u5165\u8BE6\u60C5\u3002"
  },
  "transfer-bag-detail": {
    key: "transfer-bag-detail",
    canonicalPath: "/fcs/craft/cutting/transfer-bag-detail",
    aliases: [],
    menuGroupTitle: "\u88C1\u540E\u5904\u7406",
    pageTitle: "\u4E2D\u8F6C\u888B\u8BE6\u60C5",
    pageSubtitle: "",
    isPlaceholder: false,
    shortDescription: "\u67E5\u770B\u5355\u4E2A\u4E2D\u8F6C\u888B\u7684\u6D41\u8F6C\u8BE6\u60C5\u3001\u4E8C\u7EF4\u7801\u4E0E\u4F7F\u7528\u5468\u671F\u5DE5\u4F5C\u533A\u3002"
  },
  "handover-orders": {
    key: "handover-orders",
    canonicalPath: "/fcs/craft/cutting/handover-orders",
    aliases: [],
    menuGroupTitle: "\u88C1\u5E8A\u4ED3\u5E93\u7BA1\u7406",
    pageTitle: "\u4EA4\u51FA\u5355",
    pageSubtitle: "",
    isPlaceholder: false,
    shortDescription: "\u67E5\u770B\u901A\u7528\u4EA4\u51FA\u5355\u3001\u4EA4\u51FA\u8BB0\u5F55\u3001\u63A5\u6536\u56DE\u5199\u3001\u5DEE\u5F02\u548C\u5F02\u8BAE\u3002"
  },
  "handover-order-detail": {
    key: "handover-order-detail",
    canonicalPath: "/fcs/craft/cutting/handover-orders",
    aliases: [],
    menuGroupTitle: "\u88C1\u5E8A\u4ED3\u5E93\u7BA1\u7406",
    pageTitle: "\u4EA4\u51FA\u5355\u8BE6\u60C5",
    pageSubtitle: "",
    isPlaceholder: false,
    shortDescription: "\u67E5\u770B\u4EA4\u51FA\u5355\u4E0B\u7684\u591A\u6B21\u4EA4\u51FA\u8BB0\u5F55\u3002"
  },
  "handover-record-detail": {
    key: "handover-record-detail",
    canonicalPath: "/fcs/craft/cutting/handover-records",
    aliases: [],
    menuGroupTitle: "\u88C1\u5E8A\u4ED3\u5E93\u7BA1\u7406",
    pageTitle: "\u4EA4\u51FA\u8BB0\u5F55\u8BE6\u60C5",
    pageSubtitle: "",
    isPlaceholder: false,
    shortDescription: "\u67E5\u770B\u672C\u6B21\u4EA4\u51FA\u3001\u7D2F\u8BA1\u4EA4\u51FA\u3001\u63A5\u6536\u56DE\u5199\u3001\u5DEE\u5F02\u548C\u5F02\u8BAE\u3002"
  },
  replenishment: {
    key: "replenishment",
    canonicalPath: "/fcs/craft/cutting/replenishment",
    aliases: [],
    menuGroupTitle: "\u88C1\u540E\u5904\u7406",
    pageTitle: "\u8865\u6599\u7BA1\u7406",
    pageSubtitle: "",
    isPlaceholder: false,
    shortDescription: "\u6309\u5B9E\u9645\u5DEE\u5F02\u5BA1\u6838\u8865\u6599\u3001\u8865\u5F55\u3001\u8865\u6392\u3001\u5173\u95ED\u6216\u4EC5\u8BB0\u5F55\u3002"
  },
  "special-craft-dispatch": {
    key: "special-craft-dispatch",
    canonicalPath: "/fcs/craft/cutting/warehouse-management/wait-process?tab=special-craft-dispatch",
    aliases: [],
    menuGroupTitle: "\u88C1\u5E8A\u4ED3\u5E93\u7BA1\u7406",
    pageTitle: "\u7279\u6B8A\u5DE5\u827A\u4EA4\u51FA",
    pageSubtitle: "",
    isPlaceholder: false,
    shortDescription: "\u6309\u83F2\u7968\u4EA4\u51FA\u5230\u7279\u6B8A\u5DE5\u827A\u5382\u3002"
  },
  "special-craft-return": {
    key: "special-craft-return",
    canonicalPath: "/fcs/craft/cutting/warehouse-management/wait-handover?tab=special-craft-return",
    aliases: [],
    menuGroupTitle: "\u88C1\u5E8A\u4ED3\u5E93\u7BA1\u7406",
    pageTitle: "\u7279\u6B8A\u5DE5\u827A\u56DE\u4ED3",
    pageSubtitle: "",
    isPlaceholder: false,
    shortDescription: "\u6309\u83F2\u7968\u786E\u8BA4\u7279\u6B8A\u5DE5\u827A\u56DE\u4ED3\u3002"
  },
  "sewing-dispatch": {
    key: "sewing-dispatch",
    canonicalPath: "/fcs/craft/cutting/warehouse-management/wait-handover?tab=handoverOrders",
    aliases: [],
    menuGroupTitle: "\u88C1\u5E8A\u4ED3\u5E93\u7BA1\u7406",
    pageTitle: "\u4EA4\u51FA\u5355",
    pageSubtitle: "",
    isPlaceholder: false,
    shortDescription: "\u6309\u4EA4\u51FA\u5BF9\u8C61\u65B0\u589E\u4EA4\u51FA\u8BB0\u5F55\u5E76\u8FFD\u8E2A\u63A5\u6536\u65B9\u56DE\u5199\u3002"
  },
  "special-processes": {
    key: "special-processes",
    canonicalPath: "/fcs/craft/cutting/special-processes",
    aliases: [],
    menuGroupTitle: "\u88C1\u540E\u5904\u7406",
    pageTitle: "\u6346\u6761\u52A0\u5DE5\u5355",
    pageSubtitle: "",
    isPlaceholder: false,
    shortDescription: "\u67E5\u770B\u88C1\u5E8A\u6346\u6761\u52A0\u5DE5\u5355\u3002"
  },
  summary: {
    key: "summary",
    canonicalPath: "/fcs/craft/cutting/summary",
    aliases: [],
    menuGroupTitle: "\u88C1\u540E\u5904\u7406",
    pageTitle: "\u88C1\u526A\u603B\u7ED3",
    pageSubtitle: "",
    isPlaceholder: false,
    shortDescription: "\u67E5\u770B\u88C1\u526A\u603B\u7ED3\u3002"
  }
};
const CUTTING_META_LIST = Object.values(CUTTING_PAGE_META);
function getCanonicalCuttingMeta(pathname, fallbackKey) {
  const matched = CUTTING_META_LIST.find((item) => item.canonicalPath === pathname || item.aliases.includes(pathname));
  if (matched) return matched;
  if (fallbackKey) return CUTTING_PAGE_META[fallbackKey];
  return CUTTING_PAGE_META["production-progress"];
}
function isCuttingAliasPath(pathname) {
  const meta = getCanonicalCuttingMeta(pathname);
  return meta.aliases.includes(pathname);
}
function getCanonicalCuttingPath(key) {
  return CUTTING_PAGE_META[key].canonicalPath;
}
function renderHeaderBadge(label, tone = "blue") {
  const className = tone === "amber" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-sky-50 text-sky-700 border-sky-200";
  return `<span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${className}">${escapeHtml(label)}</span>`;
}
function renderCuttingPageHeader(meta, options = {}) {
  return `
    <header class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h1 class="text-xl font-bold">${escapeHtml(meta.pageTitle)}</h1>
      </div>
      ${options.actionsHtml ?? ""}
    </header>
  `;
}
export {
  CUTTING_PAGE_META,
  getCanonicalCuttingMeta,
  getCanonicalCuttingPath,
  isCuttingAliasPath,
  renderCuttingPageHeader
};
