import { OFAPageTemplate } from "@/components/ofa-page-template"

export default function IntegrationPage() {
  return (
    <OFAPageTemplate
      title="集成中心"
      description="外部系统集成与接口管理"
      kpiCards={[
        { title: "集成系统", value: "8", change: "+1", changeType: "up" },
        { title: "接口数量", value: "45", change: "+5", changeType: "up" },
        { title: "今日调用", value: "12,345", change: "+8%", changeType: "up" },
        { title: "错误率", value: "0.1%", change: "-0.05%", changeType: "down" },
      ]}
      tableColumns={["系统名称", "接口名称", "调用方向", "今日调用", "成功率", "状态", "操作"]}
    />
  )
}
