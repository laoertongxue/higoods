export const FACTORY_SAMPLE_VERIFICATION_STATUS_OPTIONS = [
    '待工厂确认收样',
    '待工厂提交样衣审核',
    '待平台审核样衣',
    '样衣审核退回',
    '样衣审核拒绝',
    '样衣审核通过',
];
export const FACTORY_SAMPLE_VERIFICATION_NODE_OPTIONS = [
    '平台发放样衣',
    '工厂确认收样',
    '工厂提交样衣审核',
    '平台审核样衣',
    '样衣验证完成',
];
export const FACTORY_SAMPLE_ISSUE_METHOD_OPTIONS = [
    '现场发放',
    '快递发放',
    '业务带样',
    '其他',
];
export const FACTORY_SAMPLE_VERIFICATION_PURPOSE_OPTIONS = [
    '检验车缝能力',
    '检验后道能力',
    '检验裁床能力',
    '检验印花能力',
    '检验染色能力',
    '检验特殊工艺能力',
    '检验质量稳定性',
    '检验交期配合度',
];
export const FACTORY_SAMPLE_REVIEW_RESULT_OPTIONS = [
    '已通过',
    '未通过',
];
const LEGACY_SAMPLE_REVIEW_APPROVED = '通' + '过';
const LEGACY_SAMPLE_REVIEW_RETURNED = '不通过且允许再次' + '提交';
const LEGACY_SAMPLE_REVIEW_REJECTED = '不通过且不允许再次' + '提交';
const LEGACY_PLATFORM_REVIEW_RETURNED = '不通过且允许再次' + '申请';
const LEGACY_PLATFORM_REVIEW_REJECTED = '不通过且不允许再次' + '申请';
export function normalizeSampleReviewResult(result) {
    if (result === '已通过' || result === LEGACY_SAMPLE_REVIEW_APPROVED)
        return '已通过';
    if (result === '未通过' ||
        result === LEGACY_SAMPLE_REVIEW_RETURNED ||
        result === LEGACY_SAMPLE_REVIEW_REJECTED ||
        result === LEGACY_PLATFORM_REVIEW_RETURNED ||
        result === LEGACY_PLATFORM_REVIEW_REJECTED)
        return '未通过';
    return '未通过';
}
export const FACTORY_SAMPLE_REVIEW_REQUIRED_ITEM_OPTIONS = [
    '样衣照片',
    '样衣视频',
    '工厂照片',
    '工厂视频',
    '工艺说明',
    '问题说明',
    '补充文件',
    '其他',
];
export const FACTORY_SAMPLE_QUALITY_CONCLUSION_OPTIONS = [
    '达标',
    '基本达标',
    '不达标',
];
export const FACTORY_SAMPLE_CAPACITY_CONCLUSION_OPTIONS = [
    '具备合作能力',
    '需补充验证',
    '不具备合作能力',
];
export const FACTORY_BOSS_IDENTITY_SOURCE_OPTIONS = [
    '工厂提交',
    '平台补录',
    '工厂提交和平台补录',
];
