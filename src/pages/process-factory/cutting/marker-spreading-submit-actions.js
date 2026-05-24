export function handleMarkerSpreadingSubmitAction(context) {
    const { action, actionNode, saveSpreading, completeSpreading, persistSpreadingStatus } = context;
    if (action === 'save-spreading')
        return saveSpreading(false);
    if (action === 'save-spreading-and-view')
        return saveSpreading(true);
    if (action === 'complete-spreading')
        return completeSpreading();
    if (action === 'set-spreading-status') {
        const nextStatus = actionNode.dataset.status;
        if (!nextStatus)
            return false;
        return persistSpreadingStatus(nextStatus);
    }
    return false;
}
