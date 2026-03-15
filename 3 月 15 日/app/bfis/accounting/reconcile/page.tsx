import { OFAPageTemplate } from "@/components/ofa-page-template"

export default function AccountingReconcilePage() {
  return (
    <OFAPageTemplate
      title="对账中心（统一入口）"
      description="各类对账任务的统一入口"
      kpiCards={[
        { title: "待对账任务", value: "23", change: "+5", changeType: "up" },
        { title: "已完成", value: "456", change: "+35", changeType: "up" },
        { title: "有差异", value: "8", change: "+2", changeType: "up" },
        { title: "整体对账率", value: "97.8%", change: "+0.5%", changeType: "up" },
      ]}
      tableColumns={["对账类型", "对账周期", "待对账数", "已对账数", "差异数", "对账率", "操作"]}
    />
  )
}
