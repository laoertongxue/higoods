export const FACTORY_ADMIN_ROLE_ID = 'FACTORY_ADMIN';
export const FACTORY_ADMIN_ROLE_NAME = '工厂管理员';
export const FACTORY_ONBOARDING_STATUS_OPTIONS = [
    '草稿',
    '待平台审核',
    '平台审核退回',
    '平台审核拒绝',
    '待样衣验证',
    '待工厂确认收样',
    '待工厂提交样衣审核',
    '待平台审核样衣',
    '样衣审核退回',
    '样衣审核拒绝',
    '样衣审核通过待转正式',
    '已转正式合作',
];
const LEGACY_SUBMITTED_STATUS = '已提交待' + '审核';
const LEGACY_RETURNED_STATUS = '退回补充' + '资料';
const LEGACY_RESUBMITTED_STATUS = '已重新提交待' + '审核';
const LEGACY_APPROVED_STATUS = '审核通过待确认' + '合作';
const LEGACY_REJECTED_STATUS = '已拒' + '绝';
const LEGACY_COOPERATED_STATUS = '已合' + '作';
export const FACTORY_ONBOARDING_LEGACY_STATUS_MAP = {
    [LEGACY_SUBMITTED_STATUS]: '待平台审核',
    [LEGACY_RETURNED_STATUS]: '平台审核退回',
    [LEGACY_RESUBMITTED_STATUS]: '待平台审核',
    [LEGACY_APPROVED_STATUS]: '待样衣验证',
    [LEGACY_REJECTED_STATUS]: '平台审核拒绝',
    [LEGACY_COOPERATED_STATUS]: '已转正式合作',
};
export const FACTORY_ONBOARDING_NODE_OPTIONS = [
    '填写入驻申请',
    '平台审核',
    '样衣验证',
    '样衣审核',
    '正式合作',
    '完成',
];
export const FACTORY_ONBOARDING_NODE_STATUS_OPTIONS = [
    '未开始',
    '进行中',
    '已完成',
    '已退回',
    '已终止',
];
export const FACTORY_ONBOARDING_MACHINE_CONDITIONS = ['可用', '维修中', '停用'];
export const FACTORY_ONBOARDING_MACHINE_VALIDATION_STATUS_OPTIONS = [
    '通过',
    '未关联工序',
    '未关联工艺',
    '工序工艺未在接单能力中选择',
];
export const FACTORY_ONBOARDING_REVIEW_RESULTS = [
    '已通过',
    '未通过',
];
const LEGACY_REVIEW_APPROVED = '通' + '过';
const LEGACY_REVIEW_RETURNED = '不通过且允许再次' + '申请';
const LEGACY_REVIEW_REJECTED = '不通过且不允许再次' + '申请';
const LEGACY_SAMPLE_REVIEW_RETURNED = '不通过且允许再次' + '提交';
const LEGACY_SAMPLE_REVIEW_REJECTED = '不通过且不允许再次' + '提交';
export function normalizeReviewResult(result) {
    if (result === '已通过' || result === LEGACY_REVIEW_APPROVED)
        return '已通过';
    if (result === '未通过' ||
        result === LEGACY_REVIEW_RETURNED ||
        result === LEGACY_REVIEW_REJECTED ||
        result === LEGACY_SAMPLE_REVIEW_RETURNED ||
        result === LEGACY_SAMPLE_REVIEW_REJECTED)
        return '未通过';
    return '未通过';
}
export const FACTORY_ONBOARDING_SUPPLEMENT_STATUS_OPTIONS = ['待补充', '已补充', '已重新提交'];
export const FACTORY_ONBOARDING_COMPLETENESS_LEVEL_OPTIONS = ['不完整', '基本完整', '完整', '高完整'];
export const FACTORY_INFERRED_TYPE_CODE_OPTIONS = [
    'CUTTING_FACTORY',
    'PRINTING_FACTORY',
    'DYEING_FACTORY',
    'POST_FINISHING_FACTORY',
    'SPECIAL_CRAFT_FACTORY',
    'SEWING_FACTORY',
    'MULTI_CAPABILITY_FACTORY',
];
export const FACTORY_ONBOARDING_REQUIRED_FIELD_OPTIONS = [
    '工厂简称',
    '姓名',
    '身份证号码/护照号码',
    '身份证复印件/电子文件',
    '工厂/公司名称',
    '地址',
    '手机号',
    '来源',
    '收到此通知的 PPIC 姓名',
    '机器数量',
    '有效工人数量',
    '可开始合作时间',
    '工序工艺能力',
    '机器明细',
];
export const FACTORY_ONBOARDING_ACTION_NAME_OPTIONS = [
    '保存草稿',
    '提交入驻申请',
    '工厂重新提交',
    '平台初审已通过',
    '平台初审未通过',
    '平台初审通过',
    '平台初审退回',
    '平台初审拒绝',
    '平台登记并发放样衣',
    '工厂确认收到样衣',
    '工厂提交样衣审核',
    '工厂重新提交样衣审核',
    '平台样衣审核通过',
    '平台样衣审核退回',
    '平台样衣审核拒绝',
    '样衣审核未通过',
    '样衣状态更新',
    '样衣通过后转正式合作',
    '转正式合作',
];
export const FACTORY_ONBOARDING_ADMIN_ACCOUNT_STATUS = [
    '入驻中',
    '待激活',
    '待转正式',
    '已转正式',
    '已停用',
    '已锁定',
];
export function normalizeOnboardingStatus(status) {
    if (status && FACTORY_ONBOARDING_STATUS_OPTIONS.includes(status)) {
        return status;
    }
    if (status && status in FACTORY_ONBOARDING_LEGACY_STATUS_MAP) {
        return FACTORY_ONBOARDING_LEGACY_STATUS_MAP[status];
    }
    return '草稿';
}
export function migrateOnboardingStatus(status) {
    return normalizeOnboardingStatus(status);
}
export function getOnboardingNodeByStatus(status) {
    const normalized = normalizeOnboardingStatus(status);
    if (normalized === '草稿' || normalized === '平台审核退回')
        return '填写入驻申请';
    if (normalized === '待平台审核')
        return '平台审核';
    if (normalized === '待样衣验证' ||
        normalized === '待工厂确认收样' ||
        normalized === '待工厂提交样衣审核' ||
        normalized === '样衣审核退回')
        return '样衣验证';
    if (normalized === '待平台审核样衣')
        return '样衣审核';
    if (normalized === '样衣审核通过待转正式')
        return '正式合作';
    return '完成';
}
export function canFactoryEditOnboarding(status) {
    const normalized = normalizeOnboardingStatus(status);
    return normalized === '草稿' || normalized === '平台审核退回';
}
export function canFactorySubmitOnboarding(status) {
    return canFactoryEditOnboarding(status);
}
export function canFactoryEnterBusiness(status) {
    return normalizeOnboardingStatus(status) === '已转正式合作';
}
export function isFactoryAccountLocked(status) {
    void status;
    return false;
}
export function canCreateFactoryProfile(status) {
    return normalizeOnboardingStatus(status) === '样衣审核通过待转正式';
}
export function isRejectedStatusLegacy(status) {
    const normalized = normalizeOnboardingStatus(status);
    return normalized === '平台审核拒绝' || normalized === '样衣审核拒绝';
}
export function canFactoryResubmitAfterReviewFailed(status) {
    return normalizeOnboardingStatus(status) === '平台审核退回';
}
export function canFactoryResubmitSampleAfterReviewFailed(status) {
    return normalizeOnboardingStatus(status) === '样衣审核退回';
}
