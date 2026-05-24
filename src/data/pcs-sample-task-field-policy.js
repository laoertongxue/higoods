export const FIRST_SAMPLE_NODE_ENTRY_REQUIRED_FIELDS = [
    { fieldKey: 'sourceTechPackVersionId', label: '来源技术包版本' },
    { fieldKey: 'factoryId', label: '打样工厂' },
    { fieldKey: 'targetSite', label: '打样区域' },
    { fieldKey: 'sampleMaterialMode', label: '样衣材质模式' },
    { fieldKey: 'samplePurpose', label: '样衣用途' },
];
export const FIRST_SAMPLE_COMPLETION_REQUIRED_FIELDS = [
    { fieldKey: 'sampleCode', label: '结果编号' },
    { fieldKey: 'sampleImageIds', label: '样衣图片' },
    { fieldKey: 'fitConfirmationSummary', label: '版型确认说明' },
    { fieldKey: 'productionReadinessNote', label: '生产准备说明' },
    { fieldKey: 'confirmedAt', label: '确认时间' },
];
export const FIRST_SAMPLE_PROJECT_META_FIELD_KEYS = [
    'sourceTaskType',
    'sourceTaskId',
    'sourceTaskCode',
    'sourceTechPackVersionId',
    'sourceTechPackVersionCode',
    'sourceTechPackVersionLabel',
    'factoryId',
    'factoryName',
    'targetSite',
    'sampleMaterialMode',
    'samplePurpose',
    'sampleCode',
    'sampleImageIds',
    'fitConfirmationSummary',
    'artworkConfirmationSummary',
    'productionReadinessNote',
    'reuseAsFirstOrderBasisFlag',
    'reuseAsFirstOrderBasisConfirmedAt',
    'reuseAsFirstOrderBasisConfirmedBy',
    'reuseAsFirstOrderBasisNote',
    'confirmedAt',
    'sourceType',
    'upstreamModule',
    'upstreamObjectType',
    'upstreamObjectId',
    'upstreamObjectCode',
    'status',
];
function isBlankValue(value) {
    if (value == null)
        return true;
    if (Array.isArray(value))
        return value.length === 0;
    return String(value).trim() === '';
}
export function getFirstSampleNodeEntryMissingFields(input) {
    return FIRST_SAMPLE_NODE_ENTRY_REQUIRED_FIELDS
        .filter((field) => isBlankValue(input[field.fieldKey]))
        .map((field) => field.label);
}
export function getFirstSampleCompletionMissingFields(task) {
    return FIRST_SAMPLE_COMPLETION_REQUIRED_FIELDS
        .filter((field) => isBlankValue(task[field.fieldKey]))
        .map((field) => field.label);
}
export function isFirstSampleCompletedStatus(status) {
    return status === '已通过';
}
export function getFirstSampleTaskFieldPolicySummary() {
    return {
        nodeEntryRequiredFields: FIRST_SAMPLE_NODE_ENTRY_REQUIRED_FIELDS,
        completionRequiredFields: FIRST_SAMPLE_COMPLETION_REQUIRED_FIELDS,
    };
}
