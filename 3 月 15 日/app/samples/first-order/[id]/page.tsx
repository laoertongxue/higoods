"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { SystemNav } from "@/components/system-nav"
import { SidebarNav } from "@/components/sidebar-nav"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, ExternalLink, Upload, CheckCircle, Clock, Package, FileText, ImageIcon } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"

// Mock detail data
const mockTaskDetail = {
  id: "FS-20260109-005",
  title: "首单打样-碎花连衣裙",
  status: "IN_QC",
  milestone: "验收中",
  project: { code: "PRJ-20260105-001", name: "印尼风格碎花连衣裙" },
  source: { type: "制版", code: "PT-20260109-002", version: "P1" },
  factory: { code: "JKT-Factory-03", name: "雅加达第三工厂" },
  targetSite: "雅加达",
  owner: "王版师",
  expectedArrival: "2026-01-12",
  trackingNo: "JNE-884392001",
  arrivedAt: "2026-01-12 15:20",
  stockedInAt: "2026-01-12 17:05",
  sample: { code: "SY-JKT-00021", name: "碎花连衣裙-P1A1", warehouse: "样衣仓", location: "A-02-15" },
  acceptanceResult: "需改版",
  milestones: [
    { label: "创建", time: "2026-01-09 10:30", completed: true },
    { label: "录入发货", time: "2026-01-10 14:00", completed: true },
    { label: "到样签收", time: "2026-01-12 15:20", completed: true },
    { label: "核对入库", time: "2026-01-12 17:05", completed: true },
    { label: "验收结论", time: null, completed: false },
    { label: "完成", time: null, completed: false },
  ],
  issues: [
    { category: "版型", description: "腰围偏紧，需放松1.5cm", severity: "中", evidence: "试穿照片" },
    { category: "花型", description: "定位印偏移1.2cm", severity: "高", evidence: "实物照片" },
  ],
}

export default function FirstSampleDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [acceptanceDialogOpen, setAcceptanceDialogOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SystemNav />
      <div className="flex flex-1 overflow-hidden">
        <SidebarNav />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Header */}
          <div className="border-b bg-white px-6 py-4 sticky top-0 z-10 -mx-6 -mt-6 mb-6">
            <div className="flex items-center gap-4 mb-4">
              <Button variant="ghost" size="sm" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回列表
              </Button>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-semibold text-gray-900">首单样衣打样 · {mockTaskDetail.id}</h1>
                  <Badge className="bg-yellow-100 text-yellow-800">{mockTaskDetail.milestone}</Badge>
                  <span className="text-sm text-gray-500">目标站点：{mockTaskDetail.targetSite}</span>
                  <span className="text-sm text-gray-500">负责人：{mockTaskDetail.owner}</span>
                  <span className="text-sm text-gray-500">预计到样：{mockTaskDetail.expectedArrival}</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">{mockTaskDetail.title}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline">
                录入运单
              </Button>
              <Button size="sm" variant="outline">
                到样签收
              </Button>
              <Button size="sm" variant="outline">
                核对入库
              </Button>
              <Button size="sm" onClick={() => setAcceptanceDialogOpen(true)}>
                填写验收
              </Button>
              <Button size="sm" variant="outline">
                <ExternalLink className="h-4 w-4 mr-2" />
                打开样衣库存
              </Button>
              <Button size="sm" variant="outline">
                完成
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="col-span-2 space-y-6">
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-6">
                  <TabsTrigger value="overview">概览</TabsTrigger>
                  <TabsTrigger value="input">输入包</TabsTrigger>
                  <TabsTrigger value="logistics">物流与到样</TabsTrigger>
                  <TabsTrigger value="stock">入库建档</TabsTrigger>
                  <TabsTrigger value="acceptance">验收与结论</TabsTrigger>
                  <TabsTrigger value="logs">日志</TabsTrigger>
                </TabsList>

                {/* Tab1: Overview */}
                <TabsContent value="overview" className="space-y-6">
                  <div className="bg-white rounded-lg border p-6">
                    <h3 className="text-sm font-medium text-gray-900 mb-4">里程碑时间轴</h3>
                    <div className="relative">
                      {mockTaskDetail.milestones.map((milestone, index) => (
                        <div key={index} className="flex items-start gap-4 mb-6 last:mb-0">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center ${milestone.completed ? "bg-green-100" : "bg-gray-100"}`}
                          >
                            {milestone.completed ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : (
                              <Clock className="h-4 w-4 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{milestone.label}</div>
                            <div className="text-sm text-gray-500">{milestone.time || "待完成"}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-lg border p-4">
                      <div className="text-sm text-gray-500 mb-1">工厂</div>
                      <div className="font-medium text-gray-900">{mockTaskDetail.factory.name}</div>
                    </div>
                    <div className="bg-white rounded-lg border p-4">
                      <div className="text-sm text-gray-500 mb-1">预计到样</div>
                      <div className="font-medium text-gray-900">{mockTaskDetail.expectedArrival}</div>
                    </div>
                  </div>
                </TabsContent>

                {/* Tab2: Input Packages */}
                <TabsContent value="input" className="space-y-6">
                  <div className="bg-white rounded-lg border p-6">
                    <h3 className="text-sm font-medium text-gray-900 mb-4">制版包</h3>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <FileText className="h-5 w-5 text-gray-400" />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">PT-20260109-002 (P1)</div>
                        <div className="text-sm text-gray-500">制版任务</div>
                      </div>
                      <Button size="sm" variant="ghost">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border p-6">
                    <h3 className="text-sm font-medium text-gray-900 mb-4">花型包</h3>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <FileText className="h-5 w-5 text-gray-400" />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">AT-20260109-001 (A1)</div>
                        <div className="text-sm text-gray-500">花型任务</div>
                      </div>
                      <Button size="sm" variant="ghost">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                {/* Tab3: Logistics */}
                <TabsContent value="logistics" className="space-y-6">
                  <div className="bg-white rounded-lg border p-6">
                    <h3 className="text-sm font-medium text-gray-900 mb-4">发货信息</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-gray-500">运单号</div>
                        <div className="font-medium text-gray-900 font-mono">{mockTaskDetail.trackingNo}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">发货时间</div>
                        <div className="font-medium text-gray-900">2026-01-10 14:00</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border p-6">
                    <h3 className="text-sm font-medium text-gray-900 mb-4">到样签收记录</h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">已签收</div>
                          <div className="text-sm text-gray-500">签收时间：{mockTaskDetail.arrivedAt}</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <div className="w-20 h-20 bg-gray-100 rounded flex items-center justify-center">
                          <ImageIcon className="h-8 w-8 text-gray-400" />
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Tab4: Stock-in */}
                <TabsContent value="stock" className="space-y-6">
                  <div className="bg-white rounded-lg border p-6">
                    <h3 className="text-sm font-medium text-gray-900 mb-4">核对入库信息</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-gray-500">样衣编号</div>
                        <div className="font-medium text-blue-600">{mockTaskDetail.sample.code}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">入库时间</div>
                        <div className="font-medium text-gray-900">{mockTaskDetail.stockedInAt}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">仓库</div>
                        <div className="font-medium text-gray-900">{mockTaskDetail.sample.warehouse}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">库位</div>
                        <div className="font-medium text-gray-900">{mockTaskDetail.sample.location}</div>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t">
                      <Button size="sm" variant="outline">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        打开样衣库存抽屉
                      </Button>
                      <Button size="sm" variant="outline" className="ml-2 bg-transparent">
                        查看样衣台账
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                {/* Tab5: Acceptance */}
                <TabsContent value="acceptance" className="space-y-6">
                  <div className="bg-white rounded-lg border p-6">
                    <h3 className="text-sm font-medium text-gray-900 mb-4">验收结果</h3>
                    {mockTaskDetail.acceptanceResult ? (
                      <Badge className="bg-orange-100 text-orange-800">{mockTaskDetail.acceptanceResult}</Badge>
                    ) : (
                      <span className="text-sm text-gray-500">待验收</span>
                    )}
                  </div>

                  <div className="bg-white rounded-lg border p-6">
                    <h3 className="text-sm font-medium text-gray-900 mb-4">问题点记录</h3>
                    <div className="space-y-3">
                      {mockTaskDetail.issues.map((issue, index) => (
                        <div key={index} className="p-4 bg-red-50 rounded-lg border border-red-200">
                          <div className="flex items-start justify-between mb-2">
                            <Badge variant="secondary">{issue.category}</Badge>
                            <Badge variant="destructive">{issue.severity}</Badge>
                          </div>
                          <div className="text-sm text-gray-900 mb-2">{issue.description}</div>
                          <div className="text-xs text-gray-500">证据：{issue.evidence}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                {/* Tab6: Logs */}
                <TabsContent value="logs" className="space-y-6">
                  <div className="bg-white rounded-lg border p-6">
                    <h3 className="text-sm font-medium text-gray-900 mb-4">台账事件回执</h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                        <Package className="h-5 w-5 text-blue-600" />
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">到样签收</div>
                          <div className="text-sm text-gray-500">2026-01-12 15:20</div>
                        </div>
                        <Button size="sm" variant="ghost">
                          查看
                        </Button>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">核对入库</div>
                          <div className="text-sm text-gray-500">2026-01-12 17:05</div>
                        </div>
                        <Button size="sm" variant="ghost">
                          查看
                        </Button>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Right Sidebar */}
            <div className="space-y-4">
              <div className="bg-white rounded-lg border p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">项目信息</h3>
                <div className="space-y-2">
                  <div>
                    <div className="text-xs text-gray-500">项目编号</div>
                    <button className="text-sm text-blue-600 hover:text-blue-800">{mockTaskDetail.project.code}</button>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">项目名称</div>
                    <div className="text-sm text-gray-900">{mockTaskDetail.project.name}</div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">上游实例</h3>
                <div className="space-y-2">
                  <button className="text-sm text-blue-600 hover:text-blue-800">
                    {mockTaskDetail.source.code} ({mockTaskDetail.source.version})
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-lg border p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">快捷联查</h3>
                <div className="space-y-2">
                  <Button variant="outline" size="sm" className="w-full justify-start bg-transparent">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    样衣台账
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start bg-transparent">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    样衣库存
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start bg-transparent">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    制版任务
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Acceptance Dialog */}
      <Dialog open={acceptanceDialogOpen} onOpenChange={setAcceptanceDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>填写验收结论</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>验收结果 *</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="选择验收结果" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pass">通过</SelectItem>
                  <SelectItem value="revision">需改版</SelectItem>
                  <SelectItem value="resample">需补打样</SelectItem>
                  <SelectItem value="reject">淘汰/终止</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>问题点描述</Label>
              <Textarea rows={4} placeholder="描述发现的问题..." />
            </div>
            <div>
              <Label>建议动作</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="选择建议动作" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="revision">创建改版任务</SelectItem>
                  <SelectItem value="adjust-pattern">调整制版</SelectItem>
                  <SelectItem value="adjust-artwork">调整花型</SelectItem>
                  <SelectItem value="resample">补打样</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>证据附件</Label>
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" />
                上传附件
              </Button>
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1 bg-transparent"
                onClick={() => setAcceptanceDialogOpen(false)}
              >
                取消
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  toast({ title: "验收结论已提交" })
                  setAcceptanceDialogOpen(false)
                }}
              >
                提交结论
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
