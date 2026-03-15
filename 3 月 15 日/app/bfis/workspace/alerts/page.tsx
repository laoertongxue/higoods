import { OFAPageTemplate } from "@/components/ofa-page-template"

export default function AlertsPage() {
  return (
    <OFAPageTemplate
      title="异常与预警"
      description="系统检测到的异常情况和风险预警"
      kpiCards={[
        { title: "严重异常", value: "5", change: "+2", changeType: "up" },
        { title: "一般异常", value: "18", change: "-3", changeType: "down" },
        { title: "风险预警", value: "12", change: "+4", changeType: "up" },
        { title: "已处理", value: "45", change: "+8", changeType: "up" },
      ]}
      tableColumns={["编号", "级别", "类型", "描述", "发现时间", "责任人", "状态", "操作"]}
    />
  )
}
