import { OFAPageTemplate } from "@/components/ofa-page-template"

export default function TicketsPage() {
  return (
    <OFAPageTemplate
      title="工单中心"
      description="财务相关工单的创建、跟踪与处理"
      kpiCards={[
        { title: "待处理", value: "23", change: "+5", changeType: "up" },
        { title: "处理中", value: "15", change: "-2", changeType: "down" },
        { title: "已完成", value: "128", change: "+12", changeType: "up" },
        { title: "平均处理时长", value: "2.5天", change: "-0.5天", changeType: "down" },
      ]}
      tableColumns={["工单号", "类型", "标题", "发起人", "处理人", "创建时间", "状态", "操作"]}
    />
  )
}
