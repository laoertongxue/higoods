import { OFAPageTemplate } from "@/components/ofa-page-template"

export default function WriteoffPage() {
  return (
    <OFAPageTemplate
      title="核销中心"
      description="应收应付款项核销管理"
      kpiCards={[
        { title: "待核销", value: "45笔", change: "+8", changeType: "up" },
        { title: "待核销金额", value: "$123,456", change: "+12%", changeType: "up" },
        { title: "本月已核销", value: "$567,890", change: "+25%", changeType: "up" },
        { title: "自动核销率", value: "78%", change: "+5%", changeType: "up" },
      ]}
      tableColumns={["核销单号", "类型", "往来单位", "核销金额", "核销时间", "状态", "操作"]}
    />
  )
}
