function buildFcsQrValue(type, id) {
    return `FCS:${type}:v1:${id}`;
}
export function buildTaskQrValue(taskId) {
    return buildFcsQrValue('TASK', taskId);
}
export function buildHandoverOrderQrValue(handoverOrderId) {
    return buildFcsQrValue('HANDOVER_ORDER', handoverOrderId);
}
export function buildHandoverRecordQrValue(handoverRecordId) {
    return buildFcsQrValue('HANDOVER_RECORD', handoverRecordId);
}
export function parseFcsQrValue(qrValue) {
    const parts = qrValue.split(':');
    if (parts.length < 4 || parts[0] !== 'FCS') {
        return { type: 'UNKNOWN' };
    }
    const typeToken = parts[1];
    const versionToken = parts[2];
    const id = parts.slice(3).join(':');
    if (!id) {
        return { type: 'UNKNOWN' };
    }
    if (typeToken === 'TASK' || typeToken === 'HANDOVER_ORDER' || typeToken === 'HANDOVER_RECORD') {
        return {
            type: typeToken,
            id,
            version: versionToken,
        };
    }
    return { type: 'UNKNOWN' };
}
