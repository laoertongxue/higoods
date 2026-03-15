import { OFAPageTemplate } from "@/components/ofa-page-template"

export default function FundPlanPage() {
  return (
    <OFAPageTemplate
      title="资金计划"
      description="资金收支计划与预算管理"
      kpiCards={[
        { title: "本月计划收入", value: "$1,500,000", change: "", changeType: "neutral" },
        { title: "本月计划支出", value: "$1,200,000", change: "", changeType: "neutral" },
        { title: "计划净流入", value: "$300,000", change: "", changeType: "neutral" },
        { title: "执行率", value: "75%", change: "+5%", changeType: "up" },
      ]}
      tableColumns={["计划编号", "类型", "账户", "计划金额", "实际金额", "执行率", "状态", "操作"]}
    />
  )
}
