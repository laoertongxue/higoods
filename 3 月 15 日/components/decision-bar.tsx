"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { CheckCircle2, AlertCircle, ChevronRight, Crown, AlertTriangle, Lock } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function DecisionBar() {
  const [showDecisionDialog, setShowDecisionDialog] = useState(false)
  const [showBlockDialog, setShowBlockDialog] = useState(false)
  const [decisionType, setDecisionType] = useState<"complete" | "proceed" | "reject">("complete")
  const [decisionReason, setDecisionReason] = useState("")
  const [blockReason, setBlockReason] = useState("")

  const currentWorkItem = {
    name: "直播测款",
    hasPrimaryCompleted: true,
    incompleteInstances: 1,
    riskLevel: "low" as const,
  }

  const handleDecision = (type: "complete" | "proceed" | "reject") => {
    setDecisionType(type)
    setShowDecisionDialog(true)
  }

  const confirmDecision = () => {
    alert(`决策已提交: ${decisionType}\n理由: ${decisionReason}`)
    setShowDecisionDialog(false)
    setDecisionReason("")
  }

  const confirmBlock = () => {
    alert(`工作项已阻塞\n原因: ${blockReason}`)
    setShowBlockDialog(false)
    setBlockReason("")
  }

  return (
    <>
      <div className="bg-card border-t border-border">
        <div className="p-6">
          <div className="flex items-start justify-between gap-6">
            {/* 左侧：工作项完成判定信息 */}
            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-blue-500 flex-shrink-0" />
                <h3 className="text-lg font-semibold text-foreground">当前工作项: {currentWorkItem.name}</h3>
                <Badge variant="outline" className="text-blue-500 border-blue-500">
                  进行中
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">完成判定:</span>
                  {currentWorkItem.hasPrimaryCompleted ? (
                    <Badge className="bg-green-500/10 text-green-600">
                      <Crown className="h-3 w-3 mr-1" />
                      存在已完成的主执行实例
                    </Badge>
                  ) : (
                    <Badge className="bg-red-500/10 text-red-600">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      无已完成的主执行实例
                    </Badge>
                  )}
                </div>

                {currentWorkItem.incompleteInstances > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">未完成实例:</span>
                    <Badge variant="secondary" className="text-orange-500">
                      {currentWorkItem.incompleteInstances} 个执行实例仍在进行中
                    </Badge>
                    <span className="text-xs text-muted-foreground">(不阻塞完成)</span>
                  </div>
                )}

                {currentWorkItem.riskLevel !== "low" && (
                  <div className="flex items-center gap-2 text-sm">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    <span className="text-orange-500">风险提示: 主执行实例数量为 0</span>
                  </div>
                )}
              </div>
            </div>

            {/* 右侧：操作按钮 */}
            <div className="flex gap-3 flex-shrink-0 flex-wrap justify-end">
              <Button
                variant="outline"
                onClick={() => setShowBlockDialog(true)}
                className="text-orange-500 border-orange-500 hover:bg-orange-500/10 bg-transparent"
              >
                <Lock className="h-4 w-4 mr-2" />
                阻塞工作项
              </Button>

              <Button
                variant="outline"
                onClick={() => handleDecision("complete")}
                disabled={!currentWorkItem.hasPrimaryCompleted}
                className="text-green-600 border-green-600 hover:bg-green-600/10 bg-transparent disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                确认完成工作项
              </Button>

              <Button
                onClick={() => handleDecision("proceed")}
                disabled={!currentWorkItem.hasPrimaryCompleted}
                className="bg-primary hover:bg-primary/90 disabled:opacity-50"
              >
                进入下一工作项
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 决策确认对话框 */}
      <Dialog open={showDecisionDialog} onOpenChange={setShowDecisionDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {decisionType === "complete" && "确认完成当前工作项"}
              {decisionType === "proceed" && "进入下一工作项"}
              {decisionType === "reject" && "终止项目"}
            </DialogTitle>
            <DialogDescription>
              {decisionType === "complete" && "当前工作项将被标记为已完成，此操作将记录到项目日志"}
              {decisionType === "proceed" && "将进入下一工作项，当前工作项自动标记为已完成"}
              {decisionType === "reject" && "项目将被标记为终止状态，此决策将记录到项目日志"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason" className="text-foreground">
                操作说明 <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="reason"
                value={decisionReason}
                onChange={(e) => setDecisionReason(e.target.value)}
                placeholder="请填写操作说明..."
                className="min-h-[120px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDecisionDialog(false)}>
              取消
            </Button>
            <Button
              onClick={confirmDecision}
              disabled={!decisionReason.trim()}
              variant={decisionType === "reject" ? "destructive" : "default"}
            >
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 阻塞确认对话框 */}
      <Dialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>阻塞当前工作项</DialogTitle>
            <DialogDescription>阻塞后，当前工作项将暂停执行，需要填写阻塞原因</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="blockReason" className="text-foreground">
                阻塞原因 <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="blockReason"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="请填写阻塞原因..."
                className="min-h-[120px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBlockDialog(false)}>
              取消
            </Button>
            <Button
              onClick={confirmBlock}
              disabled={!blockReason.trim()}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              确认阻塞
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
