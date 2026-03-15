"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { SystemNav } from "@/components/system-nav"
import { SidebarNav } from "@/components/sidebar-nav"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { ArrowLeft, Edit, Send, GitBranch, Download, ExternalLink, FileText, AlertCircle } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

// Mock detail data
const mockDetail = {
  id: "AT-20260109-001",
  title: "花型-印尼碎花连衣裙（定位印 A1）",
  status: "APPROVED",
  priority: "高",
  owner: "林小美",
  participants: ["王设计", "张设计"],
  due_at: "2025-12-25",
  artwork_version: "A1",
  frozen_at: "2025-12-20 10:00",
  frozen_by: "王总监",
  project: { id: "PRJ-20251216-001", name: "印尼风格碎花连衣裙" },
  upstream: { id: "RT-20260109-003", name: "改版任务-印尼碎花", type: "改版任务" },
  product: { id: "SPU-001", name: "印尼碎花连衣裙", sku: "SKU-001-Red" },
  artwork_name: "Bunga Tropis A1",
  artwork_type: "印花",
  pattern_mode: "定位印",
  layout_spec: "60cm x 60cm 四方连续，前片胸部定位+下摆满印",
  preview_images: ["/floral-pattern-tropical.jpg"],
  color_scheme: "Pantone 17-1937 主花 + 11-0608 底色",
  color_values: [
    { name: "热带红", pantone: "18-1663 TCX", hex: "#D32F2F", usage: "主花朵", percentage: "25%" },
    { name: "棕榈绿", pantone: "17-0145 TCX", hex: "#388E3C", usage: "叶片", percentage: "35%" },
  ],
  color_card_status: "已确认",
  samples: [{ id: "SPL-001", name: "印尼碎花样衣V1", status: "在库", location: "深圳仓" }],
  pack_files: ["Artwork_Pack_A1.zip"],
  downstream_tasks: [{ id: "ST-001", name: "首单样衣打样", type: "打样", status: "进行中" }],
}

export default function ArtworkTaskDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [createDownstreamOpen, setCreateDownstreamOpen] = useState(false)
  const [selectedDownstream, setSelectedDownstream] = useState({
    sampling: true,
    colorCard: false,
    process: false,
  })

  const STATUS_LABELS: Record<string, string> = {
    NOT_STARTED: "未开始",
    IN_PROGRESS: "进行中",
    PENDING_REVIEW: "待评审",
    APPROVED: "已确认",
    COMPLETED: "已完成",
    BLOCKED: "阻塞",
    CANCELLED: "已取消",
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return "bg-green-500/20 text-green-400 border-green-500/30"
      case "IN_PROGRESS":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30"
      case "PENDING_REVIEW":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SystemNav />
      <div className="flex flex-1 overflow-hidden">
        <SidebarNav />
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-xl font-bold">花型任务 · {id}</h1>
                    <Badge className={`${getStatusBadge(mockDetail.status)} border`}>
                      {STATUS_LABELS[mockDetail.status]}
                    </Badge>
                    <Badge variant="outline">{mockDetail.artwork_version}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{mockDetail.title}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  <Edit className="h-4 w-4 mr-2" />
                  编辑方案
                </Button>
                <Button variant="outline" size="sm">
                  <Send className="h-4 w-4 mr-2" />
                  提交评审
                </Button>
                <Button size="sm" onClick={() => setCreateDownstreamOpen(true)}>
                  <GitBranch className="h-4 w-4 mr-2" />
                  创建下游
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-6">
              {/* Left: Tabs */}
              <div className="col-span-3">
                <Tabs defaultValue="plan" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="plan">花型方案</TabsTrigger>
                    <TabsTrigger value="color">色彩与色卡</TabsTrigger>
                    <TabsTrigger value="production">生产文件与工艺</TabsTrigger>
                    <TabsTrigger value="samples">关联样衣与参考</TabsTrigger>
                    <TabsTrigger value="pack">花型包与版本</TabsTrigger>
                    <TabsTrigger value="logs">日志与评审</TabsTrigger>
                  </TabsList>

                  {/* Tab 1: Plan */}
                  <TabsContent value="plan" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">A. 花型定义</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">花型名称:</span>
                            <span className="ml-2 font-medium">{mockDetail.artwork_name}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">花型类型:</span>
                            <span className="ml-2">{mockDetail.artwork_type}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">图案方式:</span>
                            <span className="ml-2">{mockDetail.pattern_mode}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">B. 版面/排版</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm">{mockDetail.layout_spec}</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">C. 风险与验证点</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-start gap-2 text-sm">
                          <AlertCircle className="h-4 w-4 text-orange-400 mt-0.5" />
                          <span>注意花型对花，允许误差±2mm</span>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Tab 2: Color */}
                  <TabsContent value="color" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">色彩方案</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm">{mockDetail.color_scheme}</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">色值列表</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>色名</TableHead>
                              <TableHead>标准</TableHead>
                              <TableHead>色值</TableHead>
                              <TableHead>用途</TableHead>
                              <TableHead>占比</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {mockDetail.color_values.map((color, idx) => (
                              <TableRow key={idx}>
                                <TableCell>{color.name}</TableCell>
                                <TableCell>{color.pantone}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded border" style={{ backgroundColor: color.hex }} />
                                    <span className="text-xs">{color.hex}</span>
                                  </div>
                                </TableCell>
                                <TableCell>{color.usage}</TableCell>
                                <TableCell>{color.percentage}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">色卡状态</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                          {mockDetail.color_card_status}
                        </Badge>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Tab 3: Production */}
                  <TabsContent value="production" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">生产文件</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2 text-sm">
                          <FileText className="h-4 w-4 text-blue-400" />
                          <span>Print_A1.pdf</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <Download className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Tab 4: Samples */}
                  <TabsContent value="samples" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">关联样衣</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>样衣编号</TableHead>
                              <TableHead>状态</TableHead>
                              <TableHead>位置</TableHead>
                              <TableHead>操作</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {mockDetail.samples.map((sample) => (
                              <TableRow key={sample.id}>
                                <TableCell>
                                  <Link href={`/samples/detail/${sample.id}`} className="text-primary hover:underline">
                                    {sample.id}
                                  </Link>
                                </TableCell>
                                <TableCell>{sample.status}</TableCell>
                                <TableCell>{sample.location}</TableCell>
                                <TableCell>
                                  <Button variant="ghost" size="sm">
                                    发起使用申请
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Tab 5: Pack */}
                  <TabsContent value="pack" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">花型包附件</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2 text-sm">
                          <FileText className="h-4 w-4 text-green-400" />
                          <span>{mockDetail.pack_files[0]}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <Download className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">版本信息</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">版本:</span>
                          <span className="ml-2 font-medium">{mockDetail.artwork_version}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">冻结时间:</span>
                          <span className="ml-2">{mockDetail.frozen_at}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">冻结人:</span>
                          <span className="ml-2">{mockDetail.frozen_by}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Tab 6: Logs */}
                  <TabsContent value="logs" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">操作日志</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex gap-3 text-sm">
                            <div className="w-32 text-muted-foreground">2025-12-20 10:00</div>
                            <div>
                              <span className="font-medium">王总监</span> 通过并冻结花型包
                            </div>
                          </div>
                          <div className="flex gap-3 text-sm">
                            <div className="w-32 text-muted-foreground">2025-12-19 16:30</div>
                            <div>
                              <span className="font-medium">林小美</span> 提交评审
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Right: Related Info */}
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">关联信息</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div>
                      <div className="text-muted-foreground mb-1">项目</div>
                      <Link
                        href={`/projects/${mockDetail.project.id}`}
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        {mockDetail.project.name}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                    <div>
                      <div className="text-muted-foreground mb-1">上游实例</div>
                      <Link href="#" className="text-primary hover:underline flex items-center gap-1">
                        {mockDetail.upstream.name}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                    <div>
                      <div className="text-muted-foreground mb-1">商品</div>
                      <span>{mockDetail.product.name}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">快捷入口</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button variant="outline" size="sm" className="w-full justify-start bg-transparent">
                      制版任务
                    </Button>
                    <Button variant="outline" size="sm" className="w-full justify-start bg-transparent">
                      打样任务
                    </Button>
                    <Button variant="outline" size="sm" className="w-full justify-start bg-transparent">
                      样衣库存
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* AT4: Create Downstream Dialog */}
      <Dialog open={createDownstreamOpen} onOpenChange={setCreateDownstreamOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>创建下游任务</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">系统建议创建以下下游任务：</p>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="sampling"
                  checked={selectedDownstream.sampling}
                  onCheckedChange={(checked) =>
                    setSelectedDownstream({ ...selectedDownstream, sampling: checked as boolean })
                  }
                />
                <Label htmlFor="sampling" className="flex-1 cursor-pointer">
                  首单样衣打样
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox
                  id="colorCard"
                  checked={selectedDownstream.colorCard}
                  onCheckedChange={(checked) =>
                    setSelectedDownstream({ ...selectedDownstream, colorCard: checked as boolean })
                  }
                />
                <Label htmlFor="colorCard" className="flex-1 cursor-pointer">
                  色卡确认
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox
                  id="process"
                  checked={selectedDownstream.process}
                  onCheckedChange={(checked) =>
                    setSelectedDownstream({ ...selectedDownstream, process: checked as boolean })
                  }
                />
                <Label htmlFor="process" className="flex-1 cursor-pointer">
                  工艺单任务
                </Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDownstreamOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => {
                toast.success("下游任务已创建")
                setCreateDownstreamOpen(false)
              }}
            >
              确认创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
