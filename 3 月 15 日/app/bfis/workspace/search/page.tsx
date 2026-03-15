import { OFAPageTemplate } from "@/components/ofa-page-template"

export default function SearchPage() {
  return (
    <OFAPageTemplate
      title="快捷查询"
      description="快速查询订单、流水、凭证等信息"
      kpiCards={[
        { title: "今日查询次数", value: "156", change: "+23", changeType: "up" },
        { title: "常用查询", value: "8", change: "", changeType: "neutral" },
        { title: "收藏查询", value: "12", change: "+2", changeType: "up" },
        { title: "最近查询", value: "25", change: "", changeType: "neutral" },
      ]}
      tableColumns={["查询类型", "查询条件", "查询时间", "结果数量", "操作"]}
    />
  )
}
