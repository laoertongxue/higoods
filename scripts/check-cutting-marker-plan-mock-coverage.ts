import { buildMarkerPlanMockCoverageReport, buildMarkerPlanViewModel } from '../src/pages/process-factory/cutting/marker-plan-model.ts'
import { buildMarkerPlanSummaryBuildOptions } from '../src/pages/process-factory/cutting/marker-plan-projection.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function hasScenario(
  plans: ReturnType<typeof buildMarkerPlanViewModel>['plans'],
  predicate: (plan: ReturnType<typeof buildMarkerPlanViewModel>['plans'][number]) => boolean,
): boolean {
  return plans.some(predicate)
}

function main(): void {
  const sources = buildMarkerPlanSummaryBuildOptions()
  const viewModel = buildMarkerPlanViewModel(sources)
  const report = buildMarkerPlanMockCoverageReport(sources)

  assert(report.pendingContextCount >= 6, `待建上下文不足，期望 >= 6，实际 ${report.pendingContextCount}`)
  assert(report.pendingOriginalContextCount >= 4, `待建原始裁片单上下文不足，期望 >= 4，实际 ${report.pendingOriginalContextCount}`)
  assert(report.pendingMergeBatchContextCount >= 2, `待建合并批次上下文不足，期望 >= 2，实际 ${report.pendingMergeBatchContextCount}`)
  assert(report.builtPlanCount >= 10, `已建唛架不足，期望 >= 10，实际 ${report.builtPlanCount}`)
  assert(report.referencedPlanCount >= 1, `被铺布引用唛架不足，期望 >= 1，实际 ${report.referencedPlanCount}`)
  assert(report.mappingIssueCount >= 1, `映射异常唛架不足，期望 >= 1，实际 ${report.mappingIssueCount}`)
  assert(report.missingImageCount >= 1, `缺图片唛架不足，期望 >= 1，实际 ${report.missingImageCount}`)

  ;(['normal', 'high_low', 'fold_normal', 'fold_high_low'] as const).forEach((mode) => {
    assert(report.modeCounts[mode] >= 2, `${mode} 模式样例不足，期望 >= 2，实际 ${report.modeCounts[mode]}`)
  })

  ;(['WAITING_BALANCE', 'MAPPING_ISSUE', 'WAITING_LAYOUT', 'WAITING_IMAGE', 'READY_FOR_SPREADING'] as const).forEach((status) => {
    assert(report.statusCounts[status] >= 1, `${status} 状态样例不足，期望 >= 1，实际 ${report.statusCounts[status]}`)
  })

  assert(
    hasScenario(viewModel.plans, (plan) => plan.contextType === 'original-cut-order' && plan.markerMode === 'normal' && plan.readyForSpreading),
    '缺少“原始裁片单上下文 + 普通模式 + 可交接铺布”样例',
  )
  assert(
    hasScenario(viewModel.plans, (plan) => plan.contextType === 'original-cut-order' && plan.markerMode === 'normal' && plan.imageStatus === 'pending'),
    '缺少“原始裁片单上下文 + 普通模式 + 缺图片”样例',
  )
  assert(
    hasScenario(viewModel.plans, (plan) => plan.markerMode === 'fold_normal' && plan.allocationStatus === 'unbalanced'),
    '缺少“对折普通模式 + 待配平”样例',
  )
  assert(
    hasScenario(viewModel.plans, (plan) => plan.markerMode === 'fold_normal' && plan.manualUnitUsage != null),
    '缺少“对折普通模式 + 手工修正单件成衣用量”样例',
  )
  assert(
    hasScenario(viewModel.plans, (plan) => plan.markerMode === 'high_low' && plan.mappingStatus === 'issue'),
    '缺少“高低层模式 + 映射异常”样例',
  )
  assert(
    hasScenario(viewModel.plans, (plan) => plan.markerMode === 'high_low' && plan.isReferencedBySpreading),
    '缺少“高低层模式 + 已被铺布引用”样例',
  )
  assert(
    hasScenario(viewModel.plans, (plan) => plan.markerMode === 'fold_high_low' && plan.layoutStatus !== 'done'),
    '缺少“对折高低层模式 + 待排版”样例',
  )
  assert(
    hasScenario(viewModel.plans, (plan) => plan.markerMode === 'fold_high_low' && plan.foldConfig && !plan.foldConfig.widthCheckPassed),
    '缺少“对折高低层模式 + 门幅不通过”样例',
  )
  assert(
    hasScenario(
      viewModel.plans,
      (plan) =>
        plan.contextType === 'merge-batch' &&
        plan.originalCutOrderIds.length > 1 &&
        plan.colorSummary.includes(' / '),
    ),
    '缺少“合并批次 + 多颜色 + 多来源裁片单”样例',
  )
  assert(
    hasScenario(
      viewModel.plans,
      (plan) =>
        plan.mappingStatus === 'issue' &&
        plan.allocationRows.some((row) => row.specialFlags.includes('人工确认') || row.specialFlags.includes('撞色')),
    ),
    '缺少“交叉撞色 / AB 料 + 人工映射”样例',
  )

  console.log(
    [
      '唛架计划 mock 覆盖检查通过',
      `待建上下文：${report.pendingContextCount}（原始 ${report.pendingOriginalContextCount} / 合并批次 ${report.pendingMergeBatchContextCount}）`,
      `已建唛架：${report.builtPlanCount}`,
      `被铺布引用：${report.referencedPlanCount}`,
      `映射异常：${report.mappingIssueCount}`,
      `缺图片：${report.missingImageCount}`,
    ].join('\n'),
  )
}

main()
