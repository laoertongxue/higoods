export const DEFAULT_MARKER_BED_SPREADING_DURATION_MINUTES = 45;
export const cuttingTableResources = Array.from({ length: 7 }, (_, index) => {
    const serial = index + 1;
    return {
        cuttingTableId: `cutting-table-${serial}`,
        cuttingTableNo: `裁床${serial}`,
        cuttingTableName: `裁床${serial}`,
        status: '空闲',
        widthLimitCm: 180,
        nextAvailableAt: '现在',
        remark: '',
    };
});
export function findCuttingTableById(cuttingTableId) {
    return cuttingTableResources.find((table) => table.cuttingTableId === cuttingTableId) || null;
}
export function getDefaultCuttingTable() {
    return cuttingTableResources[0];
}
