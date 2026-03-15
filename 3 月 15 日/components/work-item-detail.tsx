"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { CheckCircle2, Clock, Crown, Plus, ExternalLink, AlertCircle, Eye } from "lucide-react"
import { cn } from "@/lib/utils"

interface WorkItemDetailProps {
  selectedItemId: string
}

type ExecutionRole = "primary" | "secondary" | "rework" | "experimental"
type ExecutionSource = "normal" | "supplement"
type ExecutionStatus = "pending" | "in-progress" | "completed" | "rejected"

interface ExecutionInstance {
  id: string
  type: string // 打样 / 样衣 / 制版 / 测款等
  role: ExecutionRole
  source: ExecutionSource
  status: ExecutionStatus
  affectsFlow: boolean
  keyResults: Record<string, any>
  assignee: string
  startTime?: string
  completeTime?: string
}

const workItemDetails: Record<
  string,
  {
    name: string
    phase: string
    description: string
    isKeyNode: boolean
    completionRule: string
    status: string
    instances: ExecutionInstance[]
  }
> = {
  "item-1": {
    name: "基础信息填写",
    phase: "打样准备阶段",
    description: "填写商品的基础信息，包括名称、分类、风格、目标价格等",
    isKeyNode: true,
    completionRule: "主执行实例完成信息填写并通过审核",
    status: "completed",
    instances: [
      {
        id: "EXE-001",
        type: "信息录入",
        role: "primary",
        source: "normal",
        status: "completed",
        affectsFlow: true,
        keyResults: {
          商品名称: "优雅碎花连衣裙",
          分类: "裙装 / 连衣裙",
          目标价格: "¥89",
        },
        assignee: "张丽",
        startTime: "2024-12-08 09:00",
        completeTime: "2024-12-08 11:30",
      },
    ],
  },
  "item-2": {
    name: "初步可行性判断",
    phase: "打样准备阶段",
    description: "评估商品的可行性，决定是否进入打样阶段",
    isKeyNode: true,
    completionRule: "主执行实例完成决策并记录理由",
    status: "completed",
    instances: [
      {
        id: "EXE-002",
        type: "可行性评估",
        role: "primary",
        source: "normal",
        status: "completed",
        affectsFlow: true,
        keyResults: {
          决策结果: "通过",
          理由: "样品质量良好，颜色符合预期，版型适合东南亚市场",
        },
        assignee: "张丽",
        startTime: "2024-12-08 14:00",
        completeTime: "2024-12-08 16:00",
      },
    ],
  },
  "item-3": {
    name: "外采样品采购",
    phase: "打样准备阶段",
    description: "从外部平台采购样品用于评估",
    isKeyNode: true,
    completionRule: "主执行实例样品到货并登记",
    status: "completed",
    instances: [
      {
        id: "EXE-003",
        type: "采购",
        role: "primary",
        source: "normal",
        status: "completed",
        affectsFlow: true,
        keyResults: {
          采购平台: "1688",
          订单号: "TB20241210001",
          数量: "3件",
          到货状态: "已到货",
        },
        assignee: "王明",
        startTime: "2024-12-10 09:00",
        completeTime: "2024-12-12 16:30",
      },
      {
        id: "EXE-004",
        type: "采购",
        role: "secondary",
        source: "supplement",
        status: "completed",
        affectsFlow: false,
        keyResults: {
          采购平台: "淘宝",
          订单号: "TB20241211002",
          数量: "2件",
          到货状态: "已到货",
          备注: "补充采购不同颜色样品",
        },
        assignee: "王明",
        startTime: "2024-12-11 10:00",
        completeTime: "2024-12-13 14:00",
      },
    ],
  },
  "item-4": {
    name: "样品拍摄试穿",
    phase: "样衣与测款阶段",
    description: "对样品进行拍摄和试穿评估",
    isKeyNode: false,
    completionRule: "主样衣完成拍摄并上传素材",
    status: "completed",
    instances: [
      {
        id: "EXE-005",
        type: "样衣",
        role: "primary",
        source: "normal",
        status: "completed",
        affectsFlow: true,
        keyResults: {
          样衣编号: "SPL-2024-0089",
          用途: "主样",
          所在地: "深圳仓库",
          拍摄照片: "25张",
          试穿效果: "合身",
        },
        assignee: "李娜",
        startTime: "2024-12-12 10:00",
        completeTime: "2024-12-13 18:00",
      },
      {
        id: "EXE-006",
        type: "样衣",
        role: "secondary",
        source: "normal",
        status: "completed",
        affectsFlow: false,
        keyResults: {
          样衣编号: "SPL-2024-0090",
          用途: "主播样",
          所在地: "主播工作室",
        },
        assignee: "李娜",
        startTime: "2024-12-13 09:00",
        completeTime: "2024-12-13 12:00",
      },
      {
        id: "EXE-007",
        type: "样衣",
        role: "secondary",
        source: "supplement",
        status: "completed",
        affectsFlow: false,
        keyResults: {
          样衣编号: "SPL-2024-0091",
          用途: "补样",
          所在地: "印尼仓库",
          备注: "工作项完成后补充",
        },
        assignee: "李娜",
        startTime: "2024-12-14 09:00",
        completeTime: "2024-12-14 11:00",
      },
    ],
  },
  "item-5": {
    name: "商品上架",
    phase: "样衣与测款阶段",
    description: "将商品上架到各销售渠道",
    isKeyNode: false,
    completionRule: "主渠道上架成功并获得商品链接",
    status: "completed",
    instances: [
      {
        id: "EXE-008",
        type: "上架",
        role: "primary",
        source: "normal",
        status: "completed",
        affectsFlow: true,
        keyResults: {
          渠道: "TikTok Shop",
          商品ID: "TK20241214001",
          上架价格: "¥89",
          链接: "https://tiktok.com/product/abc123",
        },
        assignee: "赵云",
        startTime: "2024-12-14 09:00",
        completeTime: "2024-12-14 11:00",
      },
      {
        id: "EXE-009",
        type: "上架",
        role: "secondary",
        source: "normal",
        status: "completed",
        affectsFlow: false,
        keyResults: {
          渠道: "Shopee ID",
          商品ID: "SP20241214001",
          上架价格: "IDR 150,000",
          链接: "https://shopee.co.id/product/xyz789",
        },
        assignee: "赵云",
        startTime: "2024-12-14 14:00",
        completeTime: "2024-12-14 17:00",
      },
    ],
  },
  "item-6": {
    name: "直播测款",
    phase: "样衣与测款阶段",
    description: "通过直播方式测试商品市场反应",
    isKeyNode: true,
    completionRule: "主测款场次完成并达到数据指标",
    status: "in-progress",
    instances: [
      {
        id: "EXE-010",
        type: "测款",
        role: "primary",
        source: "normal",
        status: "completed",
        affectsFlow: true,
        keyResults: {
          渠道: "TikTok Shop",
          场次: "12月14日 19:00-21:00",
          曝光量: "3,500",
          成交量: "156",
          转化率: "4.5%",
          退货率: "8%",
        },
        assignee: "主播A",
        startTime: "2024-12-14 19:00",
        completeTime: "2024-12-14 21:00",
      },
      {
        id: "EXE-011",
        type: "测款",
        role: "secondary",
        source: "normal",
        status: "in-progress",
        affectsFlow: false,
        keyResults: {
          渠道: "TikTok Shop",
          场次: "12月15日 20:00-22:00",
          曝光量: "2,100",
          成交量: "89",
          转化率: "4.2%",
          状态: "进行中",
        },
        assignee: "主播B",
        startTime: "2024-12-15 20:00",
      },
      {
        id: "EXE-012",
        type: "测款",
        role: "experimental",
        source: "normal",
        status: "completed",
        affectsFlow: false,
        keyResults: {
          渠道: "Shopee ID",
          场次: "12月15日 18:00-20:00",
          曝光量: "1,200",
          成交量: "45",
          转化率: "3.8%",
          备注: "试验印尼市场反应",
        },
        assignee: "印尼主播",
        startTime: "2024-12-15 18:00",
        completeTime: "2024-12-15 20:00",
      },
    ],
  },
  "item-7": {
    name: "测款结果判断",
    phase: "样衣与测款阶段",
    description: "基于测款数据判断是否进入工程阶段",
    isKeyNode: true,
    completionRule: "完成数据分析并做出决策",
    status: "pending",
    instances: [],
  },
  "item-8": {
    name: "首单样衣打样",
    phase: "工程确认阶段",
    description: "进行首单样衣的正式打样",
    isKeyNode: true,
    completionRule: "主打样完成并通过质检",
    status: "pending",
    instances: [],
  },
  "item-9": {
    name: "样衣质检",
    phase: "工程确认阶段",
    description: "对样衣进行质量检验",
    isKeyNode: false,
    completionRule: "主样衣通过质检标准",
    status: "pending",
    instances: [],
  },
}

const roleConfig: Record<ExecutionRole, { label: string; color: string; icon?: any }> = {
  primary: { label: "主执行", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30", icon: Crown },
  secondary: { label: "补充", color: "bg-gray-500/10 text-gray-600 border-gray-500/30" },
  rework: { label: "返工", color: "bg-red-500/10 text-red-600 border-red-500/30" },
  experimental: { label: "试验", color: "bg-purple-500/10 text-purple-600 border-purple-500/30" },
}

const sourceConfig: Record<ExecutionSource, { label: string; color: string }> = {
  normal: { label: "正常流程", color: "text-muted-foreground" },
  supplement: { label: "完成后补充", color: "text-orange-500" },
}

const statusConfig: Record<ExecutionStatus, { label: string; color: string; icon: any }> = {
  pending: { label: "未开始", color: "bg-gray-500/10 text-gray-600", icon: Clock },
  "in-progress": { label: "进行中", color: "bg-blue-500/10 text-blue-600", icon: Clock },
  completed: { label: "已完成", color: "bg-green-500/10 text-green-600", icon: CheckCircle2 },
  rejected: { label: "已驳回", color: "bg-red-500/10 text-red-600", icon: AlertCircle },
}

export function WorkItemDetail({ selectedItemId }: WorkItemDetailProps) {
  const detail = workItemDetails[selectedItemId]

  if (!detail) {
    return (
      <Card className="border-border bg-card h-full flex items-center justify-center">
        <p className="text-muted-foreground">请选择一个工作项查看详情</p>
      </Card>
    )
  }

  const isInProgress = detail.status === "in-progress"
  const isCompleted = detail.status === "completed"
  const hasPrimaryCompleted = detail.instances.some((i) => i.role === "primary" && i.status === "completed")

  return (
    <Card className="border-border bg-card h-full flex flex-col">
      {/* 4.1 工作项基础信息区 */}
      <div className="p-6 border-b border-border flex-shrink-0">
        <div className="flex items-start justify-between mb-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-foreground">{detail.name}</h2>
              <Badge
                className={cn(
                  detail.status === "completed" && "bg-green-500/10 text-green-600",
                  detail.status === "in-progress" && "bg-blue-500/10 text-blue-600",
                  detail.status === "pending" && "bg-gray-500/10 text-gray-600",
                )}
              >
                {detail.status === "completed" ? "已完成" : detail.status === "in-progress" ? "进行中" : "未开始"}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">{detail.phase}</div>
          </div>

          {/* 工作项操作按钮 */}
          <div className="flex gap-2">
            {(isInProgress || isCompleted) && (
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                新增执行实例
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">工作项说明</Label>
            <p className="text-sm text-foreground mt-1">{detail.description}</p>
          </div>

          <div className="flex gap-6">
            <div>
              <Label className="text-xs text-muted-foreground">是否关键节点</Label>
              <div className="mt-1">
                {detail.isKeyNode ? (
                  <Badge className="bg-orange-500/10 text-orange-600">是</Badge>
                ) : (
                  <Badge variant="secondary">否</Badge>
                )}
              </div>
            </div>
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">完成判定规则</Label>
              <p className="text-sm text-muted-foreground mt-1">{detail.completionRule}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 4.2 执行实例列表 */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-foreground">执行实例列表</h3>
          <span className="text-sm text-muted-foreground">
            共 {detail.instances.length} 个实例
            {detail.instances.filter((i) => i.status !== "completed").length > 0 && (
              <span className="text-orange-500 ml-2">
                ({detail.instances.filter((i) => i.status !== "completed").length} 个未完成)
              </span>
            )}
          </span>
        </div>

        {detail.instances.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Clock className="h-12 w-12 text-muted-foreground mb-4" />
            <h4 className="text-lg font-medium text-foreground mb-2">暂无执行实例</h4>
            <p className="text-sm text-muted-foreground">此工作项需要等待前置工作项完成后才能开始</p>
          </div>
        ) : (
          <div className="space-y-4">
            {detail.instances.map((instance) => {
              const RoleIcon = roleConfig[instance.role].icon
              const StatusIcon = statusConfig[instance.status].icon

              return (
                <Card
                  key={instance.id}
                  className={cn("p-4 border", instance.role === "primary" && "border-yellow-500/30 bg-yellow-500/5")}
                >
                  {/* 实例头部 */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium text-foreground">{instance.id}</span>
                      <Badge className={roleConfig[instance.role].color}>
                        {RoleIcon && <RoleIcon className="h-3 w-3 mr-1" />}
                        {roleConfig[instance.role].label}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {instance.type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={statusConfig[instance.status].color}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusConfig[instance.status].label}
                      </Badge>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* 实例信息 */}
                  <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                    <div>
                      <span className="text-muted-foreground">执行来源:</span>
                      <span className={cn("ml-2", sourceConfig[instance.source].color)}>
                        {sourceConfig[instance.source].label}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">负责人:</span>
                      <span className="ml-2 text-foreground">{instance.assignee}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">影响流程:</span>
                      <span className={cn("ml-2", instance.affectsFlow ? "text-orange-500" : "text-muted-foreground")}>
                        {instance.affectsFlow ? "是" : "否"}
                      </span>
                    </div>
                    {instance.startTime && (
                      <div>
                        <span className="text-muted-foreground">开始时间:</span>
                        <span className="ml-2 text-foreground">{instance.startTime}</span>
                      </div>
                    )}
                  </div>

                  {/* 关键结果字段 */}
                  <div className="border-t border-border pt-3">
                    <Label className="text-xs text-muted-foreground mb-2 block">关键结果</Label>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {Object.entries(instance.keyResults).map(([key, value]) => (
                        <div key={key} className="flex items-start gap-2">
                          <span className="text-muted-foreground shrink-0">{key}:</span>
                          {typeof value === "string" && value.startsWith("http") ? (
                            <a
                              href={value}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline flex items-center gap-1 truncate"
                            >
                              <ExternalLink className="h-3 w-3 shrink-0" />
                              <span className="truncate">{value}</span>
                            </a>
                          ) : (
                            <span className="text-foreground">{String(value)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* 底部操作区 */}
      {isInProgress && hasPrimaryCompleted && (
        <div className="p-4 border-t border-border flex-shrink-0">
          <Button className="w-full" size="lg">
            <CheckCircle2 className="h-4 w-4 mr-2" />
            确认完成当前工作项
          </Button>
        </div>
      )}
    </Card>
  )
}
