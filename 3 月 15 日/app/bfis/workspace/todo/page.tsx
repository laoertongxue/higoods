import { OFAPageTemplate } from "@/components/ofa-page-template"

export default function TodoPage() {
  return (
    <OFAPageTemplate
      title="我的待办"
      description="待处理的审批、核对、确认等事项"
      kpiCards={[
        { title: "待审批", value: "12", change: "+3", changeType: "up" },
        { title: "待核对", value: "8", change: "-2", changeType: "down" },
        { title: "待确认", value: "15", change: "+5", changeType: "up" },
        { title: "已逾期", value: "3", change: "+1", changeType: "up" },
      ]}
      tableColumns={["编号", "类型", "标题", "发起人", "发起时间", "截止时间", "状态", "操作"]}
    />
  )
}
