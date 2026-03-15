import { OFAPageTemplate } from "@/components/ofa-page-template"

export default function ConfirmPage() {
  return (
    <OFAPageTemplate
      title="对账确认"
      description="与往来单位的对账确认管理"
      kpiCards={[
        { title: "待确认", value: "12", change: "+3", changeType: "up" },
        { title: "已确认", value: "89", change: "+15", changeType: "up" },
        { title: "有差异", value: "3", change: "", changeType: "neutral" },
        { title: "确认率", value: "96.5%", change: "+1.2%", changeType: "up" },
      ]}
      tableColumns={["对账单号", "往来单位", "账期", "我方金额", "对方金额", "差异", "状态", "操作"]}
    />
  )
}
