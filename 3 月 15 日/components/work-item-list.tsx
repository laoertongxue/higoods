"use client"

import type React from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Circle, Clock, AlertTriangle, Crown } from "lucide-react"
import { cn } from "@/lib/utils"

type WorkItemStatus = "completed" | "in-progress" | "pending" | "blocked"
type WorkItemType = "execution" | "decision"

interface WorkItem {
  id: string
  name: string
  type: WorkItemType
  status: WorkItemStatus
  assignee?: string
  isKey?: boolean
  // 新增：执行实例统计
  instanceCount: number
  incompleteCount: number
  hasPrimaryInstance: boolean
  canProceed: boolean // 是否允许进入下一工作项
}

interface Phase {
  id: string
  name: string
  items: WorkItem[]
}

const phases: Phase[] = [
  {
    id: "phase-1",
    name: "打样准备阶段",
    items: [
      {
        id: "item-1",
        name: "基础信息填写",
        type: "execution",
        status: "completed",
        assignee: "张丽",
        isKey: true,
        instanceCount: 1,
        incompleteCount: 0,
        hasPrimaryInstance: true,
        canProceed: true,
      },
      {
        id: "item-2",
        name: "初步可行性判断",
        type: "decision",
        status: "completed",
        assignee: "张丽",
        isKey: true,
        instanceCount: 1,
        incompleteCount: 0,
        hasPrimaryInstance: true,
        canProceed: true,
      },
      {
        id: "item-3",
        name: "外采样品采购",
        type: "execution",
        status: "completed",
        assignee: "王明",
        isKey: true,
        instanceCount: 2,
        incompleteCount: 0,
        hasPrimaryInstance: true,
        canProceed: true,
      },
    ],
  },
  {
    id: "phase-2",
    name: "样衣与测款阶段",
    items: [
      {
        id: "item-4",
        name: "样品拍摄试穿",
        type: "execution",
        status: "completed",
        assignee: "李娜",
        instanceCount: 3,
        incompleteCount: 0,
        hasPrimaryInstance: true,
        canProceed: true,
      },
      {
        id: "item-5",
        name: "商品上架",
        type: "execution",
        status: "completed",
        assignee: "赵云",
        instanceCount: 2,
        incompleteCount: 0,
        hasPrimaryInstance: true,
        canProceed: true,
      },
      {
        id: "item-6",
        name: "直播测款",
        type: "execution",
        status: "in-progress",
        assignee: "主播团队",
        isKey: true,
        instanceCount: 3,
        incompleteCount: 1,
        hasPrimaryInstance: true,
        canProceed: false,
      },
      {
        id: "item-7",
        name: "测款结果判断",
        type: "decision",
        status: "pending",
        assignee: "张丽",
        isKey: true,
        instanceCount: 0,
        incompleteCount: 0,
        hasPrimaryInstance: false,
        canProceed: false,
      },
    ],
  },
  {
    id: "phase-3",
    name: "工程确认阶段",
    items: [
      {
        id: "item-8",
        name: "首单样衣打样",
        type: "execution",
        status: "pending",
        assignee: "印尼团队",
        isKey: true,
        instanceCount: 0,
        incompleteCount: 0,
        hasPrimaryInstance: false,
        canProceed: false,
      },
      {
        id: "item-9",
        name: "样衣质检",
        type: "execution",
        status: "pending",
        assignee: "质检部",
        instanceCount: 0,
        incompleteCount: 0,
        hasPrimaryInstance: false,
        canProceed: false,
      },
    ],
  },
]

const statusConfig: Record<WorkItemStatus, { icon: React.ElementType; color: string; label: string }> = {
  completed: { icon: CheckCircle2, color: "text-green-500", label: "已完成" },
  "in-progress": { icon: Clock, color: "text-blue-500", label: "进行中" },
  pending: { icon: Circle, color: "text-muted-foreground", label: "未开始" },
  blocked: { icon: AlertTriangle, color: "text-orange-500", label: "已阻塞" },
}

const typeConfig: Record<WorkItemType, { label: string; color: string }> = {
  execution: { label: "执行", color: "text-blue-500 border-blue-500/50" },
  decision: { label: "决策", color: "text-orange-500 border-orange-500/50" },
}

interface WorkItemListProps {
  selectedItem: string
  onSelectItem: (id: string) => void
}

export function WorkItemList({ selectedItem, onSelectItem }: WorkItemListProps) {
  return (
    <Card className="border-border bg-card h-full flex flex-col">
      <div className="p-4 border-b border-border flex-shrink-0">
        <h2 className="text-lg font-semibold text-foreground">工作项清单</h2>
        <p className="text-xs text-muted-foreground mt-1">按阶段分组 · 点击查看详情</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {phases.map((phase) => (
          <div key={phase.id} className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">{phase.name}</h3>

            <div className="space-y-2">
              {phase.items.map((item) => {
                const StatusIcon = statusConfig[item.status].icon
                const isSelected = selectedItem === item.id
                const isClickable = item.status === "in-progress" || item.status === "completed"

                return (
                  <button
                    key={item.id}
                    onClick={() => isClickable && onSelectItem(item.id)}
                    disabled={!isClickable}
                    className={cn(
                      "w-full text-left p-3 rounded-lg transition-all",
                      "border border-transparent",
                      isSelected && "bg-accent border-primary",
                      !isSelected && isClickable && "hover:bg-accent/50",
                      !isClickable && "opacity-50 cursor-not-allowed",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <StatusIcon className={cn("h-5 w-5 mt-0.5 flex-shrink-0", statusConfig[item.status].color)} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm font-medium text-foreground">{item.name}</span>
                          {item.isKey && (
                            <Badge
                              variant="outline"
                              className="text-xs px-1.5 py-0 text-orange-500 border-orange-500/50"
                            >
                              关键
                            </Badge>
                          )}
                          {item.hasPrimaryInstance && item.status !== "pending" && (
                            <Crown className="h-3.5 w-3.5 text-yellow-500" title="存在主执行实例" />
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                          <Badge variant="outline" className={`text-xs ${typeConfig[item.type].color}`}>
                            {typeConfig[item.type].label}
                          </Badge>
                          {item.assignee && <span>{item.assignee}</span>}

                          {item.instanceCount > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {item.incompleteCount > 0
                                ? `${item.instanceCount - item.incompleteCount}/${item.instanceCount} 完成`
                                : `${item.instanceCount} 实例`}
                            </Badge>
                          )}
                        </div>

                        {item.status === "in-progress" && !item.canProceed && (
                          <div className="mt-1 text-xs text-orange-500">需完成主执行实例后方可进入下一工作项</div>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
