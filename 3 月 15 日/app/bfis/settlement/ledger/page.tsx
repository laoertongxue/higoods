import { OFAPageTemplate } from "@/components/ofa-page-template"

export default function SettlementLedgerPage() {
  return (
    <OFAPageTemplate
      title="往来台账"
      description="应收应付往来款项台账管理"
      kpiCards={[
        { title: "应收余额", value: "$456,789", change: "+5%", changeType: "up" },
        { title: "应付余额", value: "$345,678", change: "+3%", changeType: "up" },
        { title: "净往来", value: "$111,111", change: "+15%", changeType: "up" },
        { title: "逾期款项", value: "$23,456", change: "-8%", changeType: "down" },
      ]}
      tableColumns={["往来单位", "类型", "币种", "应收", "应付", "净额", "账龄", "操作"]}
    />
  )
}
