import { OFAPageTemplate } from "@/components/ofa-page-template"

export default function BridgePage() {
  return (
    <OFAPageTemplate
      title="口径差异桥（对金蝶）"
      description="管理口径与金蝶财务口径的差异分析"
      kpiCards={[
        { title: "管理口径营收", value: "$12,345,678", change: "", changeType: "neutral" },
        { title: "金蝶口径营收", value: "$12,123,456", change: "", changeType: "neutral" },
        { title: "差异金额", value: "$222,222", change: "", changeType: "neutral" },
        { title: "差异率", value: "1.8%", change: "", changeType: "neutral" },
      ]}
      tableColumns={["差异项", "管理口径", "金蝶口径", "差异", "差异原因", "调整建议"]}
    />
  )
}
