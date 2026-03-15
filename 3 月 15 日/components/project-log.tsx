"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Plus,
  Crown,
  ArrowRight,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

interface LogEntry {
  id: string
  timestamp: string
  type:
    | "work_item"
    | "decision"
    | "status_change"
    | "note"
    | "primary_confirm"
    | "primary_invalid"
    | "instance_add"
    | "stage_change"
  action: string
  actor: string
  relatedObject?: {
    type: "work_item" | "instance"
    id: string
    name: string
  }
  details?: string
}

const mockLogs: LogEntry[] = [
  {
    id: "log-1",
    timestamp: "2024-12-08 11:30",
    type: "work_item",
    action: "完成工作项",
    actor: "张丽",
    relatedObject: { type: "work_item", id: "item-1", name: "基础信息填写" },
    details: "完成商品基础信息录入",
  },
  {
    id: "log-2",
    timestamp: "2024-12-08 16:00",
    type: "decision",
    action: "决策通过",
    actor: "张丽",
    relatedObject: { type: "work_item", id: "item-2", name: "初步可行性判断" },
    details: "样品质量良好，建议进入打样阶段",
  },
  {
    id: "log-3",
    timestamp: "2024-12-10 09:00",
    type: "primary_confirm",
    action: "确认主执行实例",
    actor: "王明",
    relatedObject: { type: "instance", id: "EXE-003", name: "外采样品采购" },
    details: "确认1688采购为主执行实例",
  },
  {
    id: "log-4",
    timestamp: "2024-12-11 10:00",
    type: "instance_add",
    action: "新增执行实例（补充）",
    actor: "王明",
    relatedObject: { type: "instance", id: "EXE-004", name: "外采样品采购" },
    details: "补充采购淘宝样品，不影响流程",
  },
  {
    id: "log-5",
    timestamp: "2024-12-12 16:30",
    type: "work_item",
    action: "完成工作项",
    actor: "王明",
    relatedObject: { type: "work_item", id: "item-3", name: "外采样品采购" },
    details: "主执行实例已到货",
  },
  {
    id: "log-6",
    timestamp: "2024-12-13 18:00",
    type: "primary_confirm",
    action: "确认主执行实例",
    actor: "李娜",
    relatedObject: { type: "instance", id: "EXE-005", name: "样品拍摄试穿" },
    details: "SPL-2024-0089 确认为主样",
  },
  {
    id: "log-7",
    timestamp: "2024-12-14 11:00",
    type: "instance_add",
    action: "新增执行实例（完成后补充）",
    actor: "李娜",
    relatedObject: { type: "instance", id: "EXE-007", name: "样品拍摄试穿" },
    details: "工作项完成后补充印尼仓库样衣",
  },
  {
    id: "log-8",
    timestamp: "2024-12-14 17:00",
    type: "work_item",
    action: "完成工作项",
    actor: "赵云",
    relatedObject: { type: "work_item", id: "item-5", name: "商品上架" },
    details: "TikTok Shop 和 Shopee ID 上架完成",
  },
  {
    id: "log-9",
    timestamp: "2024-12-14 19:00",
    type: "stage_change",
    action: "进入测款阶段",
    actor: "系统",
    details: "打样准备阶段完成，自动进入样衣与测款阶段",
  },
  {
    id: "log-10",
    timestamp: "2024-12-14 21:00",
    type: "status_change",
    action: "测款数据更新",
    actor: "系统",
    relatedObject: { type: "instance", id: "EXE-010", name: "直播测款" },
    details: "场次1完成，销量156件，转化率4.5%",
  },
  {
    id: "log-11",
    timestamp: "2024-12-15 20:00",
    type: "instance_add",
    action: "新增执行实例",
    actor: "主播B",
    relatedObject: { type: "instance", id: "EXE-011", name: "直播测款" },
    details: "开始第二场测款直播",
  },
]

const getLogIcon = (type: LogEntry["type"]) => {
  switch (type) {
    case "work_item":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />
    case "decision":
      return <AlertCircle className="h-4 w-4 text-primary" />
    case "status_change":
      return <Clock className="h-4 w-4 text-orange-500" />
    case "note":
      return <FileText className="h-4 w-4 text-muted-foreground" />
    case "primary_confirm":
      return <Crown className="h-4 w-4 text-yellow-500" />
    case "primary_invalid":
      return <RotateCcw className="h-4 w-4 text-red-500" />
    case "instance_add":
      return <Plus className="h-4 w-4 text-blue-500" />
    case "stage_change":
      return <ArrowRight className="h-4 w-4 text-purple-500" />
  }
}

const getLogBadge = (type: LogEntry["type"]) => {
  switch (type) {
    case "work_item":
      return (
        <Badge variant="outline" className="text-green-500 border-green-500/50">
          工作项
        </Badge>
      )
    case "decision":
      return (
        <Badge variant="outline" className="text-primary border-primary/50">
          决策
        </Badge>
      )
    case "status_change":
      return (
        <Badge variant="outline" className="text-orange-500 border-orange-500/50">
          状态变更
        </Badge>
      )
    case "note":
      return (
        <Badge variant="outline" className="text-muted-foreground border-muted-foreground/50">
          备注
        </Badge>
      )
    case "primary_confirm":
      return (
        <Badge variant="outline" className="text-yellow-500 border-yellow-500/50">
          主实例确认
        </Badge>
      )
    case "primary_invalid":
      return (
        <Badge variant="outline" className="text-red-500 border-red-500/50">
          主实例失效
        </Badge>
      )
    case "instance_add":
      return (
        <Badge variant="outline" className="text-blue-500 border-blue-500/50">
          新增实例
        </Badge>
      )
    case "stage_change":
      return (
        <Badge variant="outline" className="text-purple-500 border-purple-500/50">
          阶段变更
        </Badge>
      )
  }
}

export function ProjectLog() {
  const [logs, setLogs] = useState<LogEntry[]>(mockLogs)
  const [newNote, setNewNote] = useState("")
  const [showAddNote, setShowAddNote] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 5
  const totalPages = Math.ceil(logs.length / pageSize)
  const paginatedLogs = logs.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const handleAddNote = () => {
    if (!newNote.trim()) return

    const newLog: LogEntry = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
      type: "note",
      action: "添加备注",
      actor: "当前用户",
      details: newNote,
    }

    setLogs([newLog, ...logs])
    setNewNote("")
    setShowAddNote(false)
    setCurrentPage(1)
  }

  return (
    <Card className="bg-card border-border h-full flex flex-col">
      <div className="p-4 border-b border-border flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">项目日志</h2>
          <Badge variant="secondary" className="text-xs">
            {logs.length}
          </Badge>
        </div>
        <Dialog open={showAddNote} onOpenChange={setShowAddNote}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 bg-transparent">
              <Plus className="h-4 w-4" />
              添加备注
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>添加项目备注</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="note">备注内容</Label>
                <Textarea
                  id="note"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="输入备注内容..."
                  className="min-h-[120px]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowAddNote(false)}>
                取消
              </Button>
              <Button onClick={handleAddNote} disabled={!newNote.trim()}>
                添加
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {paginatedLogs.map((log) => (
            <div key={log.id} className="flex gap-3 pb-4 border-b border-border last:border-0 last:pb-0">
              <div className="flex-shrink-0 mt-1">{getLogIcon(log.type)}</div>
              <div className="flex-1 space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {getLogBadge(log.type)}
                  <span className="text-xs text-muted-foreground">{log.timestamp}</span>
                </div>
                <div className="text-sm font-medium text-foreground">{log.action}</div>
                {log.relatedObject && (
                  <div className="text-xs text-muted-foreground">
                    关联: <span className="text-primary">{log.relatedObject.name}</span>
                    <span className="mx-1">·</span>
                    <span className="font-mono">{log.relatedObject.id}</span>
                  </div>
                )}
                <div className="text-xs text-muted-foreground">操作人: {log.actor}</div>
                {log.details && <div className="text-sm text-muted-foreground break-words">{log.details}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {totalPages > 1 && (
        <div className="p-3 border-t border-border flex items-center justify-between flex-shrink-0">
          <span className="text-xs text-muted-foreground">
            第 {currentPage}/{totalPages} 页
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
