// 状态配置
export const factoryStatusConfig = {
    active: { label: '在合作', color: 'bg-green-100 text-green-700 border-green-200' },
    paused: { label: '暂停', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    blacklist: { label: '黑名单', color: 'bg-red-100 text-red-700 border-red-200' },
    inactive: { label: '未激活', color: 'bg-gray-100 text-gray-700 border-gray-200' },
};
// 合作模式配置
export const cooperationModeConfig = {
    exclusive: { label: '独家合作' },
    preferred: { label: '优先合作' },
    general: { label: '普通合作' },
};
// 层级显示配置
export const factoryTierConfig = {
    CENTRAL: { label: '中央工厂', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    SATELLITE: { label: '卫星工厂', color: 'bg-purple-100 text-purple-700 border-purple-200' },
    THIRD_PARTY: { label: '三方工厂', color: 'bg-orange-100 text-orange-700 border-orange-200' },
};
// 类型显示配置
export const factoryTypeConfig = {
    CENTRAL_GARMENT: { label: '成衣厂' },
    CENTRAL_PRINT: { label: '印花厂' },
    CENTRAL_DYE: { label: '染厂' },
    CENTRAL_CUTTING: { label: '裁床厂' },
    CENTRAL_SPECIAL: { label: '特种工艺厂' },
    CENTRAL_AUX: { label: '辅助工艺厂' },
    CENTRAL_LACE: { label: '花边厂' },
    CENTRAL_RIBBON: { label: '织带厂' },
    CENTRAL_WOOL: { label: '毛织厂' },
    CENTRAL_POD: { label: 'POD工厂' },
    CENTRAL_DENIM_WASH: { label: '牛仔水洗厂' },
    SATELLITE_SEWING: { label: '缝纫工厂' },
    SATELLITE_FINISHING: { label: '后道工厂' },
    THIRD_SEWING: { label: '小微缝纫工厂' },
};
export const factoryAbilityScopeLabel = {
    PROCESS: '工序',
    CRAFT: '工艺',
};
export const factoryAbilityStatusLabel = {
    ACTIVE: '可用',
    PAUSED: '暂停',
    DISABLED: '历史停用',
};
export const factoryCapacityEquipmentStatusLabel = {
    AVAILABLE: '可用',
    IN_USE: '使用中',
    MAINTENANCE: '维护中',
    STOPPED: '停用',
    FROZEN: '冻结',
};
export const factoryEquipmentStatusLabel = factoryCapacityEquipmentStatusLabel;
// tier 对应的 type 选项
export const typesByTier = {
    CENTRAL: [
        'CENTRAL_GARMENT', 'CENTRAL_PRINT', 'CENTRAL_DYE', 'CENTRAL_CUTTING', 'CENTRAL_SPECIAL',
        'CENTRAL_AUX', 'CENTRAL_LACE', 'CENTRAL_RIBBON', 'CENTRAL_WOOL',
        'CENTRAL_POD', 'CENTRAL_DENIM_WASH',
    ],
    SATELLITE: ['SATELLITE_SEWING', 'SATELLITE_FINISHING'],
    THIRD_PARTY: ['THIRD_SEWING'],
};
