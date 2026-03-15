"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MoreVertical, Pause, XCircle, FileText, Play } from "lucide-react"

interface ProjectHeaderProps {
  currentWorkItem?: string
}

export function ProjectHeader({ currentWorkItem = "直播测款" }: ProjectHeaderProps) {
  return (
    <Card className="m-6 mb-0 border-border bg-card">
      <div className="flex items-start justify-between p-6">
        <div className="space-y-4 flex-1">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-muted-foreground font-mono">
              PRJ-2024-0156
            </Badge>
            <h1 className="text-2xl font-semibold text-foreground">优雅碎花连衣裙</h1>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div className="space-y-1">
              <span className="text-muted-foreground text-xs">品类 / 波段 / 年季</span>
              <div className="flex gap-1 flex-wrap">
                <Badge variant="outline">裙装 / 连衣裙</Badge>
                <Badge variant="outline">春夏</Badge>
                <Badge variant="outline">2025</Badge>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-muted-foreground text-xs">当前项目阶段</span>
              <div>
                <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">测款阶段</Badge>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-muted-foreground text-xs">当前工作项</span>
              <div>
                <Badge className="bg-primary/10 text-primary border-primary/20">{currentWorkItem}</Badge>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-muted-foreground text-xs">项目状态</span>
              <div>
                <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                  <Play className="h-3 w-3 mr-1" />
                  进行中
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 text-sm border-t border-border pt-4">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">项目负责人:</span>
              <span className="text-foreground font-medium">张丽</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">最近更新:</span>
              <span className="text-foreground">2024-12-15 21:00</span>
            </div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <Pause className="h-4 w-4 mr-2" />
              暂停项目
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">
              <XCircle className="h-4 w-4 mr-2" />
              终止项目
            </DropdownMenuItem>
            <DropdownMenuItem>
              <FileText className="h-4 w-4 mr-2" />
              查看完整日志
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  )
}
