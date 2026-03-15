import { OFAPageTemplate } from "@/components/ofa-page-template"

export default function FixedAssetsPage() {
  return (
    <OFAPageTemplate
      title="固定资产台账"
      description="固定资产登记与管理"
      kpiCards={[
        { title: "资产总数", value: "456", change: "+12", changeType: "up" },
        { title: "资产原值", value: "$2,345,678", change: "+5%", changeType: "up" },
        { title: "累计折旧", value: "$567,890", change: "+8%", changeType: "up" },
        { title: "净值", value: "$1,777,788", change: "+3%", changeType: "up" },
      ]}
      tableColumns={["资产编号", "资产名称", "类别", "原值", "累计折旧", "净值", "状态", "操作"]}
    />
  )
}
