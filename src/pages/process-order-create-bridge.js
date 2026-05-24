let pendingIntent = null;
export function setProcessCreateDemandIntent(intent) {
    pendingIntent = intent;
}
export function consumeProcessCreateDemandIntent(kind) {
    if (!pendingIntent || pendingIntent.kind !== kind)
        return null;
    const current = pendingIntent;
    pendingIntent = null;
    return current;
}
