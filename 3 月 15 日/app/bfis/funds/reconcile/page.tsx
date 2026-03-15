import { OFAPageTemplate } from "@/components/ofa-page-template"

export default function BankReconcilePage() {
  return (
    <OFAPageTemplate
      title="银行对账"
      description="银行流水与业务单据对账"
      kpiCards={[
        { title: "待对账", value: "23", change: "+5", changeType: "up" },
        { title: "已对账", value: "456", change: "+35", changeType: "up" },
        { title: "有差异", value: "3", change: "", changeType: "neutral" },
        { title: "对账率", value: "98.2%", change: "+0.8%", changeType: "up" },
      ]}
      tableColumns={["对账批次", "账户", "账期", "流水笔数", "匹配笔数", "差异笔数", "状态", "操作"]}
    />
  )
}
