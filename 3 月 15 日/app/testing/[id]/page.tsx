"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { SystemNav } from "@/components/system-nav"
import { SidebarNav } from "@/components/sidebar-nav"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  ArrowLeft,
  Crown,
  Video,
  Radio,
  Edit,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Clock,
  TrendingUp,
  Eye,
  MousePointer,
  ShoppingCart,
  Play,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from "lucide-react"

const getTestingDetail = (id: string) => {
  const testingData: Record<string, any> = {
    "TK-20251220-001": {
      id: "TK-20251220-001",
      projectId: "PRJ-20251216-001",
      projectName: "印尼风格碎花连衣裙",
      projectStage: "测款阶段",
      workItemId: "WI-009",
      workItemName: "直播测款",
      testingType: "live",
      executionRole: "main",
      executionSource: "normal",
      status: "completed",
      creator: "张丽",
      createTime: "2025-12-20 14:30",
      channel: "TikTok",
      platform: "TikTok Live",
      startTime: "2025-12-20 19:00",
      endTime: "2025-12-20 23:30",
      broadcaster: "小美穿搭",
      broadcasterAccount: "@xiaomei_style",
      sampleId: "SPL-001",
      sampleName: "印尼碎花连衣裙样衣-M码",
      liveSessions: [
        {
          id: "LS-001",
          sessionNo: "第1场",
          startTime: "2025-12-20 19:00",
          endTime: "2025-12-20 20:30",
          duration: 90,
          peakViewers: 8500,
          totalViewers: 32000,
          orders: 56,
          gmv: 8400,
          status: "completed",
        },
        {
          id: "LS-002",
          sessionNo: "第2场",
          startTime: "2025-12-20 21:00",
          endTime: "2025-12-20 22:30",
          duration: 90,
          peakViewers: 15600,
          totalViewers: 45000,
          orders: 78,
          gmv: 11700,
          status: "completed",
        },
        {
          id: "LS-003",
          sessionNo: "第3场",
          startTime: "2025-12-20 22:30",
          endTime: "2025-12-20 23:30",
          duration: 60,
          peakViewers: 6200,
          totalViewers: 12000,
          orders: 22,
          gmv: 3300,
          status: "completed",
        },
      ],
      // 直播数据（汇总）
      liveData: {
        peakViewers: 15600,
        totalViewers: 89000,
        totalDuration: 240,
        likes: 45600,
        comments: 3200,
        shares: 1890,
        productClicks: 2340,
        addToCart: 890,
        orders: 156,
        conversionRate: 4.2,
        gmv: 23400,
      },
      // 结论
      conclusion: "pass",
      conclusionNote: "直播数据表现优秀，转化率超过预期，用户反馈积极，建议进入工程阶段。",
      meetsCompletion: true,
      canBeMain: true,
      // 日志
      logs: [
        { id: 1, action: "创建测款", user: "张丽", time: "2025-12-20 14:30", note: "新建直播测款任务" },
        { id: 2, action: "第1场开始", user: "小美", time: "2025-12-20 19:00", note: "直播第1场开始" },
        { id: 3, action: "第1场结束", user: "小美", time: "2025-12-20 20:30", note: "直播第1场结束，成交56件" },
        { id: 4, action: "第2场开始", user: "小美", time: "2025-12-20 21:00", note: "直播第2场开始" },
        { id: 5, action: "第2场结束", user: "小美", time: "2025-12-20 22:30", note: "直播第2场结束，成交78件" },
        { id: 6, action: "第3场开始", user: "小美", time: "2025-12-20 22:30", note: "直播第3场开始" },
        { id: 7, action: "第3场结束", user: "小美", time: "2025-12-20 23:30", note: "直播第3场结束，成交22件" },
        { id: 8, action: "数据录入", user: "张丽", time: "2025-12-21 09:00", note: "录入汇总直播数据" },
        { id: 9, action: "结论更新", user: "李经理", time: "2025-12-21 10:00", note: "判定为通过" },
        { id: 10, action: "设为主执行", user: "李经理", time: "2025-12-21 10:05", note: "设为主执行实例" },
      ],
    },
    "TK-20251219-001": {
      id: "TK-20251219-001",
      projectId: "PRJ-20251216-002",
      projectName: "基础款白色T恤",
      projectStage: "测款阶段",
      workItemId: "WI-009",
      workItemName: "短视频测款",
      testingType: "video",
      executionRole: "main",
      executionSource: "normal",
      status: "completed",
      creator: "王芳",
      createTime: "2025-12-19 09:00",
      channel: "TikTok",
      platform: "TikTok 短视频",
      startTime: "2025-12-19 10:00",
      endTime: "2025-12-22 10:00",
      broadcaster: "穿搭日记",
      broadcasterAccount: "@chuanda_diary",
      sampleId: "SPL-003",
      sampleName: "基础款白色T恤样衣-L码",
      videos: [
        {
          id: "VID-001",
          videoNo: "视频1",
          title: "夏日必备白T，百搭又清爽",
          publishTime: "2025-12-19 10:00",
          endTime: "2025-12-22 10:00",
          duration: 45,
          plays: 58000,
          completionRate: 48,
          likes: 4200,
          comments: 280,
          shares: 160,
          orders: 112,
          status: "completed",
        },
        {
          id: "VID-002",
          videoNo: "视频2",
          title: "白色T恤的5种穿搭方式",
          publishTime: "2025-12-19 14:00",
          endTime: "2025-12-22 14:00",
          duration: 62,
          plays: 42000,
          completionRate: 42,
          likes: 3100,
          comments: 180,
          shares: 120,
          orders: 86,
          status: "completed",
        },
        {
          id: "VID-003",
          videoNo: "视频3",
          title: "质感白T开箱测评",
          publishTime: "2025-12-20 10:00",
          endTime: "2025-12-23 10:00",
          duration: 38,
          plays: 25000,
          completionRate: 45,
          likes: 1600,
          comments: 100,
          shares: 60,
          orders: 47,
          status: "completed",
        },
      ],
      // 短视频数据（汇总）
      videoData: {
        totalVideos: 3,
        plays: 125000,
        completionRate: 45,
        avgWatchTime: 18,
        likes: 8900,
        comments: 560,
        shares: 340,
        bookmarks: 1200,
        clicks: 3400,
        addToCart: 890,
        orders: 245,
        conversionRate: 2.8,
      },
      // 结论
      conclusion: "pass",
      conclusionNote: "短视频播放量和互动数据良好，转化率达标，建议进入工程阶段。",
      meetsCompletion: true,
      canBeMain: true,
      // 日志
      logs: [
        { id: 1, action: "创建测款", user: "王芳", time: "2025-12-19 09:00", note: "新建短视频测款任务" },
        { id: 2, action: "视频1发布", user: "穿搭日记", time: "2025-12-19 10:00", note: "视频1已发布" },
        { id: 3, action: "视频2发布", user: "穿搭日记", time: "2025-12-19 14:00", note: "视频2已发布" },
        { id: 4, action: "视频3发布", user: "穿搭日记", time: "2025-12-20 10:00", note: "视频3已发布" },
        { id: 5, action: "数据录入", user: "王芳", time: "2025-12-22 12:00", note: "录入72小时数据" },
        { id: 6, action: "结论更新", user: "张经理", time: "2025-12-22 14:00", note: "判定为通过" },
      ],
    },
  }
  return testingData[id] || testingData["TK-20251220-001"]
}

export default function TestingDetailPage() {
  const params = useParams()
  const id = params.id as string
  const testing = getTestingDetail(id)

  const [voidDialogOpen, setVoidDialogOpen] = useState(false)
  const [conclusionDialogOpen, setConclusionDialogOpen] = useState(false)
  const [newConclusion, setNewConclusion] = useState(testing.conclusion)
  const [conclusionNote, setConclusionNote] = useState("")
  const [voidReason, setVoidReason] = useState("")
  const [logPage, setLogPage] = useState(1)
  const logsPerPage = 5

  const isLive = testing.testingType === "live"

  const getExecutionRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      main: "主执行",
      supplement: "补充",
      retry: "返工",
      experiment: "试验",
    }
    return labels[role] || role
  }

  const getExecutionSourceLabel = (source: string) => {
    return source === "normal" ? "正常流程" : "工作项完成后补充"
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      not_started: "未开始",
      in_progress: "进行中",
      completed: "已完成",
      voided: "已作废",
    }
    return labels[status] || status
  }

  const getStatusVariant = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      not_started: "secondary",
      in_progress: "default",
      completed: "outline",
      voided: "destructive",
    }
    return variants[status] || "default"
  }

  const getConclusionLabel = (conclusion: string) => {
    const labels: Record<string, string> = {
      pass: "通过",
      pending: "待定",
      fail: "不通过",
    }
    return labels[conclusion] || conclusion
  }

  const getConclusionColor = (conclusion: string) => {
    const colors: Record<string, string> = {
      pass: "text-green-600 bg-green-50 border-green-200",
      pending: "text-amber-600 bg-amber-50 border-amber-200",
      fail: "text-red-600 bg-red-50 border-red-200",
    }
    return colors[conclusion] || "text-muted-foreground bg-muted"
  }

  const handleSetAsMain = () => {
    alert("已设为主执行实例")
  }

  const handleUpdateConclusion = () => {
    alert(`结论已更新为：${getConclusionLabel(newConclusion)}`)
    setConclusionDialogOpen(false)
  }

  const handleVoidTesting = () => {
    if (voidReason.trim()) {
      alert(`测款已作废，原因：${voidReason}`)
      setVoidDialogOpen(false)
    }
  }

  const totalLogPages = Math.ceil(testing.logs.length / logsPerPage)
  const paginatedLogs = testing.logs.slice((logPage - 1) * logsPerPage, logPage * logsPerPage)

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SystemNav />
      <div className="flex flex-1 overflow-hidden">
        <SidebarNav />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 返回按钮和标题 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/testing">
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  返回列表
                </Link>
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-foreground">{testing.id}</h1>
                  <Badge variant={getStatusVariant(testing.status)}>{getStatusLabel(testing.status)}</Badge>
                  {testing.executionRole === "main" && (
                    <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                      <Crown className="w-3 h-3 mr-1" />
                      主执行实例
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {isLive ? "直播测款" : "短视频测款"} · {testing.channel}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {testing.executionRole !== "main" && (
                <Button variant="outline" onClick={handleSetAsMain}>
                  <Crown className="w-4 h-4 mr-2" />
                  设为主执行实例
                </Button>
              )}
              <Button variant="outline" onClick={() => setConclusionDialogOpen(true)}>
                <Edit className="w-4 h-4 mr-2" />
                更新结论
              </Button>
              <Button
                variant="outline"
                className="text-destructive bg-transparent"
                onClick={() => setVoidDialogOpen(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                作废
              </Button>
            </div>
          </div>

          {/* 顶部基础信息 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">基础信息</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-6">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">商品项目</div>
                  <Link
                    href={`/projects/${testing.projectId}`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {testing.projectName}
                  </Link>
                  <div className="text-xs text-muted-foreground">{testing.projectId}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">所属阶段</div>
                  <div className="text-sm font-medium">{testing.projectStage}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">工作项</div>
                  <div className="text-sm font-medium">{testing.workItemName}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">执行角色</div>
                  <div className="flex items-center gap-1">
                    {testing.executionRole === "main" && <Crown className="w-3.5 h-3.5 text-amber-500" />}
                    <span className="text-sm font-medium">{getExecutionRoleLabel(testing.executionRole)}</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">执行来源</div>
                  <div className="text-sm font-medium">{getExecutionSourceLabel(testing.executionSource)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">测款类型</div>
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    {isLive ? (
                      <Radio className="w-3.5 h-3.5 text-red-500" />
                    ) : (
                      <Video className="w-3.5 h-3.5 text-blue-500" />
                    )}
                    {isLive ? "直播测款" : "短视频测款"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">渠道/平台</div>
                  <div className="text-sm font-medium">{testing.platform}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">主播/账号</div>
                  <div className="text-sm font-medium">{testing.broadcaster}</div>
                  <div className="text-xs text-muted-foreground">{testing.broadcasterAccount}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">测款开始时间</div>
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    {testing.startTime}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">测款结束时间</div>
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    {testing.endTime}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">使用样衣</div>
                  <Link
                    href={`/samples/${testing.sampleId}`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {testing.sampleName}
                  </Link>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">{isLive ? "直播场次" : "测款视频数"}</div>
                  <div className="text-sm font-medium">
                    {isLive ? `${testing.liveSessions?.length || 0} 场` : `${testing.videos?.length || 0} 个`}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {isLive && testing.liveSessions && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Radio className="w-4 h-4 text-red-500" />
                  直播场次明细
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">场次</TableHead>
                      <TableHead>开始时间</TableHead>
                      <TableHead>结束时间</TableHead>
                      <TableHead className="text-right">时长(分钟)</TableHead>
                      <TableHead className="text-right">最高在线</TableHead>
                      <TableHead className="text-right">总观看</TableHead>
                      <TableHead className="text-right">成交件数</TableHead>
                      <TableHead className="text-right">GMV</TableHead>
                      <TableHead className="text-center">状态</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {testing.liveSessions.map((session: any) => (
                      <TableRow key={session.id}>
                        <TableCell className="font-medium">{session.sessionNo}</TableCell>
                        <TableCell>{session.startTime}</TableCell>
                        <TableCell>{session.endTime}</TableCell>
                        <TableCell className="text-right">{session.duration}</TableCell>
                        <TableCell className="text-right">{session.peakViewers.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{session.totalViewers.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-medium">{session.orders}</TableCell>
                        <TableCell className="text-right font-medium text-primary">
                          ¥{session.gmv.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                            已完成
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* 汇总行 */}
                    <TableRow className="bg-muted/30 font-medium">
                      <TableCell>汇总</TableCell>
                      <TableCell colSpan={2}>
                        {testing.startTime} ~ {testing.endTime}
                      </TableCell>
                      <TableCell className="text-right">{testing.liveData.totalDuration}</TableCell>
                      <TableCell className="text-right">{testing.liveData.peakViewers.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{testing.liveData.totalViewers.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{testing.liveData.orders}</TableCell>
                      <TableCell className="text-right text-primary">
                        ¥{testing.liveData.gmv.toLocaleString()}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {!isLive && testing.videos && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Video className="w-4 h-4 text-blue-500" />
                  测款视频明细
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">视频编号</TableHead>
                      <TableHead>视频标题</TableHead>
                      <TableHead>发布时间</TableHead>
                      <TableHead>统计截止</TableHead>
                      <TableHead className="text-right">时长(秒)</TableHead>
                      <TableHead className="text-right">播放量</TableHead>
                      <TableHead className="text-right">完播率</TableHead>
                      <TableHead className="text-right">点赞</TableHead>
                      <TableHead className="text-right">成交件数</TableHead>
                      <TableHead className="text-center">状态</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {testing.videos.map((video: any) => (
                      <TableRow key={video.id}>
                        <TableCell className="font-medium">{video.videoNo}</TableCell>
                        <TableCell className="max-w-[200px] truncate" title={video.title}>
                          {video.title}
                        </TableCell>
                        <TableCell>{video.publishTime}</TableCell>
                        <TableCell>{video.endTime}</TableCell>
                        <TableCell className="text-right">{video.duration}</TableCell>
                        <TableCell className="text-right">{video.plays.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{video.completionRate}%</TableCell>
                        <TableCell className="text-right">{video.likes.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-medium">{video.orders}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                            已完成
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* 汇总行 */}
                    <TableRow className="bg-muted/30 font-medium">
                      <TableCell>汇总</TableCell>
                      <TableCell>{testing.videoData.totalVideos} 个视频</TableCell>
                      <TableCell colSpan={2}>
                        {testing.startTime} ~ {testing.endTime}
                      </TableCell>
                      <TableCell className="text-right">-</TableCell>
                      <TableCell className="text-right">{testing.videoData.plays.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{testing.videoData.completionRate}%</TableCell>
                      <TableCell className="text-right">{testing.videoData.likes.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{testing.videoData.orders}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* 测款数据汇总 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                测款数据汇总
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLive ? (
                <div className="space-y-6">
                  {/* 直播核心指标 */}
                  <div className="grid grid-cols-6 gap-4">
                    <div className="bg-muted/30 rounded-lg p-4 text-center">
                      <Eye className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
                      <div className="text-2xl font-bold text-foreground">
                        {testing.liveData.peakViewers.toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">最高在线</div>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-4 text-center">
                      <Eye className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
                      <div className="text-2xl font-bold text-foreground">
                        {testing.liveData.totalViewers.toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">总观看</div>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-4 text-center">
                      <Clock className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
                      <div className="text-2xl font-bold text-foreground">{testing.liveData.totalDuration}分钟</div>
                      <div className="text-xs text-muted-foreground">总直播时长</div>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-4 text-center">
                      <MousePointer className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
                      <div className="text-2xl font-bold text-foreground">
                        {testing.liveData.productClicks.toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">商品点击</div>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-4 text-center">
                      <ShoppingCart className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
                      <div className="text-2xl font-bold text-foreground">{testing.liveData.orders}</div>
                      <div className="text-xs text-muted-foreground">成交件数</div>
                    </div>
                    <div className="bg-primary/10 rounded-lg p-4 text-center border-2 border-primary/20">
                      <TrendingUp className="w-5 h-5 mx-auto mb-2 text-primary" />
                      <div className="text-2xl font-bold text-primary">{testing.liveData.conversionRate}%</div>
                      <div className="text-xs text-muted-foreground">转化率</div>
                    </div>
                  </div>
                  {/* 互动数据 */}
                  <div>
                    <div className="text-sm font-medium mb-3">互动数据</div>
                    <div className="grid grid-cols-4 gap-4">
                      <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg">
                        <Heart className="w-4 h-4 text-red-500" />
                        <div>
                          <div className="text-sm font-medium">{testing.liveData.likes.toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">点赞数</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg">
                        <MessageCircle className="w-4 h-4 text-blue-500" />
                        <div>
                          <div className="text-sm font-medium">{testing.liveData.comments.toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">评论数</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg">
                        <Share2 className="w-4 h-4 text-green-500" />
                        <div>
                          <div className="text-sm font-medium">{testing.liveData.shares.toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">分享数</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg">
                        <ShoppingCart className="w-4 h-4 text-amber-500" />
                        <div>
                          <div className="text-sm font-medium">{testing.liveData.addToCart.toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">加购数</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* 短视频核心指标 */}
                  <div className="grid grid-cols-6 gap-4">
                    <div className="bg-muted/30 rounded-lg p-4 text-center">
                      <Play className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
                      <div className="text-2xl font-bold text-foreground">
                        {testing.videoData.plays.toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">总播放量</div>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-4 text-center">
                      <Eye className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
                      <div className="text-2xl font-bold text-foreground">{testing.videoData.completionRate}%</div>
                      <div className="text-xs text-muted-foreground">平均完播率</div>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-4 text-center">
                      <Clock className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
                      <div className="text-2xl font-bold text-foreground">{testing.videoData.avgWatchTime}秒</div>
                      <div className="text-xs text-muted-foreground">平均观看时长</div>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-4 text-center">
                      <MousePointer className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
                      <div className="text-2xl font-bold text-foreground">
                        {testing.videoData.clicks.toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">点击数</div>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-4 text-center">
                      <ShoppingCart className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
                      <div className="text-2xl font-bold text-foreground">{testing.videoData.orders}</div>
                      <div className="text-xs text-muted-foreground">成交件数</div>
                    </div>
                    <div className="bg-primary/10 rounded-lg p-4 text-center border-2 border-primary/20">
                      <TrendingUp className="w-5 h-5 mx-auto mb-2 text-primary" />
                      <div className="text-2xl font-bold text-primary">{testing.videoData.conversionRate}%</div>
                      <div className="text-xs text-muted-foreground">转化率</div>
                    </div>
                  </div>
                  {/* 互动数据 */}
                  <div>
                    <div className="text-sm font-medium mb-3">互动数据</div>
                    <div className="grid grid-cols-5 gap-4">
                      <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg">
                        <Heart className="w-4 h-4 text-red-500" />
                        <div>
                          <div className="text-sm font-medium">{testing.videoData.likes.toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">点赞数</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg">
                        <MessageCircle className="w-4 h-4 text-blue-500" />
                        <div>
                          <div className="text-sm font-medium">{testing.videoData.comments.toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">评论数</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg">
                        <Share2 className="w-4 h-4 text-green-500" />
                        <div>
                          <div className="text-sm font-medium">{testing.videoData.shares.toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">分享数</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg">
                        <Bookmark className="w-4 h-4 text-purple-500" />
                        <div>
                          <div className="text-sm font-medium">{testing.videoData.bookmarks.toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">收藏数</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg">
                        <ShoppingCart className="w-4 h-4 text-amber-500" />
                        <div>
                          <div className="text-sm font-medium">{testing.videoData.addToCart.toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">加购数</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 测款结论 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">测款结论与流程影响</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <div className="text-xs text-muted-foreground mb-2">测款结论</div>
                  <div
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border ${getConclusionColor(testing.conclusion)}`}
                  >
                    {testing.conclusion === "pass" && <CheckCircle className="w-4 h-4" />}
                    {testing.conclusion === "pending" && <Clock className="w-4 h-4" />}
                    {testing.conclusion === "fail" && <AlertTriangle className="w-4 h-4" />}
                    <span className="font-medium">{getConclusionLabel(testing.conclusion)}</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-2">是否满足工作项完成条件</div>
                  <div className="flex items-center gap-2">
                    {testing.meetsCompletion ? (
                      <Badge className="bg-green-100 text-green-700 border-green-200">满足</Badge>
                    ) : (
                      <Badge variant="secondary">不满足</Badge>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-2">是否可作为主执行</div>
                  <div className="flex items-center gap-2">
                    {testing.canBeMain ? (
                      <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                        <Crown className="w-3 h-3 mr-1" />
                        可作为主执行
                      </Badge>
                    ) : (
                      <Badge variant="secondary">不可作为主执行</Badge>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-2">结论说明</div>
                <div className="text-sm bg-muted/30 p-3 rounded-md">{testing.conclusionNote}</div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <strong>重要说明：</strong>
                    测款结论不会自动推进流程。工作项是否完成由系统根据规则判定，阶段推进需在商品项目详情页由负责人手动确认。
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 操作日志 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">操作日志</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {paginatedLogs.map((log: any) => (
                  <div key={log.id} className="flex items-start gap-3 text-sm">
                    <div className="w-32 text-muted-foreground shrink-0">{log.time}</div>
                    <div className="w-20 shrink-0">
                      <Badge variant="outline" className="text-xs">
                        {log.action}
                      </Badge>
                    </div>
                    <div className="w-16 shrink-0 text-muted-foreground">{log.user}</div>
                    <div className="flex-1">{log.note}</div>
                  </div>
                ))}
              </div>
              {totalLogPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    共 {testing.logs.length} 条，第 {logPage}/{totalLogPages} 页
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLogPage((p) => Math.max(1, p - 1))}
                      disabled={logPage === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLogPage((p) => Math.min(totalLogPages, p + 1))}
                      disabled={logPage === totalLogPages}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      {/* 更新结论对话框 */}
      <Dialog open={conclusionDialogOpen} onOpenChange={setConclusionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>更新测款结论</DialogTitle>
            <DialogDescription>请选择新的测款结论并填写说明。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">测款结论</label>
              <Select value={newConclusion} onValueChange={setNewConclusion}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pass">通过</SelectItem>
                  <SelectItem value="pending">待定</SelectItem>
                  <SelectItem value="fail">不通过</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">结论说明</label>
              <Textarea
                placeholder="请填写结论说明..."
                value={conclusionNote}
                onChange={(e) => setConclusionNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConclusionDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleUpdateConclusion}>确认更新</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 作废对话框 */}
      <Dialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>作废测款</DialogTitle>
            <DialogDescription>作废后该测款数据将不再参与工作项完成判定。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                作废原因 <span className="text-destructive">*</span>
              </label>
              <Textarea
                placeholder="请填写作废原因..."
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleVoidTesting} disabled={!voidReason.trim()}>
              确认作废
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
