import { OFAPageTemplate } from "@/components/ofa-page-template"

export default function DepreciationPage() {
  return (
    <OFAPageTemplate
      title="资本化与折旧"
      description="资产资本化与折旧计提管理"
      kpiCards={[
        { title: "本月折旧", value: "$23,456", change: "+2%", changeType: "up" },
        { title: "年度累计折旧", value: "$234,567", change: "", changeType: "neutral" },
        { title: "待资本化", value: "8", change: "+3", changeType: "up" },
        { title: "本月资本化", value: "$45,678", change: "", changeType: "neutral" },
      ]}
      tableColumns={["资产编号", "资产名称", "折旧方法", "折旧年限", "本月折旧", "累计折旧", "操作"]}
    />
  )
}
