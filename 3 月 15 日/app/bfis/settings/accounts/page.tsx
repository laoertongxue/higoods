import { OFAPageTemplate } from "@/components/ofa-page-template"

export default function ChartOfAccountsPage() {
  return (
    <OFAPageTemplate
      title="科目与核算维度"
      description="会计科目与核算维度管理"
      kpiCards={[
        { title: "科目数量", value: "256", change: "+8", changeType: "up" },
        { title: "一级科目", value: "45", change: "", changeType: "neutral" },
        { title: "核算维度", value: "12", change: "+1", changeType: "up" },
        { title: "启用科目", value: "230", change: "+5", changeType: "up" },
      ]}
      tableColumns={["科目编码", "科目名称", "科目类型", "余额方向", "核算维度", "状态", "操作"]}
    />
  )
}
