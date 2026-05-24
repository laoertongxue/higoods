import { PUBLISHED_SAM_UNIT_LABEL, getSpecialCraftSupportedTargetObjectLabels, getProcessCraftByCode, getProcessDefinitionByCode, normalizeSpecialCraftTargetObjectLabel, listProcessCraftDefinitions, } from './process-craft-dict.ts';
export const TECH_PACK_STATUS_LABEL = {
    DRAFT: '草稿',
    ENABLED: '已启用',
    DISABLED: '未启用',
};
export const TECH_PACK_PATTERN_MATERIAL_TYPE_LABELS = {
    WOVEN: '布料纸样',
    WOOL: '毛织纸样',
    UNKNOWN: '暂无数据',
};
export const TECH_PACK_PATTERN_PARSE_STATUS_LABELS = {
    NOT_PARSED: '待解析',
    PARSING: '解析中',
    PARSED: '已解析',
    FAILED: '解析失败',
    NOT_REQUIRED: '无需解析',
};
export const TECH_PACK_PATTERN_CATEGORY_OPTIONS = ['主体片', '结构片', '装饰片', '其他'];
// 计算完整度
export function calculateCompleteness(techPack) {
    const missing = [];
    let score = 0;
    const weights = { pattern: 20, process: 25, size: 15, bom: 20, patternDesign: 10, attachment: 10 };
    if (techPack.patternFiles.length > 0 || techPack.patternDesc.trim()) {
        score += weights.pattern;
    }
    else {
        missing.push('制版文件');
    }
    if (techPack.processes.length > 0) {
        score += weights.process;
    }
    else {
        missing.push('工序表');
    }
    if (techPack.sizeTable.length > 0) {
        score += weights.size;
    }
    else {
        missing.push('尺码表');
    }
    if (techPack.bomItems.length > 0) {
        score += weights.bom;
    }
    else {
        missing.push('BOM物料');
    }
    if (techPack.patternDesigns.length > 0) {
        score += weights.patternDesign;
    }
    else {
        missing.push('花型设计');
    }
    if (techPack.attachments.length > 0) {
        score += weights.attachment;
    }
    else {
        missing.push('附件');
    }
    return { score, missing };
}
const STAGE_NAME_BY_CODE = {
    PREP: '准备阶段',
    PROD: '生产阶段',
    POST: '后道阶段',
};
const processCraftByName = new Map(listProcessCraftDefinitions().map((item) => [item.craftName, item]));
function createCraftProcessEntry(id, craftName, standardTimeMinutes, difficulty, remark, selectedTargetObject) {
    const craft = processCraftByName.get(craftName);
    if (!craft) {
        throw new Error(`未找到可用工艺定义：${craftName}`);
    }
    const process = getProcessDefinitionByCode(craft.processCode);
    if (!process) {
        throw new Error(`未找到工序定义：${craft.processCode}`);
    }
    const supportedTargetObjectLabels = getSpecialCraftSupportedTargetObjectLabels(craft.supportedTargetObjects);
    const normalizedTargetObject = normalizeSpecialCraftTargetObjectLabel(selectedTargetObject);
    const resolvedSelectedTargetObject = craft.isSpecialCraft
        ? normalizedTargetObject && supportedTargetObjectLabels.includes(normalizedTargetObject)
            ? normalizedTargetObject
            : supportedTargetObjectLabels[0]
        : undefined;
    return {
        id,
        entryType: 'CRAFT',
        stageCode: craft.stageCode,
        stageName: STAGE_NAME_BY_CODE[craft.stageCode],
        processCode: craft.processCode,
        processName: process.processName,
        craftCode: craft.craftCode,
        craftName: craft.craftName,
        assignmentGranularity: craft.assignmentGranularity,
        ruleSource: craft.ruleSource,
        detailSplitMode: craft.detailSplitMode,
        detailSplitDimensions: [...craft.detailSplitDimensions],
        defaultDocType: craft.defaultDocType,
        taskTypeMode: craft.taskTypeMode,
        isSpecialCraft: craft.isSpecialCraft,
        selectedTargetObject: resolvedSelectedTargetObject,
        supportedTargetObjects: craft.isSpecialCraft ? [...craft.supportedTargetObjects] : undefined,
        supportedTargetObjectLabels: craft.isSpecialCraft ? [...supportedTargetObjectLabels] : undefined,
        visibleFactoryTypes: craft.isSpecialCraft ? [...craft.visibleFactoryTypes] : undefined,
        standardTimeMinutes,
        timeUnit: PUBLISHED_SAM_UNIT_LABEL[craft.referencePublishedSamUnit],
        referencePublishedSamValue: craft.referencePublishedSamValue,
        referencePublishedSamUnit: craft.referencePublishedSamUnit,
        referencePublishedSamUnitLabel: PUBLISHED_SAM_UNIT_LABEL[craft.referencePublishedSamUnit],
        referencePublishedSamNote: craft.referencePublishedSamNote,
        difficulty,
        remark,
    };
}
function createPatternPieceSpecialCraft(craftName) {
    const craft = processCraftByName.get(craftName);
    if (!craft || !craft.isActive || !craft.isSpecialCraft || craft.processCode !== 'SPECIAL_CRAFT') {
        throw new Error(`未找到可用特殊工艺定义：${craftName}`);
    }
    const process = getProcessDefinitionByCode(craft.processCode);
    if (!process) {
        throw new Error(`未找到特殊工艺工序定义：${craft.processCode}`);
    }
    const supportedTargetObjectLabels = getSpecialCraftSupportedTargetObjectLabels(craft.supportedTargetObjects);
    if (!supportedTargetObjectLabels.includes('已裁部位')) {
        throw new Error(`特殊工艺「${craftName}」不支持已裁部位`);
    }
    return {
        processCode: craft.processCode,
        processName: process.processName,
        craftCode: craft.craftCode,
        craftName: craft.craftName,
        displayName: craft.craftName,
        selectedTargetObject: '已裁部位',
        supportedTargetObjects: [...craft.supportedTargetObjects],
        supportedTargetObjectLabels,
    };
}
function buildSeedDesignSvg(label, fill, width, height, subtitle) {
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
      <rect width="${width}" height="${height}" rx="20" fill="#f8fafc" />
      <rect x="24" y="24" width="${width - 48}" height="${height - 72}" rx="16" fill="${fill}" />
      <text x="${width / 2}" y="${Math.round(height / 2) - 8}" font-size="26" font-family="sans-serif" text-anchor="middle" fill="#0f172a">${label}</text>
      <text x="${width / 2}" y="${Math.round(height / 2) + 28}" font-size="14" font-family="sans-serif" text-anchor="middle" fill="#475569">${subtitle}</text>
    </svg>
  `)}`;
}
function buildSeedDesignAsset(label, fill, fileName) {
    const originalFileDataUrl = buildSeedDesignSvg(label, fill, 960, 720, fileName);
    const previewThumbnailDataUrl = buildSeedDesignSvg(label, fill, 320, 220, '缩略图预览');
    return {
        imageUrl: previewThumbnailDataUrl,
        originalFileName: fileName,
        originalFileMimeType: 'image/svg+xml',
        originalFileDataUrl,
        previewThumbnailDataUrl,
    };
}
// Mock 数据
export const techPacks = [];
function cloneTechPack(techPack) {
    return JSON.parse(JSON.stringify(techPack));
}
function getOfficialVersionNo(versionLabel) {
    const matched = versionLabel.match(/v(\d+(?:\.\d+)?)/i);
    if (!matched)
        return 0;
    return Number.parseFloat(matched[1]) || 0;
}
function buildNextOfficialVersionLabel(spuCode) {
    const maxVersion = techPacks
        .filter((item) => item.spuCode === spuCode && item.status !== 'DRAFT')
        .reduce((max, item) => Math.max(max, item.officialVersionNo ?? getOfficialVersionNo(item.versionLabel)), 0);
    return `v${(Math.floor(maxVersion) + 1).toFixed(1)}`;
}
export function listTechPacksBySpuCode(spuCode) {
    return techPacks.filter((tp) => tp.spuCode === spuCode);
}
export function getDraftTechPackBySpuCode(spuCode) {
    return techPacks.find((tp) => tp.spuCode === spuCode && tp.status === 'DRAFT');
}
export function getEnabledTechPackBySpuCode(spuCode) {
    return techPacks.find((tp) => tp.spuCode === spuCode && tp.status === 'ENABLED');
}
// 根据SPU获取技术包，优先进入草稿，其次读取已启用版本。
export function getTechPackBySpuCode(spuCode) {
    return getDraftTechPackBySpuCode(spuCode) || getEnabledTechPackBySpuCode(spuCode) || techPacks.find(tp => tp.spuCode === spuCode);
}
// 创建空白草稿技术包
export function createBetaTechPack(spuCode, spuName) {
    return {
        spuCode,
        spuName,
        status: 'DRAFT',
        versionLabel: '',
        completenessScore: 0,
        missingChecklist: ['制版文件', '工序表', '尺码表', 'BOM物料', '花型设计', '附件'],
        lastUpdatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
        lastUpdatedBy: 'System',
        patternFiles: [],
        patternDesc: '',
        processes: [],
        sizeTable: [],
        bomItems: [],
        skuCatalog: [],
        materialCostItems: [],
        processCostItems: [],
        customCostItems: [],
        colorMaterialMappings: [],
        patternDesigns: [],
        attachments: [],
    };
}
export const createDraftTechPack = createBetaTechPack;
export function createDraftTechPackForSpu(spuCode, spuName) {
    const existingDraft = getDraftTechPackBySpuCode(spuCode);
    if (existingDraft) {
        return {
            ok: false,
            message: '当前有草稿版本的技术包',
            techPack: existingDraft,
        };
    }
    const enabled = getEnabledTechPackBySpuCode(spuCode);
    const draft = enabled
        ? {
            ...cloneTechPack(enabled),
            status: 'DRAFT',
            versionLabel: '',
            officialVersionNo: undefined,
            draftSourceVersionLabel: enabled.versionLabel,
            lastUpdatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
            lastUpdatedBy: 'System',
        }
        : createBetaTechPack(spuCode, spuName || spuCode);
    techPacks.push(draft);
    return {
        ok: true,
        message: '已创建草稿',
        techPack: draft,
    };
}
export function validateTechPackForPublish(techPack) {
    const pieceSpecialCraftKeys = new Set();
    const errors = [];
    techPack.patternFiles.forEach((patternFile) => {
        ;
        (patternFile.pieceRows ?? []).forEach((pieceRow) => {
            const partName = String(pieceRow.name || '').trim() || '未命名部位';
            (pieceRow.specialCrafts ?? []).forEach((craft) => {
                const selectedTargetObject = normalizeSpecialCraftTargetObjectLabel(craft.selectedTargetObject) || '已裁部位';
                pieceSpecialCraftKeys.add(`${craft.craftCode}:${selectedTargetObject}`);
                if (craft.craftName === '捆条') {
                    if (!Number.isFinite(pieceRow.bundleLengthCm) || Number(pieceRow.bundleLengthCm) <= 0) {
                        errors.push(`裁片部位「${partName}」已关联捆条，但未填写捆条长度`);
                    }
                    if (!Number.isFinite(pieceRow.bundleWidthCm) || Number(pieceRow.bundleWidthCm) <= 0) {
                        errors.push(`裁片部位「${partName}」已关联捆条，但未填写捆条宽度`);
                    }
                }
            });
        });
    });
    (techPack.processEntries ?? [])
        .filter((entry) => entry.entryType === 'CRAFT' && entry.isSpecialCraft && entry.craftCode)
        .forEach((entry) => {
        const craft = getProcessCraftByCode(entry.craftCode || '');
        const supportedLabels = entry.supportedTargetObjectLabels?.length
            ? entry.supportedTargetObjectLabels
            : getSpecialCraftSupportedTargetObjectLabels(craft?.supportedTargetObjects ?? []);
        const selectedTargetObject = normalizeSpecialCraftTargetObjectLabel(entry.selectedTargetObject)
            || (supportedLabels.length === 1 ? supportedLabels[0] : '');
        if (!selectedTargetObject) {
            errors.push(`特殊工艺「${entry.craftName || entry.processName}」未选择作用对象`);
            return;
        }
        if (!supportedLabels.includes(selectedTargetObject)) {
            errors.push(`特殊工艺「${entry.craftName || entry.processName}」选择的作用对象不在字典范围内`);
            return;
        }
        if (selectedTargetObject === '已裁部位' && !pieceSpecialCraftKeys.has(`${entry.craftCode}:${selectedTargetObject}`)) {
            errors.push(`特殊工艺「${entry.craftName || entry.processName}」选择了已裁部位，但纸样管理中没有关联裁片部位`);
        }
    });
    return Array.from(new Set(errors));
}
export function publishTechPackDraft(spuCode) {
    const draft = getDraftTechPackBySpuCode(spuCode);
    if (!draft) {
        return { ok: false, message: '未找到草稿', errors: ['未找到草稿'] };
    }
    const errors = validateTechPackForPublish(draft);
    if (errors.length > 0) {
        return { ok: false, message: errors[0], techPack: draft, errors };
    }
    const nextVersionLabel = buildNextOfficialVersionLabel(spuCode);
    techPacks.forEach((item) => {
        if (item.spuCode === spuCode && item.status === 'ENABLED') {
            item.status = 'DISABLED';
        }
    });
    draft.status = 'ENABLED';
    draft.versionLabel = nextVersionLabel;
    draft.officialVersionNo = getOfficialVersionNo(nextVersionLabel);
    draft.draftSourceVersionLabel = undefined;
    draft.lastUpdatedAt = new Date().toISOString().replace('T', ' ').slice(0, 19);
    return { ok: true, message: '已启用', techPack: draft, errors: [] };
}
// 获取或创建技术包（如果不存在则创建草稿版本）
export function getOrCreateTechPack(spuCode, spuName) {
    let techPack = getTechPackBySpuCode(spuCode);
    if (!techPack) {
        // 如果没有提供spuName，使用spuCode创建草稿
        const finalSpuName = spuName || spuCode;
        techPack = createBetaTechPack(spuCode, finalSpuName);
        techPacks.push(techPack);
    }
    return techPack;
}
// 更新技术包
export function updateTechPack(spuCode, updates) {
    const index = techPacks.findIndex(tp => tp.spuCode === spuCode);
    if (index === -1)
        return undefined;
    techPacks[index] = { ...techPacks[index], ...updates };
    return techPacks[index];
}
function fallbackDetailDimensions(granularity) {
    if (granularity === 'SKU')
        return ['GARMENT_SKU'];
    if (granularity === 'COLOR')
        return ['GARMENT_COLOR', 'MATERIAL_SKU'];
    return ['PATTERN', 'MATERIAL_SKU'];
}
export function resolveTechPackProcessEntryRule(entry) {
    const processDef = getProcessDefinitionByCode(entry.processCode);
    const craftDef = entry.craftCode ? getProcessCraftByCode(entry.craftCode) : undefined;
    const referencePublishedSamUnitLabel = craftDef
        ? PUBLISHED_SAM_UNIT_LABEL[craftDef.referencePublishedSamUnit]
        : undefined;
    const inheritedGranularity = (processDef?.assignmentGranularity ??
        entry.assignmentGranularity ??
        'ORDER');
    const inheritedSplitMode = processDef?.detailSplitMode ?? entry.detailSplitMode ?? 'COMPOSITE';
    const inheritedSplitDimensions = processDef?.detailSplitDimensions?.length
        ? [...processDef.detailSplitDimensions]
        : entry.detailSplitDimensions && entry.detailSplitDimensions.length > 0
            ? [...entry.detailSplitDimensions]
            : fallbackDetailDimensions(inheritedGranularity);
    const forcedInherit = entry.entryType === 'PROCESS_BASELINE';
    const forcedOverride = entry.entryType === 'CRAFT' && (entry.isSpecialCraft || craftDef?.isSpecialCraft);
    const supportedTargetObjects = craftDef?.isSpecialCraft
        ? [...(entry.supportedTargetObjects?.length ? entry.supportedTargetObjects : craftDef.supportedTargetObjects)]
        : undefined;
    const supportedTargetObjectLabels = craftDef?.isSpecialCraft
        ? (entry.supportedTargetObjectLabels?.length
            ? [...entry.supportedTargetObjectLabels]
            : getSpecialCraftSupportedTargetObjectLabels(supportedTargetObjects ?? []))
        : undefined;
    const selectedTargetObject = craftDef?.isSpecialCraft
        ? normalizeSpecialCraftTargetObjectLabel(entry.selectedTargetObject)
            || (supportedTargetObjectLabels?.length === 1 ? supportedTargetObjectLabels[0] : undefined)
        : undefined;
    const defaultRuleSource = forcedOverride
        ? 'OVERRIDE_CRAFT'
        : craftDef?.ruleSource ?? 'INHERIT_PROCESS';
    const resolvedRuleSource = forcedInherit
        ? 'INHERIT_PROCESS'
        : forcedOverride
            ? 'OVERRIDE_CRAFT'
            : entry.ruleSource ?? defaultRuleSource;
    const overrideGranularity = (entry.assignmentGranularity ??
        craftDef?.assignmentGranularity ??
        inheritedGranularity);
    const overrideSplitMode = entry.detailSplitMode ?? craftDef?.detailSplitMode ?? inheritedSplitMode;
    const overrideSplitDimensions = entry.detailSplitDimensions && entry.detailSplitDimensions.length > 0
        ? [...entry.detailSplitDimensions]
        : craftDef?.detailSplitDimensions && craftDef.detailSplitDimensions.length > 0
            ? [...craftDef.detailSplitDimensions]
            : fallbackDetailDimensions(overrideGranularity);
    const resolvedGranularity = resolvedRuleSource === 'OVERRIDE_CRAFT' ? overrideGranularity : inheritedGranularity;
    const resolvedSplitMode = resolvedRuleSource === 'OVERRIDE_CRAFT' ? overrideSplitMode : inheritedSplitMode;
    const resolvedSplitDimensions = resolvedRuleSource === 'OVERRIDE_CRAFT' ? overrideSplitDimensions : inheritedSplitDimensions;
    return {
        ...entry,
        assignmentGranularity: resolvedGranularity,
        ruleSource: resolvedRuleSource,
        detailSplitMode: resolvedSplitMode,
        detailSplitDimensions: resolvedSplitDimensions,
        timeUnit: entry.entryType === 'CRAFT' && referencePublishedSamUnitLabel
            ? referencePublishedSamUnitLabel
            : entry.timeUnit,
        referencePublishedSamValue: craftDef?.referencePublishedSamValue,
        referencePublishedSamUnit: craftDef?.referencePublishedSamUnit,
        referencePublishedSamUnitLabel,
        referencePublishedSamNote: craftDef?.referencePublishedSamNote,
        selectedTargetObject,
        supportedTargetObjects,
        supportedTargetObjectLabels,
        visibleFactoryTypes: craftDef?.isSpecialCraft ? [...(entry.visibleFactoryTypes ?? craftDef.visibleFactoryTypes)] : undefined,
    };
}
export function listTechPackProcessEntries(spuCode) {
    const techPack = getTechPackBySpuCode(spuCode);
    if (!techPack)
        return [];
    return (techPack.processEntries ?? []).map((item) => resolveTechPackProcessEntryRule(item));
}
export function getTechPackProcessEntryById(spuCode, entryId) {
    const entries = listTechPackProcessEntries(spuCode);
    return entries.find((item) => item.id === entryId) ?? null;
}
export function listTechPackProcessEntriesByStage(spuCode, stageCode) {
    return listTechPackProcessEntries(spuCode).filter((item) => item.stageCode === stageCode);
}
export function listTechPackProcessEntriesByProcess(spuCode, processCode) {
    return listTechPackProcessEntries(spuCode).filter((item) => item.processCode === processCode);
}
