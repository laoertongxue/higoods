import { OFAPageTemplate } from "@/components/ofa-page-template"

export default function MasterDataPage() {
  return (
    <OFAPageTemplate
      title="主数据与映射"
      description="主数据管理与系统映射配置"
      kpiCards={[
        { title: "主数据类型", value: "15", change: "", changeType: "neutral" },
        { title: "数据总量", value: "12,345", change: "+256", changeType: "up" },
        { title: "映射关系", value: "456", change: "+23", changeType: "up" },
        { title: "待同步", value: "12", change: "-5", changeType: "down" },
      ]}
      tableColumns={["数据类型", "编码", "名称", "外部编码", "映射状态", "更新时间", "操作"]}
    />
  )
}
