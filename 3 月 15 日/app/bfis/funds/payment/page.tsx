import { OFAPageTemplate } from "@/components/ofa-page-template"

export default function PaymentPage() {
  return (
    <OFAPageTemplate
      title="付款管理（飞书）"
      description="通过飞书审批的付款管理"
      kpiCards={[
        { title: "待审批", value: "8", change: "+2", changeType: "up" },
        { title: "待付款", value: "15", change: "+5", changeType: "up" },
        { title: "今日已付", value: "$234,567", change: "+18%", changeType: "up" },
        { title: "本月已付", value: "$1,234,567", change: "+12%", changeType: "up" },
      ]}
      tableColumns={["付款单号", "收款方", "金额", "用途", "申请人", "审批状态", "付款状态", "操作"]}
    />
  )
}
