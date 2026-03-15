import { OFAPageTemplate } from "@/components/ofa-page-template"

export default function ClosePage() {
  return (
    <OFAPageTemplate
      title="关账管理"
      description="月度关账流程与状态管理"
      kpiCards={[
        { title: "当前账期", value: "2026-01", change: "", changeType: "neutral" },
        { title: "关账进度", value: "60%", change: "+15%", changeType: "up" },
        { title: "待完成任务", value: "12", change: "-5", changeType: "down" },
        { title: "剩余天数", value: "5天", change: "", changeType: "neutral" },
      ]}
      tableColumns={["任务编号", "任务名称", "责任人", "截止时间", "完成时间", "状态", "操作"]}
    />
  )
}
