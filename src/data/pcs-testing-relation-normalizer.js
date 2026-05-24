import { findProjectByCode, findProjectNodeByWorkItemTypeCode, getProjectById } from './pcs-project-repository.ts';
import { buildProjectChannelProductChainSummary } from './pcs-channel-product-project-repository.ts';
function nowText() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}
function resolveProject(projectIdOrCode) {
    if (!projectIdOrCode)
        return null;
    return getProjectById(projectIdOrCode) ?? findProjectByCode(projectIdOrCode);
}
function buildPendingItem(input) {
    return {
        pendingRelationId: `pending_${input.sourceModule}_${input.sourceObjectCode}_${input.rawProjectCode || 'empty'}`
            .replace(/[^a-zA-Z0-9]/g, '_'),
        sourceModule: input.sourceModule,
        sourceObjectCode: input.sourceObjectCode,
        rawProjectCode: input.rawProjectCode,
        reason: input.reason,
        discoveredAt: input.discoveredAt,
        sourceTitle: input.sourceTitle,
        legacyRefType: input.legacyRefType,
        legacyRefValue: input.legacyRefValue,
    };
}
function hasEnteredTestingPhase(currentPhaseCode) {
    return currentPhaseCode === 'PHASE_03' || currentPhaseCode === 'PHASE_04' || currentPhaseCode === 'PHASE_05';
}
function buildTestingGateFailure(input) {
    const project = resolveProject(input.projectIdOrCode);
    return {
        relation: null,
        pendingItem: buildPendingItem({
            sourceModule: input.sourceModule,
            sourceObjectCode: input.sourceObjectCode,
            rawProjectCode: project?.projectCode || input.projectIdOrCode,
            reason: input.reason,
            discoveredAt: input.businessDate || nowText(),
            sourceTitle: input.sourceTitle,
            legacyRefType: input.legacyRefType,
            legacyRefValue: input.legacyRefValue,
        }),
        errorMessage: input.reason,
    };
}
function validateTestingGate(input) {
    const project = resolveProject(input.projectIdOrCode);
    if (!project)
        return null;
    if (!hasEnteredTestingPhase(project.currentPhaseCode)) {
        return buildTestingGateFailure({
            ...input,
            reason: '当前项目尚未进入商品上架与市场测款阶段，不能建立正式测款关系。',
        });
    }
    const chain = buildProjectChannelProductChainSummary(project.projectId);
    if (!chain || !chain.currentChannelProductId) {
        return buildTestingGateFailure({
            ...input,
            reason: `当前项目未完成商品上架，不能建立正式${input.workItemLabel}关系。`,
        });
    }
    const channelProductStatus = chain.currentChannelProductStatus === '已完成'
        ? '已上架待测款'
        : chain.currentChannelProductStatus;
    if (channelProductStatus !== '已上架待测款') {
        const reason = channelProductStatus === '待上传' || channelProductStatus === '已上传待确认'
            ? `当前项目未完成商品上架，不能建立正式${input.workItemLabel}关系。`
            : channelProductStatus === '已作废'
                ? `当前渠道店铺商品已作废，不能建立正式${input.workItemLabel}关系。`
                : channelProductStatus === '已生效'
                    ? `当前渠道店铺商品已完成款式档案关联，不能再进入正式${input.workItemLabel}。`
                    : `当前渠道店铺商品状态为${channelProductStatus || '未知状态'}，只有“已上架待测款”的项目才允许建立正式${input.workItemLabel}关系。`;
        return buildTestingGateFailure({
            ...input,
            reason,
        });
    }
    if (!chain.currentUpstreamChannelProductCode) {
        return buildTestingGateFailure({
            ...input,
            reason: `当前渠道店铺商品尚未取得上游渠道商品编码，不能进入正式${input.workItemLabel}。`,
        });
    }
    return null;
}
function buildTestingRelationRecord(input) {
    const project = resolveProject(input.projectIdOrCode);
    if (!project) {
        return {
            relation: null,
            pendingItem: buildPendingItem({
                sourceModule: input.sourceModule,
                sourceObjectCode: input.sourceLineCode || input.sourceObjectCode,
                rawProjectCode: input.projectIdOrCode,
                reason: '旧测款关系引用的商品项目不存在，当前未写入正式关系记录。',
                discoveredAt: input.businessDate || nowText(),
                sourceTitle: input.sourceTitle,
                legacyRefType: input.legacyRefType,
                legacyRefValue: input.legacyRefValue,
            }),
            errorMessage: '当前项目不存在，未写入正式项目关系记录。',
        };
    }
    const node = findProjectNodeByWorkItemTypeCode(project.projectId, input.workItemTypeCode);
    if (!node && !input.allowMissingProjectNode) {
        return {
            relation: null,
            pendingItem: buildPendingItem({
                sourceModule: input.sourceModule,
                sourceObjectCode: input.sourceLineCode || input.sourceObjectCode,
                rawProjectCode: project.projectCode,
                reason: '当前项目未配置对应测款工作项，请先检查项目模板与项目节点。',
                discoveredAt: input.businessDate || nowText(),
                sourceTitle: input.sourceTitle,
                legacyRefType: input.legacyRefType,
                legacyRefValue: input.legacyRefValue,
            }),
            errorMessage: '当前项目未配置对应测款工作项，请先检查项目模板与项目节点。',
        };
    }
    if (!input.skipTestingGate) {
        const gateFailure = validateTestingGate({
            projectIdOrCode: project.projectId,
            sourceModule: input.sourceModule,
            sourceObjectCode: input.sourceLineCode || input.sourceObjectCode,
            sourceTitle: input.sourceTitle,
            workItemLabel: input.workItemTypeNameHint,
            businessDate: input.businessDate,
            legacyRefType: input.legacyRefType,
            legacyRefValue: input.legacyRefValue,
        });
        if (gateFailure)
            return gateFailure;
    }
    const timestamp = input.businessDate || nowText();
    return {
        relation: {
            projectRelationId: `rel_${project.projectId}_${node?.projectNodeId || input.workItemTypeCode}_${input.sourceLineCode || input.sourceObjectCode}`
                .replace(/[^a-zA-Z0-9]/g, '_'),
            projectId: project.projectId,
            projectCode: project.projectCode,
            projectNodeId: node?.projectNodeId || null,
            workItemTypeCode: input.workItemTypeCode,
            workItemTypeName: node?.workItemTypeName || input.workItemTypeNameHint,
            relationRole: '执行记录',
            sourceModule: input.sourceModule,
            sourceObjectType: input.sourceObjectType,
            sourceObjectId: input.sourceObjectId,
            sourceObjectCode: input.sourceObjectCode,
            sourceLineId: input.sourceLineId,
            sourceLineCode: input.sourceLineCode,
            sourceTitle: input.sourceTitle,
            sourceStatus: input.sourceStatus,
            businessDate: timestamp,
            ownerName: input.ownerName,
            createdAt: timestamp,
            createdBy: input.operatorName,
            updatedAt: timestamp,
            updatedBy: input.operatorName,
            note: input.note,
            legacyRefType: input.legacyRefType,
            legacyRefValue: input.legacyRefValue,
        },
        pendingItem: null,
        errorMessage: null,
    };
}
export function buildLiveProductLineProjectRelation(line, projectIdOrCode, options = {}) {
    return buildTestingRelationRecord({
        projectIdOrCode,
        sourceModule: '直播',
        sourceObjectType: '直播商品明细',
        sourceObjectId: line.liveSessionId,
        sourceObjectCode: line.liveSessionCode,
        sourceLineId: line.liveLineId,
        sourceLineCode: line.liveLineCode,
        sourceTitle: line.productTitle,
        sourceStatus: line.sessionStatus,
        businessDate: line.businessDate,
        ownerName: line.ownerName,
        workItemTypeCode: 'LIVE_TEST',
        workItemTypeNameHint: '直播测款',
        operatorName: options.operatorName || '系统初始化',
        note: options.note || '',
        legacyRefType: options.legacyRefType || '',
        legacyRefValue: options.legacyRefValue || '',
        skipTestingGate: options.skipTestingGate,
        allowMissingProjectNode: options.allowMissingProjectNode,
    });
}
export function buildVideoRecordProjectRelation(record, projectIdOrCode, options = {}) {
    return buildTestingRelationRecord({
        projectIdOrCode,
        sourceModule: '短视频',
        sourceObjectType: '短视频记录',
        sourceObjectId: record.videoRecordId,
        sourceObjectCode: record.videoRecordCode,
        sourceLineId: null,
        sourceLineCode: null,
        sourceTitle: record.videoTitle,
        sourceStatus: record.recordStatus,
        businessDate: record.businessDate,
        ownerName: record.ownerName,
        workItemTypeCode: 'VIDEO_TEST',
        workItemTypeNameHint: '短视频测款',
        operatorName: options.operatorName || '系统初始化',
        note: options.note || '',
        legacyRefType: options.legacyRefType || '',
        legacyRefValue: options.legacyRefValue || '',
        skipTestingGate: options.skipTestingGate,
        allowMissingProjectNode: options.allowMissingProjectNode,
    });
}
export function buildHistoricalLiveProductLineProjectRelation(line, projectIdOrCode, options = {}) {
    return buildLiveProductLineProjectRelation(line, projectIdOrCode, {
        ...options,
        skipTestingGate: true,
    });
}
export function buildHistoricalVideoRecordProjectRelation(record, projectIdOrCode, options = {}) {
    return buildVideoRecordProjectRelation(record, projectIdOrCode, {
        ...options,
        skipTestingGate: true,
    });
}
export function normalizeLegacyLiveSessionHeaderRelation(input) {
    if (input.productLines.length !== 1) {
        return {
            relations: [],
            pendingItems: [
                buildPendingItem({
                    sourceModule: '直播',
                    sourceObjectCode: input.session.liveSessionCode,
                    rawProjectCode: input.rawProjectCode,
                    reason: '历史直播场次头项目字段对应多条直播商品明细，当前未自动猜测下移。',
                    discoveredAt: input.session.businessDate || input.session.updatedAt || nowText(),
                    sourceTitle: input.session.sessionTitle,
                    legacyRefType: 'liveSession.projectRef',
                    legacyRefValue: input.rawProjectId || input.rawProjectCode,
                }),
            ],
        };
    }
    const relationBuilder = input.skipTestingGate
        ? buildHistoricalLiveProductLineProjectRelation
        : buildLiveProductLineProjectRelation;
    const result = relationBuilder(input.productLines[0], input.rawProjectId || input.rawProjectCode, {
        operatorName: input.operatorName || '系统初始化',
        note: '历史场次头项目字段已下移到唯一直播商品明细。',
        legacyRefType: 'liveSession.projectRef',
        legacyRefValue: input.rawProjectId || input.rawProjectCode || '',
    });
    return {
        relations: result.relation ? [result.relation] : [],
        pendingItems: result.pendingItem ? [result.pendingItem] : [],
    };
}
