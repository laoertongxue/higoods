'use client'

import { useState, useMemo } from 'react'
import { Settings2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { useFcs } from '@/lib/fcs/fcs-store'

// ─── helpers ──────────────────────────────────────────────────────────────────

function getTaskDeps(task: Record<string, any>): string[] {
  return (
    task.dependsOnTaskIds ??
    task.dependencyTaskIds ??
    task.predecessorTaskIds ??
    []
  )
}

function shortId(taskId: string): string {
  return taskId.split('-').slice(-1)[0]
}

// ─── Edit-deps dialog ─────────────────────────────────────────────────────────

interface TaskItem {
  taskId: string
  processNameZh: string
  productionOrderId?: string
}

interface EditDepsDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  task: TaskItem | null
  allTasks: TaskItem[]
  currentDeps: string[]
  onSave: (deps: string[]) => void
}

function EditDepsDialog({
  open,
  onOpenChange,
  task,
  allTasks,
  currentDeps,
  onSave,
}: EditDepsDialogProps) {
  const [selected, setSelected] = useState<string[]>(currentDeps)
  const [search, setSearch] = useState('')

  const handleOpenChange = (v: boolean) => {
    if (v) {
      setSelected(currentDeps)
      setSearch('')
    }
    onOpenChange(v)
  }

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allTasks
      .filter(t => t.taskId !== task?.taskId)
      .filter(
        t =>
          !q ||
          t.processNameZh.toLowerCase().includes(q) ||
          t.taskId.toLowerCase().includes(q),
      )
  }, [allTasks, task, search])

  const toggle = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>编辑上游依赖</DialogTitle>
        </DialogHeader>

        {task && (
          <p className="text-sm text-muted-foreground -mt-1">
            当前任务：
            <span className="font-medium text-foreground">{task.processNameZh}</span>
            <span className="ml-1 text-xs">（编号尾段：{shortId(task.taskId)}）</span>
          </p>
        )}

        <Input
          placeholder="搜索任务名称或编号"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <div className="max-h-60 overflow-y-auto divide-y divide-border rounded-md border">
          {candidates.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">无可选任务</p>
          ) : (
            candidates.map(t => (
              <label
                key={t.taskId}
                className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50 text-sm select-none"
              >
                <Checkbox
                  checked={selected.includes(t.taskId)}
                  onCheckedChange={() => toggle(t.taskId)}
                />
                <span className="flex-1">{t.processNameZh}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  …{shortId(t.taskId)}
                </span>
              </label>
            ))
          )}
        </div>

        {selected.length > 0 && (
          <p className="text-xs text-muted-foreground">已选 {selected.length} 项上游依赖</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={() => {
              onSave(selected)
              handleOpenChange(false)
            }}
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DependenciesPage() {
  const { state, updateTaskDependencies } = useFcs()
  const { processTasks } = state

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)

  const editingTask = editingTaskId
    ? (processTasks.find(t => t.taskId === editingTaskId) ?? null)
    : null

  const currentDeps: string[] = editingTask
    ? getTaskDeps(editingTask as any)
    : []

  const openEdit = (taskId: string) => {
    setEditingTaskId(taskId)
    setDialogOpen(true)
  }

  const handleSave = (deps: string[]) => {
    if (!editingTaskId) return
    updateTaskDependencies(editingTaskId, deps, '管理员')
  }

  const handleClear = (taskId: string) => {
    updateTaskDependencies(taskId, [], '管理员')
  }

  return (
    <div className="space-y-4">
      {/* 页头 */}
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Settings2 className="h-5 w-5" />
          依赖关系配置
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          配置任务的上游依赖，用于 Allocation 门禁自动阻塞/放行
        </p>
      </div>

      {/* 主表格 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">任务列表</CardTitle>
          <CardDescription>共 {processTasks.length} 个任务</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>任务</TableHead>
                  <TableHead>上游依赖（多选）</TableHead>
                  <TableHead>当前门禁状态</TableHead>
                  <TableHead className="w-[180px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processTasks.map(task => {
                  const deps = getTaskDeps(task as any)
                  const isGated =
                    task.status === 'BLOCKED' &&
                    (task as any).blockReason === 'ALLOCATION_GATE'
                  const depNames = deps.map(id => {
                    const dep = processTasks.find(t => t.taskId === id)
                    return dep ? dep.processNameZh : `…${shortId(id)}`
                  })

                  return (
                    <TableRow key={task.taskId}>
                      {/* 任务 */}
                      <TableCell>
                        <div className="font-medium text-sm">{task.processNameZh}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          …{shortId(task.taskId)}
                        </div>
                      </TableCell>

                      {/* 上游依赖 */}
                      <TableCell>
                        {deps.length === 0 ? (
                          <span className="text-muted-foreground text-sm">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {depNames.map((name, i) => (
                              <Badge
                                key={deps[i]}
                                variant="secondary"
                                className="text-xs font-normal"
                              >
                                {name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>

                      {/* 门禁状态 */}
                      <TableCell>
                        {isGated ? (
                          <div className="space-y-1">
                            <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-xs">
                              门禁阻塞
                            </Badge>
                            {(task as any).blockNoteZh && (
                              <p className="text-xs text-muted-foreground leading-snug">
                                {(task as any).blockNoteZh}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">未阻塞</span>
                        )}
                      </TableCell>

                      {/* 操作 */}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEdit(task.taskId)}
                          >
                            编辑依赖
                          </Button>
                          {deps.length > 0 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleClear(task.taskId)}
                            >
                              清空依赖
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 编辑依赖 Dialog */}
      <EditDepsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editingTask as any}
        allTasks={processTasks as any[]}
        currentDeps={currentDeps}
        onSave={handleSave}
      />
    </div>
  )
}
