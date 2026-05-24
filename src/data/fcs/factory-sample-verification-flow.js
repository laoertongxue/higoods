import { refreshApplicationDerived, } from './factory-onboarding-flow.ts';
import { assignDefaultPpicForOnboarding, getFactoryOnboardingApplicationById, saveFactoryOnboardingApplication, } from './factory-onboarding-store.ts';
import { FACTORY_SAMPLE_ISSUE_METHOD_OPTIONS, FACTORY_SAMPLE_CAPACITY_CONCLUSION_OPTIONS, FACTORY_SAMPLE_QUALITY_CONCLUSION_OPTIONS, FACTORY_SAMPLE_REVIEW_REQUIRED_ITEM_OPTIONS, FACTORY_SAMPLE_REVIEW_RESULT_OPTIONS, FACTORY_SAMPLE_VERIFICATION_NODE_OPTIONS, FACTORY_SAMPLE_VERIFICATION_PURPOSE_OPTIONS, FACTORY_SAMPLE_VERIFICATION_STATUS_OPTIONS, normalizeSampleReviewResult, } from './factory-sample-verification-domain.ts';
import { createSampleVerificationFromOnboarding, getSampleVerificationByApplicationId, getSampleVerificationById, updateSampleVerification, } from './factory-sample-verification-store.ts';
function nowDate() {
    return new Date();
}
function pad(value, length) {
    return String(value).padStart(length, '0');
}
function formatDateCode(date) {
    return `${date.getFullYear()}${pad(date.getMonth() + 1, 2)}${pad(date.getDate(), 2)}`;
}
function formatTimestamp(date = nowDate()) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1, 2)}-${pad(date.getDate(), 2)} ${pad(date.getHours(), 2)}:${pad(date.getMinutes(), 2)}:00`;
}
function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}
function buildActionLogId(actionName, at) {
    return `ACT-${actionName}-${at.replace(/[-: T]/g, '')}`;
}
function buildNodeLogId(nodeName, at) {
    return `NODE-${nodeName}-${at.replace(/[-: T]/g, '')}`;
}
export function buildSampleVerificationNo() {
    const now = nowDate();
    return `SV-${formatDateCode(now)}-${pad(now.getTime() % 1000, 3)}`;
}
function buildSampleBatchNo() {
    const now = nowDate();
    return `SY-${formatDateCode(now)}-${pad(now.getTime() % 1000, 3)}`;
}
export function createSampleIssuePayload(input = {}) {
    const now = nowDate();
    return {
        sampleBatchNo: input.sampleBatchNo ?? buildSampleBatchNo(),
        styleNo: input.styleNo ?? '',
        sampleName: input.sampleName ?? '',
        sampleDescription: input.sampleDescription ?? '',
        verificationPurpose: input.verificationPurpose ? [...input.verificationPurpose] : [],
        sampleQuantity: Number(input.sampleQuantity) || 1,
        issueMethod: input.issueMethod ?? '现场发放',
        courierCompany: input.courierCompany ?? '',
        trackingNo: input.trackingNo ?? '',
        issuedAt: input.issuedAt ?? formatTimestamp(now),
        issuedBy: input.issuedBy ?? '平台样衣员',
        expectedReceiveAt: input.expectedReceiveAt ?? formatTimestamp(addDays(now, 1)),
        expectedSubmitAt: input.expectedSubmitAt ?? formatTimestamp(addDays(now, 3)),
        platformReferenceFiles: input.platformReferenceFiles ? input.platformReferenceFiles.map((item) => ({ ...item })) : [],
        platformReferencePhotos: input.platformReferencePhotos ? input.platformReferencePhotos.map((item) => ({ ...item })) : [],
        platformReferenceVideos: input.platformReferenceVideos ? input.platformReferenceVideos.map((item) => ({ ...item })) : [],
    };
}
export function validateSampleIssuePayload(payload) {
    const errors = [];
    if (!payload.sampleBatchNo.trim())
        errors.push('请填写样衣批次号');
    if (!payload.styleNo.trim())
        errors.push('请填写款号');
    if (!payload.sampleName.trim())
        errors.push('请填写样衣名称');
    if (!payload.sampleQuantity)
        errors.push('请填写样衣件数');
    if (Number(payload.sampleQuantity) <= 0)
        errors.push('样衣件数必须大于 0');
    if (!payload.sampleDescription.trim())
        errors.push('请填写样衣说明');
    if (payload.verificationPurpose.length <= 0)
        errors.push('请选择验证目的');
    if (!payload.issueMethod || !FACTORY_SAMPLE_ISSUE_METHOD_OPTIONS.includes(payload.issueMethod))
        errors.push('请选择发放方式');
    if (payload.issueMethod === '快递发放' && !payload.courierCompany?.trim())
        errors.push('请填写快递公司');
    if (payload.issueMethod === '快递发放' && !payload.trackingNo?.trim())
        errors.push('请填写快递单号');
    if (!payload.issuedAt.trim())
        errors.push('请选择发放时间');
    if (!payload.issuedBy.trim())
        errors.push('请填写发放人');
    if (!payload.expectedSubmitAt.trim())
        errors.push('请选择预计提交样衣审核时间');
    if (errors.length > 0)
        throw new Error(errors.join('\n'));
}
function cloneReferenceFiles(files) {
    return files.map((item) => ({ ...item }));
}
function hasReferenceFiles(files) {
    return Array.isArray(files) && files.length > 0;
}
function trimOptional(value) {
    const next = value?.trim();
    return next || undefined;
}
function resolveBossIdentitySource(params) {
    if (params.existingSource === '工厂提交和平台补录')
        return '工厂提交和平台补录';
    if (params.hasPlatformSupplement && (params.hadFactoryIdentity || params.existingSource === '工厂提交'))
        return '工厂提交和平台补录';
    if (params.hasPlatformSupplement)
        return '平台补录';
    if (params.hadFactoryIdentity || params.existingSource === '工厂提交')
        return '工厂提交';
    return params.existingSource;
}
function resolveBossIdentityForReview(verification, payload, reviewer, operatedAt) {
    const existingNo = trimOptional(verification.bossIdentityNo);
    const payloadNo = trimOptional(payload.bossIdentityNo);
    const existingFiles = cloneReferenceFiles(verification.bossIdentityFiles || []);
    const payloadFiles = cloneReferenceFiles(payload.bossIdentityFiles || []);
    const finalNo = existingNo || payloadNo;
    const finalFiles = hasReferenceFiles(existingFiles) ? existingFiles : payloadFiles;
    const hadFactoryIdentity = Boolean(existingNo || hasReferenceFiles(existingFiles));
    const hasPlatformSupplement = Boolean((!existingNo && payloadNo) || (!hasReferenceFiles(existingFiles) && hasReferenceFiles(payloadFiles)));
    const source = resolveBossIdentitySource({
        existingSource: verification.bossIdentitySource,
        hadFactoryIdentity,
        hasPlatformSupplement,
    });
    const completed = Boolean(finalNo && hasReferenceFiles(finalFiles));
    return {
        bossIdentityNo: finalNo,
        bossIdentityFiles: finalFiles,
        bossIdentitySource: completed ? source : source,
        bossIdentityCompletedAt: completed ? verification.bossIdentityCompletedAt || operatedAt : verification.bossIdentityCompletedAt,
        bossIdentityCompletedBy: completed ? verification.bossIdentityCompletedBy || (hasPlatformSupplement ? reviewer : verification.factorySubmittedBy) : verification.bossIdentityCompletedBy,
        hasPlatformSupplement,
    };
}
function buildSampleActionLog(params) {
    return {
        actionLogId: buildActionLogId(params.actionName, params.operatedAt),
        actionName: params.actionName,
        nodeName: params.nodeName,
        operator: params.operator,
        operatedAt: params.operatedAt,
        fromStatus: params.fromStatus,
        toStatus: params.toStatus,
        fromNode: params.fromNode,
        toNode: params.toNode,
        remark: params.remark,
    };
}
function updateSampleNodeLogs(verification, params) {
    const closed = verification.nodeLogs.map((log) => {
        if (log.nodeName !== params.fromNode || log.leftAt)
            return log;
        return {
            ...log,
            nodeStatus: '已完成',
            leftAt: params.operatedAt,
            operator: params.operator,
            remark: params.closingRemark,
        };
    });
    const openIndex = closed.findIndex((log) => log.nodeName === params.toNode && !log.leftAt);
    if (openIndex >= 0) {
        return closed.map((log, index) => index === openIndex
            ? { ...log, nodeStatus: '进行中', operator: params.operator, remark: params.openingRemark }
            : log);
    }
    return [
        ...closed,
        {
            nodeLogId: buildNodeLogId(params.toNode, params.operatedAt),
            nodeName: params.toNode,
            nodeStatus: '进行中',
            enteredAt: params.operatedAt,
            operator: params.operator,
            remark: params.openingRemark,
        },
    ];
}
function appendOnboardingSampleAction(params) {
    const actionSequenceInNode = params.application.actionLogs.filter((item) => item.nodeName === params.nodeName).length + 1;
    return {
        actionLogId: buildActionLogId(params.actionName, params.operatedAt),
        actionName: params.actionName,
        nodeName: params.nodeName,
        operator: params.operator,
        operatedAt: params.operatedAt,
        actionSequenceInNode,
        fromStatus: params.fromStatus,
        toStatus: params.toStatus,
        fromNode: params.fromNode,
        toNode: params.toNode,
        remark: params.remark,
    };
}
function updateOnboardingNodeLogsForReceive(application, operatedAt, operator) {
    const sampleNode = application.nodeLogs
        .filter((item) => item.nodeName === '样衣验证')
        .sort((left, right) => right.enteredAt.localeCompare(left.enteredAt))[0];
    const nextSampleNode = {
        ...(sampleNode || {
            nodeLogId: buildNodeLogId('样衣验证', operatedAt),
            nodeName: '样衣验证',
            nodeStatus: '进行中',
            enteredAt: operatedAt,
            elapsedMinutes: 0,
            elapsedText: '-',
            actionCount: 0,
            operator,
            remark: '进入样衣验证。',
        }),
        nodeStatus: '进行中',
        leftAt: undefined,
        operator,
        lastActionAt: operatedAt,
        remark: '工厂已确认收到样衣，等待提交样衣审核资料。',
    };
    return application.nodeLogs.some((item) => item.nodeName === '样衣验证')
        ? application.nodeLogs.map((item) => item.nodeName === '样衣验证' && !item.leftAt ? nextSampleNode : item)
        : [...application.nodeLogs, nextSampleNode];
}
function updateOnboardingNodeLogsForSampleSubmit(application, operatedAt, operator) {
    const closedSampleNodes = application.nodeLogs.map((log) => {
        if (log.nodeName !== '样衣验证' || log.leftAt)
            return log;
        return {
            ...log,
            nodeStatus: '已完成',
            leftAt: operatedAt,
            operator,
            lastActionAt: operatedAt,
            remark: '工厂已提交样衣审核资料。',
        };
    });
    const openIndex = closedSampleNodes.findIndex((item) => item.nodeName === '样衣审核' && !item.leftAt);
    if (openIndex >= 0) {
        return closedSampleNodes.map((item, index) => index === openIndex
            ? { ...item, nodeStatus: '进行中', operator, lastActionAt: operatedAt, remark: '待平台审核样衣。' }
            : item);
    }
    return [
        ...closedSampleNodes,
        {
            nodeLogId: buildNodeLogId('样衣审核', operatedAt),
            nodeName: '样衣审核',
            nodeStatus: '进行中',
            enteredAt: operatedAt,
            elapsedMinutes: 0,
            elapsedText: '-',
            actionCount: 0,
            lastActionAt: operatedAt,
            operator,
            remark: '待平台审核样衣。',
        },
    ];
}
function updateSampleNodeLogsForPlatformReview(verification, params) {
    const closingStatus = params.toStatus === '样衣审核退回'
        ? '已退回'
        : params.toStatus === '样衣审核拒绝'
            ? '已终止'
            : '已完成';
    const closed = verification.nodeLogs.map((log) => {
        if (log.nodeName !== '平台审核样衣' || log.leftAt)
            return log;
        return {
            ...log,
            nodeStatus: closingStatus,
            leftAt: params.operatedAt,
            operator: params.operator,
            remark: params.closingRemark,
        };
    });
    const openStatus = params.toStatus === '样衣审核拒绝' ? '已终止' : params.toStatus === '样衣审核通过' ? '已完成' : '进行中';
    const openIndex = closed.findIndex((log) => log.nodeName === params.toNode && !log.leftAt);
    if (openIndex >= 0) {
        return closed.map((log, index) => index === openIndex
            ? { ...log, nodeStatus: openStatus, operator: params.operator, remark: params.openingRemark }
            : log);
    }
    return [
        ...closed,
        {
            nodeLogId: buildNodeLogId(params.toNode, params.operatedAt),
            nodeName: params.toNode,
            nodeStatus: openStatus,
            enteredAt: params.operatedAt,
            leftAt: params.toStatus === '样衣审核通过' || params.toStatus === '样衣审核拒绝' ? params.operatedAt : undefined,
            operator: params.operator,
            remark: params.openingRemark,
        },
    ];
}
function updateOnboardingNodeLogsForSampleReview(application, params) {
    const closingStatus = params.toStatus === '样衣审核退回'
        ? '已退回'
        : params.toStatus === '样衣审核拒绝'
            ? '已终止'
            : '已完成';
    const closed = application.nodeLogs.map((log) => {
        if (log.nodeName !== '样衣审核' || log.leftAt)
            return log;
        return {
            ...log,
            nodeStatus: closingStatus,
            leftAt: params.operatedAt,
            operator: params.operator,
            lastActionAt: params.operatedAt,
            actionCount: Math.max(1, log.actionCount || 0) + 1,
            remark: params.closingRemark,
        };
    });
    const openStatus = params.toStatus === '样衣审核拒绝' ? '已终止' : '进行中';
    const openIndex = closed.findIndex((log) => log.nodeName === params.toNode && !log.leftAt);
    if (openIndex >= 0) {
        return closed.map((log, index) => index === openIndex
            ? {
                ...log,
                nodeStatus: openStatus,
                operator: params.operator,
                lastActionAt: params.operatedAt,
                actionCount: Math.max(1, log.actionCount || 0) + 1,
                remark: params.openingRemark,
            }
            : log);
    }
    return [
        ...closed,
        {
            nodeLogId: buildNodeLogId(params.toNode, params.operatedAt),
            nodeName: params.toNode,
            nodeStatus: openStatus,
            enteredAt: params.operatedAt,
            leftAt: params.toStatus === '样衣审核拒绝' ? params.operatedAt : undefined,
            elapsedMinutes: 0,
            elapsedText: '-',
            actionCount: 1,
            lastActionAt: params.operatedAt,
            operator: params.operator,
            remark: params.openingRemark,
        },
    ];
}
function requireOnboardingApplication(applicationId) {
    const application = getFactoryOnboardingApplicationById(applicationId);
    if (!application)
        throw new Error('未找到入驻申请');
    return refreshApplicationDerived(application);
}
function assertSupportedFiles(files, allowed, errors) {
    if (files.some((file) => !allowed.includes(file.fileType))) {
        errors.push('文件格式不支持，请重新上传');
    }
}
export function validateFactorySampleSubmission(payload) {
    const errors = [];
    if (!payload.factorySamplePhotos || payload.factorySamplePhotos.length <= 0)
        errors.push('请上传样衣照片');
    if (!payload.factorySampleVideos || payload.factorySampleVideos.length <= 0)
        errors.push('请上传样衣视频');
    if (!payload.factoryCraftDescription.trim())
        errors.push('请填写工艺说明');
    if (!payload.factorySitePhotos || payload.factorySitePhotos.length <= 0)
        errors.push('请上传工厂照片');
    if (!payload.factorySiteVideos || payload.factorySiteVideos.length <= 0)
        errors.push('请上传工厂视频');
    assertSupportedFiles(payload.factorySamplePhotos || [], ['jpg', 'jpeg', 'png', 'webp'], errors);
    assertSupportedFiles(payload.factorySampleVideos || [], ['mp4', 'mov'], errors);
    assertSupportedFiles(payload.factorySitePhotos || [], ['jpg', 'jpeg', 'png', 'webp'], errors);
    assertSupportedFiles(payload.factorySiteVideos || [], ['mp4', 'mov'], errors);
    assertSupportedFiles(payload.bossIdentityFiles || [], ['jpg', 'jpeg', 'png', 'webp', 'pdf'], errors);
    assertSupportedFiles(payload.factorySubmissionFiles || [], ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'mp4', 'mov'], errors);
    if (errors.length > 0)
        throw new Error([...new Set(errors)].join('\n'));
}
export function getFactorySampleVerificationForOnboarding(applicationId) {
    return getSampleVerificationByApplicationId(applicationId);
}
function buildSampleNodeLog(application, operatedAt, operator) {
    const existing = application.nodeLogs
        .filter((item) => item.nodeName === '样衣验证')
        .sort((left, right) => right.enteredAt.localeCompare(left.enteredAt))[0];
    return {
        ...(existing || {
            nodeLogId: buildNodeLogId('样衣验证', operatedAt),
            nodeName: '样衣验证',
            nodeStatus: '进行中',
            enteredAt: operatedAt,
            elapsedMinutes: 0,
            elapsedText: '-',
            actionCount: 0,
            operator,
            remark: '进入样衣验证。',
        }),
        nodeStatus: '进行中',
        leftAt: undefined,
        operator,
        lastActionAt: operatedAt,
        remark: '平台已发放样衣，等待工厂确认收样。',
    };
}
function appendSampleIssueAction(application, operatedAt, operator) {
    const actionSequenceInNode = application.actionLogs.filter((item) => item.nodeName === '样衣验证').length + 1;
    return {
        actionLogId: buildActionLogId('平台登记并发放样衣', operatedAt),
        actionName: '平台登记并发放样衣',
        nodeName: '样衣验证',
        operator,
        operatedAt,
        actionSequenceInNode,
        fromStatus: '待样衣验证',
        toStatus: '待工厂确认收样',
        fromNode: '样衣验证',
        toNode: '样衣验证',
        remark: '平台登记并发放样衣，等待工厂确认收样。',
    };
}
export function issueSampleForOnboarding(applicationId, payload, operator) {
    const application = getFactoryOnboardingApplicationById(applicationId);
    if (!application)
        throw new Error('未找到入驻申请');
    const current = refreshApplicationDerived(application);
    if (current.sampleVerificationId || getSampleVerificationByApplicationId(current.applicationId)) {
        throw new Error('当前申请已登记样衣，请勿重复发放。');
    }
    if (current.status !== '待样衣验证') {
        throw new Error('只有待样衣验证的申请可以登记并发放样衣。');
    }
    const normalizedPayload = createSampleIssuePayload({
        ...payload,
        sampleQuantity: Number(payload.sampleQuantity),
        issuedBy: payload.issuedBy || operator,
        verificationPurpose: payload.verificationPurpose.filter((item) => FACTORY_SAMPLE_VERIFICATION_PURPOSE_OPTIONS.includes(item)),
        platformReferenceFiles: cloneReferenceFiles(payload.platformReferenceFiles),
        platformReferencePhotos: cloneReferenceFiles(payload.platformReferencePhotos),
        platformReferenceVideos: cloneReferenceFiles(payload.platformReferenceVideos),
    });
    validateSampleIssuePayload(normalizedPayload);
    const sampleVerification = createSampleVerificationFromOnboarding(current, normalizedPayload);
    const operatedAt = sampleVerification.issuedAt;
    const actionLog = appendSampleIssueAction(current, operatedAt, operator || normalizedPayload.issuedBy);
    const sampleNodeLog = buildSampleNodeLog(current, operatedAt, operator || normalizedPayload.issuedBy);
    const nextNodeLogs = current.nodeLogs.some((item) => item.nodeName === '样衣验证')
        ? current.nodeLogs.map((item) => item.nodeName === '样衣验证' && !item.leftAt ? sampleNodeLog : item)
        : [...current.nodeLogs, sampleNodeLog];
    const updatedApplication = refreshApplicationDerived({
        ...current,
        status: '待工厂确认收样',
        currentNode: '样衣验证',
        sampleVerificationId: sampleVerification.verificationId,
        sampleStatus: '待工厂确认收样',
        sampleIssuedAt: sampleVerification.issuedAt,
        sampleExpectedSubmitAt: sampleVerification.expectedSubmitAt,
        actionLogs: [...current.actionLogs, actionLog],
        nodeLogs: nextNodeLogs,
        adminAccount: {
            ...current.adminAccount,
            accountStatus: '待转正式',
        },
        createdFactoryId: current.createdFactoryId,
    }, operatedAt);
    const saved = saveFactoryOnboardingApplication(updatedApplication);
    return {
        application: saved,
        sampleVerification,
    };
}
export function confirmFactoryReceivedSample(verificationId, payload, operator) {
    const verification = getSampleVerificationById(verificationId);
    if (!verification)
        throw new Error('未找到样衣验证记录');
    if (verification.status !== '待工厂确认收样')
        throw new Error('当前状态不能确认收到样衣。');
    const errors = [];
    if (!payload.factoryReceivedAt.trim())
        errors.push('请选择确认收样时间');
    if (!payload.factoryReceivedBy.trim())
        errors.push('请填写确认收样人');
    if (errors.length > 0)
        throw new Error(errors.join('\n'));
    const operatedAt = payload.factoryReceivedAt.trim();
    const operatedBy = payload.factoryReceivedBy.trim() || operator;
    const nextAction = buildSampleActionLog({
        actionName: '工厂确认收到样衣',
        nodeName: '工厂确认收样',
        operator: operatedBy,
        operatedAt,
        fromStatus: '待工厂确认收样',
        toStatus: '待工厂提交样衣审核',
        fromNode: '工厂确认收样',
        toNode: '工厂提交样衣审核',
        remark: payload.factoryReceiveRemark?.trim() || '工厂确认收到平台发放样衣。',
    });
    const updatedVerification = updateSampleVerification(verification.verificationId, {
        status: '待工厂提交样衣审核',
        currentNode: '工厂提交样衣审核',
        factoryReceivedAt: operatedAt,
        factoryReceivedBy: operatedBy,
        factoryReceiveRemark: payload.factoryReceiveRemark?.trim() || undefined,
        receiveActionCount: (verification.receiveActionCount || 0) + 1,
        actionLogs: [...verification.actionLogs, nextAction],
        nodeLogs: updateSampleNodeLogs(verification, {
            fromNode: '工厂确认收样',
            toNode: '工厂提交样衣审核',
            operatedAt,
            operator: operatedBy,
            closingRemark: '工厂已确认收到样衣。',
            openingRemark: '等待工厂提交样衣审核资料。',
        }),
        updatedAt: operatedAt,
    });
    if (!updatedVerification)
        throw new Error('样衣验证记录更新失败');
    const application = requireOnboardingApplication(verification.applicationId);
    const onboardingAction = appendOnboardingSampleAction({
        application,
        actionName: '工厂确认收到样衣',
        nodeName: '样衣验证',
        operator: operatedBy,
        operatedAt,
        fromStatus: '待工厂确认收样',
        toStatus: '待工厂提交样衣审核',
        fromNode: '样衣验证',
        toNode: '样衣验证',
        remark: payload.factoryReceiveRemark?.trim() || '工厂确认收到样衣。',
    });
    const updatedApplication = refreshApplicationDerived({
        ...application,
        status: '待工厂提交样衣审核',
        currentNode: '样衣验证',
        sampleStatus: '待工厂提交样衣审核',
        actionLogs: [...application.actionLogs, onboardingAction],
        nodeLogs: updateOnboardingNodeLogsForReceive(application, operatedAt, operatedBy),
        createdFactoryId: application.createdFactoryId,
        adminAccount: {
            ...application.adminAccount,
            accountStatus: '待转正式',
        },
    }, operatedAt);
    const saved = saveFactoryOnboardingApplication(updatedApplication);
    return { application: saved, sampleVerification: updatedVerification };
}
export function submitFactorySampleReview(verificationId, payload, operator) {
    const verification = getSampleVerificationById(verificationId);
    if (!verification)
        throw new Error('未找到样衣验证记录');
    if (verification.status !== '待工厂提交样衣审核' && verification.status !== '样衣审核退回') {
        throw new Error('当前状态不能提交样衣审核资料。');
    }
    validateFactorySampleSubmission(payload);
    const operatedAt = formatTimestamp();
    const operatedBy = operator.trim() || verification.applicantName;
    const fromStatus = verification.status;
    const isResubmit = fromStatus === '样衣审核退回';
    const nextRoundNo = Math.max(verification.factorySubmissionRoundNo || 0, verification.submissionActionCount || 0) + 1;
    const submittedBossNo = trimOptional(payload.bossIdentityNo);
    const submittedBossFiles = cloneReferenceFiles(payload.bossIdentityFiles || []);
    const hasFactoryBossIdentity = Boolean(submittedBossNo || hasReferenceFiles(submittedBossFiles));
    const factoryCompletedBossIdentity = Boolean(submittedBossNo && hasReferenceFiles(submittedBossFiles));
    const nextBossSource = hasFactoryBossIdentity
        ? resolveBossIdentitySource({
            existingSource: verification.bossIdentitySource,
            hadFactoryIdentity: true,
            hasPlatformSupplement: verification.bossIdentitySource === '平台补录',
        })
        : verification.bossIdentitySource;
    const nextAction = buildSampleActionLog({
        actionName: isResubmit ? '工厂重新提交样衣审核' : '工厂提交样衣审核',
        nodeName: '工厂提交样衣审核',
        operator: operatedBy,
        operatedAt,
        fromStatus,
        toStatus: '待平台审核样衣',
        fromNode: '工厂提交样衣审核',
        toNode: '平台审核样衣',
        remark: payload.factorySubmitRemark?.trim() || '工厂提交样衣审核资料，等待平台审核。',
    });
    const updatedVerification = updateSampleVerification(verification.verificationId, {
        status: '待平台审核样衣',
        currentNode: '平台审核样衣',
        factorySubmittedAt: operatedAt,
        factorySubmittedBy: operatedBy,
        factorySamplePhotos: cloneReferenceFiles(payload.factorySamplePhotos),
        factorySampleVideos: cloneReferenceFiles(payload.factorySampleVideos),
        factoryCraftDescription: payload.factoryCraftDescription.trim(),
        factoryProblemDescription: payload.factoryProblemDescription?.trim() || undefined,
        factorySubmitRemark: payload.factorySubmitRemark?.trim() || undefined,
        factorySubmissionRoundNo: nextRoundNo,
        factorySubmissionFiles: cloneReferenceFiles(payload.factorySubmissionFiles || []),
        factorySitePhotos: cloneReferenceFiles(payload.factorySitePhotos || []),
        factorySiteVideos: cloneReferenceFiles(payload.factorySiteVideos || []),
        bossIdentityNo: submittedBossNo || verification.bossIdentityNo,
        bossIdentityFiles: hasReferenceFiles(submittedBossFiles) ? submittedBossFiles : cloneReferenceFiles(verification.bossIdentityFiles || []),
        bossIdentitySource: nextBossSource,
        bossIdentityCompletedAt: factoryCompletedBossIdentity ? verification.bossIdentityCompletedAt || operatedAt : verification.bossIdentityCompletedAt,
        bossIdentityCompletedBy: factoryCompletedBossIdentity ? verification.bossIdentityCompletedBy || operatedBy : verification.bossIdentityCompletedBy,
        submissionActionCount: (verification.submissionActionCount || 0) + 1,
        actionLogs: [...verification.actionLogs, nextAction],
        nodeLogs: updateSampleNodeLogs(verification, {
            fromNode: '工厂提交样衣审核',
            toNode: '平台审核样衣',
            operatedAt,
            operator: operatedBy,
            closingRemark: '工厂已提交样衣审核资料。',
            openingRemark: '等待平台审核样衣。',
        }),
        updatedAt: operatedAt,
    });
    if (!updatedVerification)
        throw new Error('样衣验证记录更新失败');
    const application = requireOnboardingApplication(verification.applicationId);
    const onboardingAction = appendOnboardingSampleAction({
        application,
        actionName: isResubmit ? '工厂重新提交样衣审核' : '工厂提交样衣审核',
        nodeName: '样衣审核',
        operator: operatedBy,
        operatedAt,
        fromStatus: application.status === '样衣审核退回' ? '样衣审核退回' : '待工厂提交样衣审核',
        toStatus: '待平台审核样衣',
        fromNode: '样衣验证',
        toNode: '样衣审核',
        remark: payload.factorySubmitRemark?.trim() || '工厂提交样衣审核资料，等待平台审核。',
    });
    const updatedApplication = refreshApplicationDerived({
        ...application,
        status: '待平台审核样衣',
        currentNode: '样衣审核',
        sampleStatus: '待平台审核样衣',
        actionLogs: [...application.actionLogs, onboardingAction],
        nodeLogs: updateOnboardingNodeLogsForSampleSubmit(application, operatedAt, operatedBy),
        createdFactoryId: application.createdFactoryId,
        adminAccount: {
            ...application.adminAccount,
            accountStatus: '待转正式',
        },
    }, operatedAt);
    const saved = saveFactoryOnboardingApplication(updatedApplication);
    const assignedApplication = assignDefaultPpicForOnboarding(saved.applicationId, '系统默认分配');
    return { application: assignedApplication, sampleVerification: updatedVerification };
}
export function validateSampleReviewPayload(payload, verification) {
    const errors = [];
    const reviewResult = normalizeSampleReviewResult(payload.sampleReviewResult);
    if (!payload.sampleReviewResult || !FACTORY_SAMPLE_REVIEW_RESULT_OPTIONS.includes(reviewResult))
        errors.push('请选择样衣审核结果');
    if (!payload.sampleReviewOpinion.trim())
        errors.push('请填写样衣审核意见');
    if (reviewResult === '未通过' && (!payload.requiredResubmitItems || payload.requiredResubmitItems.length <= 0)) {
        errors.push('请选择需重新提交内容');
    }
    if (reviewResult === '已通过') {
        const bossIdentityNo = verification?.bossIdentityNo?.trim() || payload.bossIdentityNo?.trim();
        const bossIdentityFiles = hasReferenceFiles(verification?.bossIdentityFiles) ? verification?.bossIdentityFiles : payload.bossIdentityFiles;
        if (!bossIdentityNo)
            errors.push('请填写老板身份证号码/护照号码');
        if (!hasReferenceFiles(bossIdentityFiles))
            errors.push('请上传老板身份证复印件或照片');
    }
    if (errors.length > 0)
        throw new Error(errors.join('\n'));
}
export function getLatestSampleReviewRecord(verificationId) {
    const verification = getSampleVerificationById(verificationId);
    if (!verification || verification.sampleReviewRecords.length <= 0)
        return null;
    return [...verification.sampleReviewRecords].sort((left, right) => right.sampleReviewRoundNo - left.sampleReviewRoundNo || right.reviewedAt.localeCompare(left.reviewedAt))[0];
}
export function canReviewFactorySample(verification) {
    return verification?.status === '待平台审核样衣';
}
export function canFactoryResubmitSample(verification) {
    return verification?.status === '样衣审核退回';
}
export function reviewFactorySample(verificationId, payload, operator) {
    const verification = getSampleVerificationById(verificationId);
    if (!verification)
        throw new Error('未找到样衣验证记录');
    if (!canReviewFactorySample(verification))
        throw new Error('当前状态不能进行样衣审核');
    validateSampleReviewPayload(payload, verification);
    const operatedAt = formatTimestamp();
    const reviewer = operator.trim() || '平台样衣审核员';
    const reviewResult = normalizeSampleReviewResult(payload.sampleReviewResult);
    const bossIdentity = resolveBossIdentityForReview(verification, payload, reviewer, operatedAt);
    const resubmitAllowed = reviewResult === '未通过';
    const sampleToStatus = reviewResult === '已通过'
        ? '样衣审核通过'
        : '样衣审核退回';
    const sampleToNode = resubmitAllowed ? '工厂提交样衣审核' : '样衣验证完成';
    const applicationToStatus = reviewResult === '已通过'
        ? '样衣审核通过待转正式'
        : '样衣审核退回';
    const applicationToNode = reviewResult === '已通过'
        ? '正式合作'
        : '样衣验证';
    const actionName = reviewResult === '已通过'
        ? '平台样衣审核通过'
        : '样衣审核未通过';
    const nextRoundNo = Math.max(0, ...verification.sampleReviewRecords.map((item) => item.sampleReviewRoundNo || 0)) + 1;
    const relatedSubmissionRoundNo = Math.max(1, verification.factorySubmissionRoundNo || verification.submissionActionCount || 1);
    const requiredResubmitItems = resubmitAllowed
        ? [...new Set(payload.requiredResubmitItems.filter((item) => FACTORY_SAMPLE_REVIEW_REQUIRED_ITEM_OPTIONS.includes(item)))]
        : [];
    const sampleReviewRecord = {
        sampleReviewId: `SV-REV-${verification.verificationId}-${nextRoundNo}-${operatedAt.replace(/[-: T]/g, '')}`,
        sampleReviewRoundNo: nextRoundNo,
        sampleReviewResult: reviewResult,
        sampleReviewOpinion: payload.sampleReviewOpinion.trim(),
        resubmitAllowed,
        requiredResubmitItems,
        reviewer,
        reviewedAt: operatedAt,
        fromStatus: '待平台审核样衣',
        toStatus: sampleToStatus,
        fromNode: '平台审核样衣',
        toNode: sampleToNode,
        relatedSubmissionRoundNo,
        sampleQualityConclusion: payload.sampleQualityConclusion && FACTORY_SAMPLE_QUALITY_CONCLUSION_OPTIONS.includes(payload.sampleQualityConclusion)
            ? payload.sampleQualityConclusion
            : undefined,
        capacityConclusion: payload.capacityConclusion && FACTORY_SAMPLE_CAPACITY_CONCLUSION_OPTIONS.includes(payload.capacityConclusion)
            ? payload.capacityConclusion
            : undefined,
        bossIdentityNoAtReview: bossIdentity.bossIdentityNo,
        bossIdentityFilesAtReview: cloneReferenceFiles(bossIdentity.bossIdentityFiles || []),
        bossIdentitySourceAtReview: bossIdentity.bossIdentitySource,
        bossIdentityCompletedByReviewer: bossIdentity.bossIdentityCompletedBy,
        remark: payload.remark?.trim() || undefined,
    };
    const sampleAction = buildSampleActionLog({
        actionName,
        nodeName: '平台审核样衣',
        operator: reviewer,
        operatedAt,
        fromStatus: '待平台审核样衣',
        toStatus: sampleToStatus,
        fromNode: '平台审核样衣',
        toNode: sampleToNode,
        remark: payload.sampleReviewOpinion.trim(),
    });
    const updatedVerification = updateSampleVerification(verification.verificationId, {
        status: sampleToStatus,
        currentNode: sampleToNode,
        platformSampleReviewedAt: operatedAt,
        bossIdentityNo: bossIdentity.bossIdentityNo,
        bossIdentityFiles: cloneReferenceFiles(bossIdentity.bossIdentityFiles || []),
        bossIdentitySource: bossIdentity.bossIdentitySource,
        bossIdentityCompletedAt: bossIdentity.bossIdentityCompletedAt,
        bossIdentityCompletedBy: bossIdentity.bossIdentityCompletedBy,
        sampleReviewRecords: [...verification.sampleReviewRecords, sampleReviewRecord],
        actionLogs: [...verification.actionLogs, sampleAction],
        nodeLogs: updateSampleNodeLogsForPlatformReview(verification, {
            toStatus: sampleToStatus,
            toNode: sampleToNode,
            operatedAt,
            operator: reviewer,
            closingRemark: reviewResult === '已通过'
                ? '平台样衣审核通过。'
                : '样衣审核未通过，等待工厂重新提交。',
            openingRemark: reviewResult === '已通过'
                ? '样衣验证通过，等待下一步正式转档。'
                : '等待工厂按退回项重新提交样衣审核资料。',
        }),
        updatedAt: operatedAt,
    });
    if (!updatedVerification)
        throw new Error('样衣验证记录更新失败');
    const application = requireOnboardingApplication(verification.applicationId);
    const onboardingAction = appendOnboardingSampleAction({
        application,
        actionName,
        nodeName: '样衣审核',
        operator: reviewer,
        operatedAt,
        fromStatus: '待平台审核样衣',
        toStatus: applicationToStatus,
        fromNode: '样衣审核',
        toNode: applicationToNode,
        remark: payload.sampleReviewOpinion.trim(),
    });
    const updatedApplication = refreshApplicationDerived({
        ...application,
        status: applicationToStatus,
        currentNode: applicationToNode,
        sampleStatus: applicationToStatus,
        sampleVerifiedAt: operatedAt,
        actionLogs: [...application.actionLogs, onboardingAction],
        nodeLogs: updateOnboardingNodeLogsForSampleReview(application, {
            toStatus: applicationToStatus,
            toNode: applicationToNode,
            operatedAt,
            operator: reviewer,
            closingRemark: reviewResult === '已通过'
                ? '样衣审核通过。'
                : '样衣审核未通过，等待工厂重新提交。',
            openingRemark: reviewResult === '已通过'
                ? '待转正式合作。'
                : '样衣审核未通过，等待工厂重新提交样衣资料。',
        }),
        accountLocked: false,
        accountLockedReason: undefined,
        factoryNameLocked: false,
        lockedAt: undefined,
        createdFactoryId: application.createdFactoryId,
        adminAccount: {
            ...application.adminAccount,
            accountStatus: '待转正式',
        },
    }, operatedAt);
    const saved = saveFactoryOnboardingApplication(updatedApplication);
    return { application: saved, sampleVerification: updatedVerification, sampleReviewRecord };
}
export function getSampleStatusText(status) {
    const matched = FACTORY_SAMPLE_VERIFICATION_STATUS_OPTIONS.find((item) => item === status);
    return matched || '未登记样衣';
}
export function getSampleNodeText(currentNode) {
    const matched = FACTORY_SAMPLE_VERIFICATION_NODE_OPTIONS.find((item) => item === currentNode);
    return matched || '未开始';
}
