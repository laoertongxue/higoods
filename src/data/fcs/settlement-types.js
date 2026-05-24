// 这里定义的是工厂档案结算信息主数据，用于描述生效周期类型、计价方式、币种和账户快照。
// 对账单、预付款批次和工厂端结算只读取这些主数据的生效版本，不在周期执行对象里直接维护。
// 配置映射
export const cycleTypeConfig = {
    WEEKLY: { label: '每周' },
    BIWEEKLY: { label: '双周' },
    MONTHLY: { label: '每月' },
    PER_BATCH: { label: '按批次' },
};
export const pricingModeConfig = {
    BY_PIECE: { label: '按件计价' },
    BY_PROCESS: { label: '按工序计价' },
    BY_ORDER: { label: '按订单计价' },
};
export const ruleTypeConfig = {
    QUALITY_DEFECT: { label: '质量缺陷' },
    DELAY_DELIVERY: { label: '延迟交付' },
    MATERIAL_LOSS: { label: '物料损耗' },
};
export const ruleModeConfig = {
    FIXED_AMOUNT: { label: '固定金额' },
    PERCENTAGE: { label: '百分比' },
};
export const settlementStatusConfig = {
    ACTIVE: { label: '生效', color: 'bg-green-50 text-green-700 border-green-200' },
    INACTIVE: { label: '失效', color: 'bg-gray-100 text-gray-600 border-gray-200' },
};
