// 工厂绩效类型定义
export const periodTypeLabels = {
    WEEKLY: '周',
    MONTHLY: '月',
};
// 绩效分计算规则
export function calculateScore(data) {
    const score = 100 - data.defectRate * 0.4 - (100 - data.onTimeRate) * 0.3 - data.rejectRate * 0.2 - data.disputeRate * 0.1;
    return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
}
