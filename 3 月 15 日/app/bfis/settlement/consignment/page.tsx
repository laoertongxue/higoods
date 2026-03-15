import { OFAPageTemplate } from "@/components/ofa-page-template"

export default function ConsignmentPage() {
  return (
    <OFAPageTemplate
      title="代销结算（JKT）"
      description="雅加达代销业务结算管理"
      kpiCards={[
        { title: "待结算", value: "$89,012", change: "+5%", changeType: "up" },
        { title: "已结算", value: "$345,678", change: "+12%", changeType: "up" },
        { title: "本月结算笔数", value: "45", change: "+8", changeType: "up" },
        { title: "结算周期", value: "T+15", change: "", changeType: "neutral" },
      ]}
      tableColumns={["结算单号", "代销商", "账期", "销售金额", "结算金额", "状态", "操作"]}
    />
  )
}
