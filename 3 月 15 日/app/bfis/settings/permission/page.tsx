import { OFAPageTemplate } from "@/components/ofa-page-template"

export default function PermissionPage() {
  return (
    <OFAPageTemplate
      title="权限与审计"
      description="用户权限管理与操作审计"
      kpiCards={[
        { title: "用户数量", value: "45", change: "+3", changeType: "up" },
        { title: "角色数量", value: "12", change: "+1", changeType: "up" },
        { title: "今日操作", value: "1,256", change: "+15%", changeType: "up" },
        { title: "异常操作", value: "3", change: "", changeType: "neutral" },
      ]}
      tableColumns={["用户", "角色", "部门", "最近登录", "操作次数", "状态", "操作"]}
    />
  )
}
