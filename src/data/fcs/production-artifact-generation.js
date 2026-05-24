import { productionOrders, } from './production-orders.ts';
import { getProductionOrderProcessEntries, getProductionOrderTechPackSnapshot, } from './production-order-tech-pack-runtime.ts';
import { attachSpecialCraftTasksToProductionArtifacts, } from './special-craft-task-generation.ts';
import { getProcessCraftByCode, getProcessDefinitionByCode, getProcessStageByCode, isPostCapacityNode, listActiveProcessCraftDefinitions, } from './process-craft-dict.ts';
const DOC_TYPE_LABEL = {
    DEMAND: '需求单',
    TASK: '任务单',
};
const DEMAND_TYPE_LABEL_BY_PROCESS_CODE = {
    PRINT: '印花需求单',
    DYE: '染色需求单',
};
export const DICTIONARY_CRAFT_MOCKS_PER_DEFINITION = 3;
function toArtifactKeySegment(entryId) {
    return entryId.replace(/[^A-Za-z0-9_-]/g, '_');
}
function toMockToken(value, size) {
    const digits = value.replace(/\D/g, '');
    return (digits || value.replace(/[^A-Za-z0-9]/g, '') || '0').slice(-size).padStart(size, '0');
}
export function buildDictionaryCraftMockDocumentNo(prefix, craftCode, orderId, mockIndex) {
    return `${prefix}${toMockToken(craftCode, 7)}${toMockToken(orderId, 8)}${String(mockIndex + 1).padStart(2, '0')}`;
}
function listTechPackSourceOrders() {
    return productionOrders
        .map((order) => ({
        order,
        snapshot: getProductionOrderTechPackSnapshot(order.productionOrderId),
    }))
        .filter((item) => Boolean(item.snapshot));
}
function getMockSourceForCraft(craftIndex, mockIndex) {
    const sourceOrders = listTechPackSourceOrders();
    if (!sourceOrders.length)
        return null;
    return sourceOrders[(craftIndex * DICTIONARY_CRAFT_MOCKS_PER_DEFINITION + mockIndex) % sourceOrders.length];
}
export function getDictionaryCraftMockSource(craftCode, mockIndex) {
    const craftIndex = listActiveProcessCraftDefinitions().findIndex((definition) => definition.craftCode === craftCode);
    if (craftIndex < 0)
        return null;
    return getMockSourceForCraft(craftIndex, mockIndex);
}
function toPublishedSamUnitLabel(unit) {
    if (unit === 'MINUTE_PER_BATCH')
        return '分钟/批';
    if (unit === 'MINUTE_PER_METER')
        return '分钟/米';
    if (unit === 'MINUTE_PER_DOZEN')
        return '分钟/打';
    return '分钟/件';
}
function toCoverageSortKey(definition, mockIndex) {
    const stageSort = getProcessStageByCode(definition.stageCode)?.sort ?? 999;
    const processSort = getProcessDefinitionByCode(definition.processCode)?.sort ?? 999;
    return `${String(stageSort).padStart(3, '0')}-${String(processSort).padStart(3, '0')}-${String(definition.legacyValue).padStart(7, '0')}-${String(mockIndex).padStart(3, '0')}`;
}
function toCoverageSourceEntryId(definition, mockIndex, snapshotId) {
    return `DICT-MOCK-${definition.craftCode}-${String(mockIndex + 1).padStart(2, '0')}-${snapshotId}`;
}
function toCoverageTargetObject(definition) {
    if (definition.isSpecialCraft)
        return definition.supportedTargetObjectLabels[0] || definition.targetObjectName;
    if (definition.processCode === 'WOOL')
        return definition.targetObjectName;
    return undefined;
}
function buildDictionaryCoverageBase(definition, craftIndex, mockIndex) {
    const source = getMockSourceForCraft(craftIndex, mockIndex);
    if (!source)
        return null;
    const processDefinition = getProcessDefinitionByCode(definition.processCode);
    const stageDefinition = getProcessStageByCode(definition.stageCode);
    const linkedBomItem = source.snapshot.bomItems[0];
    const sourceEntryId = toCoverageSourceEntryId(definition, mockIndex, source.snapshot.snapshotId);
    return {
        artifactId: `DICT-${definition.defaultDocType}-${definition.craftCode}-${source.order.productionOrderId}-${mockIndex + 1}`,
        artifactType: definition.defaultDocType,
        orderId: source.order.productionOrderId,
        techPackId: source.snapshot.sourceTechPackVersionId,
        orderQty: resolveOrderQty(source.order.productionOrderId),
        sourceEntryId,
        sourceEntryType: 'CRAFT',
        stageCode: definition.stageCode,
        stageName: stageDefinition?.stageName ?? definition.stageCode,
        processCode: definition.processCode,
        processName: processDefinition?.processName ?? definition.processCode,
        systemProcessCode: definition.systemProcessCode,
        craftCode: definition.craftCode,
        craftName: definition.craftName,
        assignmentGranularity: definition.assignmentGranularity,
        ruleSource: definition.ruleSource,
        detailSplitMode: definition.detailSplitMode,
        detailSplitDimensions: [...definition.detailSplitDimensions],
        defaultDocType: definition.defaultDocType,
        taskTypeMode: definition.taskTypeMode,
        isSpecialCraft: definition.isSpecialCraft,
        selectedTargetObject: toCoverageTargetObject(definition),
        woolTaskType: definition.processCode === 'WOOL'
            ? definition.craftName === '部位毛织'
                ? 'PART_PANEL'
                : 'WHOLE_GARMENT'
            : undefined,
        downstreamTarget: definition.processCode === 'WOOL'
            ? definition.craftName === '部位毛织'
                ? '裁床待交出仓'
                : '后道工厂'
            : undefined,
        requiresFeiTicket: definition.processCode === 'WOOL' && definition.craftName === '部位毛织',
        packagingRequired: definition.processCode === 'WOOL' && definition.craftName === '整件毛织' ? false : undefined,
        materialIssueMode: definition.processCode === 'WOOL' ? 'WAREHOUSE_DELIVERY' : undefined,
        linkedBomItemIds: linkedBomItem ? [linkedBomItem.id] : undefined,
        linkedPatternIds: undefined,
        docTypeLabel: definition.defaultDocType === 'DEMAND' ? `${definition.craftName}需求单` : DOC_TYPE_LABEL.TASK,
        sortKey: `${toCoverageSortKey(definition, mockIndex)}-${source.order.productionOrderId}`,
    };
}
function buildDictionaryCoverageDemandArtifact(definition, craftIndex, mockIndex) {
    const base = buildDictionaryCoverageBase(definition, craftIndex, mockIndex);
    if (!base || base.artifactType !== 'DEMAND')
        return null;
    const demandTypeLabel = `${definition.craftName}需求单`;
    return {
        ...base,
        artifactType: 'DEMAND',
        docTypeLabel: demandTypeLabel,
        demandTypeCode: `DEMAND_${definition.craftCode}`,
        demandTypeLabel,
    };
}
function buildDictionaryCoverageTaskArtifact(definition, craftIndex, mockIndex) {
    const base = buildDictionaryCoverageBase(definition, craftIndex, mockIndex);
    if (!base || base.artifactType !== 'TASK')
        return null;
    return {
        ...base,
        artifactType: 'TASK',
        docTypeLabel: DOC_TYPE_LABEL.TASK,
        taskTypeCode: definition.craftCode,
        taskTypeLabel: definition.craftName,
        taskScope: definition.processRole === 'INTERNAL_CAPACITY_NODE' ? 'POST_ROLLUP_TASK' : 'EXTERNAL_TASK',
        publishedSamPerUnit: definition.referencePublishedSamValue,
        publishedSamUnit: toPublishedSamUnitLabel(definition.referencePublishedSamUnit),
        publishedSamDifficulty: 'MEDIUM',
        publishedSamSource: 'TECH_PACK_PROCESS_ENTRY',
    };
}
function listDictionaryCoverageDemandArtifacts() {
    return listActiveProcessCraftDefinitions()
        .flatMap((definition, craftIndex) => {
        if (definition.defaultDocType !== 'DEMAND')
            return [];
        return Array.from({ length: DICTIONARY_CRAFT_MOCKS_PER_DEFINITION }, (_, mockIndex) => buildDictionaryCoverageDemandArtifact(definition, craftIndex, mockIndex));
    })
        .filter((item) => Boolean(item));
}
function listDictionaryCoverageTaskArtifacts() {
    return listActiveProcessCraftDefinitions()
        .flatMap((definition, craftIndex) => {
        if (definition.defaultDocType !== 'TASK')
            return [];
        return Array.from({ length: DICTIONARY_CRAFT_MOCKS_PER_DEFINITION }, (_, mockIndex) => buildDictionaryCoverageTaskArtifact(definition, craftIndex, mockIndex));
    })
        .filter((item) => Boolean(item));
}
function ensureDictionaryCoverage(existingArtifacts, coverageArtifacts, definitions) {
    const result = [...existingArtifacts];
    for (const definition of definitions) {
        const existingCount = result.filter((artifact) => artifact.craftCode === definition.craftCode).length;
        if (existingCount >= DICTIONARY_CRAFT_MOCKS_PER_DEFINITION)
            continue;
        result.push(...coverageArtifacts
            .filter((artifact) => artifact.craftCode === definition.craftCode)
            .slice(0, DICTIONARY_CRAFT_MOCKS_PER_DEFINITION - existingCount));
    }
    return result.sort((a, b) => {
        if (a.orderId !== b.orderId)
            return a.orderId.localeCompare(b.orderId);
        return a.sortKey.localeCompare(b.sortKey);
    });
}
function resolveOrderQty(orderId) {
    const order = productionOrders.find((item) => item.productionOrderId === orderId);
    if (!order)
        return 0;
    return order.demandSnapshot.skuLines.reduce((sum, line) => sum + line.qty, 0);
}
function resolveEntryContext(orderId, entry, entryIndex) {
    const processDefinition = getProcessDefinitionByCode(entry.processCode);
    const craftDefinition = entry.craftCode ? getProcessCraftByCode(entry.craftCode) : undefined;
    const stageCode = (entry.stageCode || processDefinition?.stageCode || craftDefinition?.stageCode || 'PROD');
    const stageDefinition = getProcessStageByCode(stageCode);
    const fallbackRuleSource = entry.entryType === 'CRAFT' && (entry.isSpecialCraft || craftDefinition?.isSpecialCraft)
        ? 'OVERRIDE_CRAFT'
        : 'INHERIT_PROCESS';
    const fallbackGranularity = processDefinition?.assignmentGranularity
        || craftDefinition?.assignmentGranularity
        || 'ORDER';
    const fallbackSplitMode = processDefinition?.detailSplitMode
        || craftDefinition?.detailSplitMode
        || 'COMPOSITE';
    const fallbackSplitDimensions = processDefinition?.detailSplitDimensions?.length
        ? processDefinition.detailSplitDimensions
        : craftDefinition?.detailSplitDimensions?.length
            ? craftDefinition.detailSplitDimensions
            : fallbackGranularity === 'SKU' || fallbackGranularity === 'DETAIL'
                ? ['GARMENT_SKU']
                : fallbackGranularity === 'COLOR'
                    ? ['GARMENT_COLOR', 'MATERIAL_SKU']
                    : ['PATTERN', 'MATERIAL_SKU'];
    const resolvedRuleSource = entry.ruleSource || craftDefinition?.ruleSource || fallbackRuleSource;
    const publishedSamPerUnit = Number.isFinite(entry.standardTimeMinutes)
        ? Number(entry.standardTimeMinutes)
        : 0;
    const publishedSamUnit = entry.timeUnit?.trim() || '分钟/件';
    const publishedSamDifficulty = entry.difficulty || 'MEDIUM';
    return {
        orderId,
        orderQty: resolveOrderQty(orderId),
        techPackId: '',
        sourceEntry: entry,
        sourceEntryId: entry.id,
        stageCode,
        stageName: entry.stageName || stageDefinition?.stageName || stageCode,
        stageSort: stageDefinition?.sort ?? 999,
        processCode: entry.processCode,
        processName: entry.processName || processDefinition?.processName || entry.processCode,
        processSort: processDefinition?.sort ?? 999,
        systemProcessCode: processDefinition?.systemProcessCode || craftDefinition?.systemProcessCode || `PROC_${entry.processCode}`,
        craftCode: entry.craftCode,
        craftName: entry.craftName,
        processRole: craftDefinition?.processRole ?? processDefinition?.processRole ?? 'EXTERNAL_TASK',
        parentProcessCode: craftDefinition?.parentProcessCode ?? processDefinition?.parentProcessCode,
        generatesExternalTask: craftDefinition?.generatesExternalTask ?? processDefinition?.generatesExternalTask ?? false,
        requiresTaskQr: craftDefinition?.requiresTaskQr ?? processDefinition?.requiresTaskQr ?? false,
        requiresHandoverOrder: craftDefinition?.requiresHandoverOrder ?? processDefinition?.requiresHandoverOrder ?? false,
        capacityEnabled: craftDefinition?.capacityEnabled ?? processDefinition?.capacityEnabled ?? true,
        capacityRollupMode: craftDefinition?.capacityRollupMode ?? processDefinition?.capacityRollupMode ?? 'NONE',
        factoryMobileExecutionMode: craftDefinition?.factoryMobileExecutionMode
            ?? processDefinition?.factoryMobileExecutionMode
            ?? 'NONE',
        isActive: craftDefinition?.isActive ?? processDefinition?.isActive ?? true,
        assignmentGranularity: entry.assignmentGranularity || fallbackGranularity,
        ruleSource: resolvedRuleSource,
        detailSplitMode: entry.detailSplitMode || craftDefinition?.detailSplitMode || fallbackSplitMode,
        detailSplitDimensions: entry.detailSplitDimensions?.length
            ? [...entry.detailSplitDimensions]
            : [...fallbackSplitDimensions],
        defaultDocType: entry.defaultDocType || processDefinition?.defaultDocType || craftDefinition?.defaultDocType || 'TASK',
        taskTypeMode: entry.taskTypeMode || processDefinition?.taskTypeMode || craftDefinition?.taskTypeMode || 'PROCESS',
        isSpecialCraft: entry.isSpecialCraft ?? craftDefinition?.isSpecialCraft ?? false,
        publishedSamPerUnit,
        publishedSamUnit,
        publishedSamDifficulty,
        publishedSamSource: 'TECH_PACK_PROCESS_ENTRY',
        entryIndex,
    };
}
function buildSortKey(context) {
    return `${String(context.stageSort).padStart(3, '0')}-${String(context.processSort).padStart(3, '0')}-${String(context.entryIndex).padStart(3, '0')}-${context.sourceEntryId}`;
}
function toDemandArtifact(context) {
    const demandTypeLabel = DEMAND_TYPE_LABEL_BY_PROCESS_CODE[context.processCode] ?? `${context.processName}需求单`;
    return {
        artifactId: `DEMART-${context.orderId}-${toArtifactKeySegment(context.sourceEntryId)}`,
        artifactType: 'DEMAND',
        orderId: context.orderId,
        techPackId: context.techPackId,
        orderQty: context.orderQty,
        sourceEntryId: context.sourceEntryId,
        sourceEntryType: context.sourceEntry.entryType,
        stageCode: context.stageCode,
        stageName: context.stageName,
        processCode: context.processCode,
        processName: context.processName,
        systemProcessCode: context.systemProcessCode,
        craftCode: context.craftCode,
        craftName: context.craftName,
        assignmentGranularity: context.assignmentGranularity,
        ruleSource: context.ruleSource,
        detailSplitMode: context.detailSplitMode,
        detailSplitDimensions: [...context.detailSplitDimensions],
        defaultDocType: context.defaultDocType,
        taskTypeMode: context.taskTypeMode,
        isSpecialCraft: context.isSpecialCraft,
        docTypeLabel: demandTypeLabel,
        demandTypeCode: `DEMAND_${context.processCode}`,
        demandTypeLabel,
        sortKey: buildSortKey(context),
    };
}
function toTaskArtifact(context) {
    const isCraftTask = context.sourceEntry.entryType === 'CRAFT' || context.taskTypeMode === 'CRAFT';
    const taskTypeCode = isCraftTask ? context.craftCode || context.processCode : context.processCode;
    const taskTypeLabel = isCraftTask ? context.craftName || context.processName : context.processName;
    return {
        artifactId: `TASKART-${context.orderId}-${toArtifactKeySegment(context.sourceEntryId)}`,
        artifactType: 'TASK',
        orderId: context.orderId,
        techPackId: context.techPackId,
        orderQty: context.orderQty,
        sourceEntryId: context.sourceEntryId,
        sourceEntryType: context.sourceEntry.entryType,
        stageCode: context.stageCode,
        stageName: context.stageName,
        processCode: context.processCode,
        processName: context.processName,
        systemProcessCode: context.systemProcessCode,
        craftCode: context.craftCode,
        craftName: context.craftName,
        assignmentGranularity: context.assignmentGranularity,
        ruleSource: context.ruleSource,
        detailSplitMode: context.detailSplitMode,
        detailSplitDimensions: [...context.detailSplitDimensions],
        defaultDocType: context.defaultDocType,
        taskTypeMode: context.taskTypeMode,
        isSpecialCraft: context.isSpecialCraft,
        selectedTargetObject: context.sourceEntry.selectedTargetObject,
        woolTaskType: context.sourceEntry.woolTaskType,
        downstreamTarget: context.sourceEntry.downstreamTarget,
        requiresFeiTicket: context.sourceEntry.requiresFeiTicket,
        packagingRequired: context.sourceEntry.packagingRequired,
        materialIssueMode: context.sourceEntry.materialIssueMode,
        linkedBomItemIds: context.sourceEntry.linkedBomItemIds ? [...context.sourceEntry.linkedBomItemIds] : undefined,
        linkedPatternIds: context.sourceEntry.linkedPatternIds ? [...context.sourceEntry.linkedPatternIds] : undefined,
        docTypeLabel: DOC_TYPE_LABEL.TASK,
        taskTypeCode,
        taskTypeLabel,
        taskScope: 'EXTERNAL_TASK',
        publishedSamPerUnit: context.publishedSamPerUnit,
        publishedSamUnit: context.publishedSamUnit,
        publishedSamDifficulty: context.publishedSamDifficulty,
        publishedSamSource: context.publishedSamSource,
        sortKey: buildSortKey(context),
    };
}
function shouldGenerateDemand(entry, context) {
    return (entry.entryType === 'PROCESS_BASELINE' &&
        context.stageCode === 'PREP' &&
        context.defaultDocType === 'DEMAND' &&
        (context.processCode === 'PRINT' || context.processCode === 'DYE'));
}
function isExternalTaskProcessCode(processCode) {
    return getProcessDefinitionByCode(processCode)?.generatesExternalTask ?? false;
}
function shouldGenerateExternalTask(context) {
    if (!context.isActive)
        return false;
    if (!context.generatesExternalTask)
        return false;
    if (context.defaultDocType !== 'TASK')
        return false;
    if (context.sourceEntry.entryType === 'CRAFT')
        return true;
    return context.processCode === 'POST_FINISHING';
}
function shouldRollupToPostFinishing(context) {
    return context.isActive && isPostCapacityNode(context.processCode);
}
function mergeTaskDifficulty(left, right) {
    const score = {
        LOW: 1,
        MEDIUM: 2,
        HIGH: 3,
    };
    return score[left] >= score[right] ? left : right;
}
function createPostFinishingRollupArtifact(baseContext, childContexts, directPostArtifact) {
    const processDefinition = getProcessDefinitionByCode('POST_FINISHING');
    if (!processDefinition) {
        throw new Error('缺少后道工序定义，无法生成后道汇总任务');
    }
    const rolledUpChildren = childContexts.reduce((result, item) => {
        const alreadyExists = result.some((current) => current.code === item.processCode);
        if (!alreadyExists) {
            result.push({ code: item.processCode, name: item.processName });
        }
        return result;
    }, []);
    const publishedSamPerUnit = childContexts.length > 0
        ? childContexts.reduce((sum, item) => sum + Math.max(item.publishedSamPerUnit, 0), 0)
        : directPostArtifact?.publishedSamPerUnit || baseContext.publishedSamPerUnit;
    const publishedSamDifficulty = childContexts.reduce((level, item) => mergeTaskDifficulty(level, item.publishedSamDifficulty), directPostArtifact?.publishedSamDifficulty || baseContext.publishedSamDifficulty);
    const postContext = {
        ...baseContext,
        processCode: processDefinition.processCode,
        processName: processDefinition.processName,
        processSort: processDefinition.sort,
        systemProcessCode: processDefinition.systemProcessCode,
        craftCode: undefined,
        craftName: undefined,
        processRole: processDefinition.processRole,
        parentProcessCode: processDefinition.parentProcessCode,
        generatesExternalTask: processDefinition.generatesExternalTask,
        requiresTaskQr: processDefinition.requiresTaskQr,
        requiresHandoverOrder: processDefinition.requiresHandoverOrder,
        capacityEnabled: processDefinition.capacityEnabled,
        capacityRollupMode: processDefinition.capacityRollupMode,
        factoryMobileExecutionMode: processDefinition.factoryMobileExecutionMode,
        isActive: processDefinition.isActive,
        assignmentGranularity: processDefinition.assignmentGranularity,
        detailSplitMode: processDefinition.detailSplitMode,
        detailSplitDimensions: [...processDefinition.detailSplitDimensions],
        defaultDocType: processDefinition.defaultDocType,
        taskTypeMode: processDefinition.taskTypeMode,
        isSpecialCraft: false,
        publishedSamPerUnit,
        publishedSamUnit: directPostArtifact?.publishedSamUnit || baseContext.publishedSamUnit,
        publishedSamDifficulty,
    };
    return {
        ...toTaskArtifact(postContext),
        taskTypeCode: processDefinition.processCode,
        taskTypeLabel: processDefinition.processName,
        taskScope: 'POST_ROLLUP_TASK',
        rolledUpChildProcessCodes: rolledUpChildren.map((item) => item.code),
        rolledUpChildProcessNames: rolledUpChildren.map((item) => item.name),
        publishedSamPerUnit,
        publishedSamUnit: directPostArtifact?.publishedSamUnit || baseContext.publishedSamUnit,
        publishedSamDifficulty,
    };
}
function resolveTechPackIdByOrder(orderId) {
    return getProductionOrderTechPackSnapshot(orderId)?.sourceTechPackVersionId ?? null;
}
function resolveTechPackEntriesByOrder(orderId) {
    return getProductionOrderProcessEntries(orderId);
}
export function generateProductionArtifactsForOrder(orderId) {
    const techPackId = resolveTechPackIdByOrder(orderId);
    if (!techPackId)
        return [];
    const entries = resolveTechPackEntriesByOrder(orderId);
    if (!entries.length)
        return [];
    const artifacts = [];
    const taskContexts = [];
    entries.forEach((entry, index) => {
        const context = resolveEntryContext(orderId, entry, index);
        context.techPackId = techPackId;
        if (shouldGenerateDemand(entry, context)) {
            artifacts.push(toDemandArtifact(context));
            return;
        }
        if (shouldRollupToPostFinishing(context) || shouldGenerateExternalTask(context)) {
            taskContexts.push(context);
        }
    });
    const directTaskContexts = taskContexts.filter((item) => !shouldRollupToPostFinishing(item));
    const postChildContexts = taskContexts.filter((item) => shouldRollupToPostFinishing(item));
    const directTaskArtifacts = directTaskContexts.map((context) => toTaskArtifact(context));
    const directPostArtifact = directTaskArtifacts.find((item) => item.processCode === 'POST_FINISHING');
    const directNonPostArtifacts = directTaskArtifacts.filter((item) => item.processCode !== 'POST_FINISHING');
    if (postChildContexts.length > 0 || directPostArtifact) {
        const baseContext = directTaskContexts.find((item) => item.processCode === 'POST_FINISHING') || postChildContexts[0];
        if (baseContext) {
            artifacts.push(createPostFinishingRollupArtifact(baseContext, postChildContexts, directPostArtifact));
        }
    }
    artifacts.push(...directNonPostArtifacts);
    return artifacts.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}
export function generateProductionArtifactBundleForOrder(orderId) {
    const artifacts = generateProductionArtifactsForOrder(orderId);
    const attachment = attachSpecialCraftTasksToProductionArtifacts({
        orderId,
        artifacts,
    });
    return {
        orderId,
        artifacts: attachment.artifacts,
        specialCraftTaskOrders: attachment.specialCraftTaskOrders,
        specialCraftGenerationBatch: attachment.specialCraftGenerationBatch,
        specialCraftGenerationErrors: attachment.specialCraftGenerationErrors,
        specialCraftGenerationWarnings: attachment.specialCraftGenerationWarnings,
    };
}
export function generateDemandArtifactsForOrder(orderId) {
    return generateProductionArtifactsForOrder(orderId).filter((item) => item.artifactType === 'DEMAND');
}
export function generateTaskArtifactsForOrder(orderId) {
    return generateProductionArtifactsForOrder(orderId).filter((item) => item.artifactType === 'TASK');
}
export function generateProductionArtifactsForAllOrders() {
    return productionOrders
        .flatMap((order) => generateProductionArtifactsForOrder(order.productionOrderId))
        .sort((a, b) => {
        if (a.orderId !== b.orderId)
            return a.orderId.localeCompare(b.orderId);
        return a.sortKey.localeCompare(b.sortKey);
    });
}
export function generateProductionArtifactBundlesForAllOrders() {
    return productionOrders.map((order) => generateProductionArtifactBundleForOrder(order.productionOrderId));
}
export function generateDemandArtifactsForAllOrders() {
    const generatedArtifacts = generateProductionArtifactsForAllOrders().filter((item) => item.artifactType === 'DEMAND');
    const demandDefinitions = listActiveProcessCraftDefinitions().filter((definition) => definition.defaultDocType === 'DEMAND');
    return ensureDictionaryCoverage(generatedArtifacts, listDictionaryCoverageDemandArtifacts(), demandDefinitions);
}
export function listGeneratedProductionDemandArtifacts() {
    return generateDemandArtifactsForAllOrders();
}
export function generateTaskArtifactsForAllOrders() {
    const generatedArtifacts = generateProductionArtifactsForAllOrders().filter((item) => item.artifactType === 'TASK');
    const taskDefinitions = listActiveProcessCraftDefinitions().filter((definition) => definition.defaultDocType === 'TASK');
    return ensureDictionaryCoverage(generatedArtifacts, listDictionaryCoverageTaskArtifacts(), taskDefinitions);
}
export function listGeneratedProductionTaskArtifacts() {
    return generateTaskArtifactsForAllOrders();
}
export function listGeneratedSpecialCraftTaskArtifacts() {
    return generateProductionArtifactBundlesForAllOrders().flatMap((bundle) => bundle.specialCraftTaskOrders);
}
export const artifactGenerationScenarioOrderIds = {
    prepOnly: 'PO-202603-0014',
    normalProduction: 'PO-202603-0002',
    specialCraft: 'PO-202603-0015',
    postProcess: 'PO-202603-0002',
    mixed: 'PO-202603-0015',
};
export function listArtifactGenerationScenarioArtifacts() {
    return {
        prepOnly: generateProductionArtifactsForOrder(artifactGenerationScenarioOrderIds.prepOnly),
        normalProduction: generateProductionArtifactsForOrder(artifactGenerationScenarioOrderIds.normalProduction),
        specialCraft: generateProductionArtifactsForOrder(artifactGenerationScenarioOrderIds.specialCraft),
        postProcess: generateProductionArtifactsForOrder(artifactGenerationScenarioOrderIds.postProcess),
        mixed: generateProductionArtifactsForOrder(artifactGenerationScenarioOrderIds.mixed),
    };
}
