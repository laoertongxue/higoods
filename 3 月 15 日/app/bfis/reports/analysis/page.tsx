import { OFAPageTemplate } from "@/components/ofa-page-template"

export default function AnalysisPage() {
  return (
    <OFAPageTemplate
      title="经营分析"
      description="多维度经营数据分析与对比"
      kpiCards={[
        { title: "营收同比", value: "+18.5%", change: "+3.2%", changeType: "up" },
        { title: "成本占比", value: "68.5%", change: "-1.5%", changeType: "down" },
        { title: "费用占比", value: "15.2%", change: "-0.8%", changeType: "down" },
        { title: "人效", value: "$125,000", change: "+12%", changeType: "up" },
      ]}
      tableColumns={["维度", "本期", "上期", "同比", "环比", "目标", "达成率"]}
    />
  )
}
