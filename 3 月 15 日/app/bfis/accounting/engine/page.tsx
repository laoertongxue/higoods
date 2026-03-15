import { OFAPageTemplate } from "@/components/ofa-page-template"

export default function AccountingEnginePage() {
  return (
    <OFAPageTemplate
      title="会计引擎（规则与映射）"
      description="会计凭证生成规则与科目映射配置"
      kpiCards={[
        { title: "规则总数", value: "128", change: "+5", changeType: "up" },
        { title: "启用规则", value: "115", change: "+3", changeType: "up" },
        { title: "映射关系", value: "256", change: "+12", changeType: "up" },
        { title: "本月触发次数", value: "12,345", change: "+8%", changeType: "up" },
      ]}
      tableColumns={["规则编号", "规则名称", "业务类型", "借方科目", "贷方科目", "状态", "操作"]}
    />
  )
}
