import { OFAPageTemplate } from "@/components/ofa-page-template"

export default function VouchersPage() {
  return (
    <OFAPageTemplate
      title="凭证中心"
      description="会计凭证管理与查询"
      kpiCards={[
        { title: "本月凭证", value: "1,256", change: "+156", changeType: "up" },
        { title: "待审核", value: "45", change: "+8", changeType: "up" },
        { title: "已过账", value: "1,180", change: "+135", changeType: "up" },
        { title: "作废凭证", value: "31", change: "+5", changeType: "up" },
      ]}
      tableColumns={["凭证号", "日期", "类型", "摘要", "借方", "贷方", "状态", "操作"]}
    />
  )
}
