/**
 * 冻结规则（统一事实源类任务）
 *
 * 在“统一数据源 / 统一事实源”类任务中：
 * 1) 只能修改：数据源、映射层、查询层、状态来源、兼容层、字段绑定。
 * 2) 不得修改：页面布局、表格列顺序、卡片样式、按钮位置、tab、drawer、modal、筛选器、统计卡、详情结构、文案层级。
 * 3) 若必须改 UI/交互，必须由单独任务明确提出。
 */
export const FCS_UNIFIED_SOURCE_FREEZE_RULE = {
  allowed: ['data-source', 'mapping-layer', 'query-layer', 'state-source', 'compat-layer', 'field-binding'],
  forbidden: [
    'layout',
    'table-columns',
    'card-style',
    'button-position',
    'tab-structure',
    'drawer-modal-interaction',
    'filter-structure',
    'stats-card-structure',
    'detail-structure',
    'copy-hierarchy',
  ],
} as const
