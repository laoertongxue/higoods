import {
  auditPcsProjectDataConsistency,
  formatPcsProjectDataConsistencyReport,
  repairPcsProjectDataConsistency,
} from '../src/data/pcs-project-data-consistency.ts'

const repairResult = repairPcsProjectDataConsistency('检查脚本')
if (repairResult.relationRepairCount > 0 || repairResult.nodeRepairCount > 0) {
  console.log(
    `已执行一致性修复：修复关系 ${repairResult.relationRepairCount} 条，回退节点 ${repairResult.nodeRepairCount} 个。`,
  )
}

const report = auditPcsProjectDataConsistency()
console.log(formatPcsProjectDataConsistencyReport(report))

if (report.issueCount > 0) {
  process.exit(1)
}
