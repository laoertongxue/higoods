"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, AlertCircle, CheckCircle2, Save } from "lucide-react"
import Link from "next/link"
import { SystemNav } from "@/components/system-nav"
import { SidebarNav } from "@/components/sidebar-nav"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

const templatesByStyleType: Record<
  string,
  {
    stages: { name: string; items: { name: string; type: "Execution" | "Decision"; isKey?: boolean }[] }[]
  }
> = {
  基础款: {
    stages: [
      {
        name: "立项",
        items: [{ name: "款式方向确认", type: "Decision", isKey: true }],
      },
      {
        name: "样品准备",
        items: [
          { name: "外采样品采购", type: "Execution", isKey: true },
          { name: "样品拍摄/试穿", type: "Execution" },
        ],
      },
      {
        name: "测款中",
        items: [{ name: "直播测款", type: "Execution", isKey: true }],
      },
      {
        name: "决策中",
        items: [{ name: "测款结果判断", type: "Decision", isKey: true }],
      },
    ],
  },
  设计款: {
    stages: [
      {
        name: "立项",
        items: [
          { name: "款式方向确认", type: "Decision" },
          { name: "设计稿评审", type: "Decision", isKey: true },
        ],
      },
      {
        name: "样品准备",
        items: [
          { name: "初次打样", type: "Execution", isKey: true },
          { name: "改版打样", type: "Execution" },
        ],
      },
      {
        name: "测款中",
        items: [{ name: "市场测试", type: "Execution", isKey: true }],
      },
      {
        name: "决策中",
        items: [{ name: "市场测试决策", type: "Decision", isKey: true }],
      },
    ],
  },
  "改版/修订": {
    stages: [
      {
        name: "立项",
        items: [
          { name: "修订需求评审", type: "Decision", isKey: true },
          { name: "版型对比分析", type: "Execution" },
        ],
      },
      {
        name: "样品准备",
        items: [
          { name: "制版", type: "Execution", isKey: true },
          { name: "修订样衣制作", type: "Execution", isKey: true },
        ],
      },
      {
        name: "测款中",
        items: [{ name: "修订版测试", type: "Execution", isKey: true }],
      },
      {
        name: "决策中",
        items: [{ name: "修订效果判断", type: "Decision", isKey: true }],
      },
    ],
  },
  快速复制: {
    stages: [
      {
        name: "立项",
        items: [{ name: "复制源确认", type: "Decision", isKey: true }],
      },
      {
        name: "工程准备",
        items: [
          { name: "版型/BOM复用", type: "Execution", isKey: true },
          { name: "快速确认样", type: "Execution" },
        ],
      },
      {
        name: "已转档",
        items: [{ name: "商品档案建立", type: "Execution", isKey: true }],
      },
    ],
  },
}

export default function NewProjectPage() {
  const router = useRouter()
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    name: "",
    styleType: "",
    categoryL1: "",
    categoryL2: "",
    styleTags: [] as string[],
    owner: "张三",
    description: "",
  })

  const [hasModifications, setHasModifications] = useState(false)

  useEffect(() => {
    const hasData =
      formData.name || formData.styleType || formData.categoryL1 || formData.categoryL2 || formData.styleTags.length > 0
    setHasModifications(hasData)
  }, [formData])

  const isFormValid = formData.name.length >= 2 && formData.styleType && formData.categoryL1 && formData.categoryL2

  const toggleStyleTag = (tag: string) => {
    setFormData((prev) => ({
      ...prev,
      styleTags: prev.styleTags.includes(tag) ? prev.styleTags.filter((t) => t !== tag) : [...prev.styleTags, tag],
    }))
  }

  const currentTemplate = formData.styleType ? templatesByStyleType[formData.styleType] : null

  const handleCancel = () => {
    if (hasModifications) {
      setShowCancelDialog(true)
    } else {
      router.push("/")
    }
  }

  const handleSaveDraft = () => {
    console.log("[v0] Saving draft:", formData)
    setIsSubmitting(true)
    setTimeout(() => {
      router.push("/")
    }, 500)
  }

  const handleCreateProject = () => {
    if (!isFormValid) return

    console.log("[v0] Creating project:", formData)
    setIsSubmitting(true)

    const projectId = Math.floor(Math.random() * 1000) + 1
    setTimeout(() => {
      router.push(`/projects/${projectId}`)
    }, 500)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SystemNav />

      <div className="flex flex-1">
        <SidebarNav />

        <div className="flex-1 flex flex-col">
          <div className="border-b border-border bg-card px-6 py-6">
            <div className="max-w-5xl mx-auto">
              <div className="flex items-center gap-4">
                <Link href="/">
                  <Button variant="ghost" size="sm" className="gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    返回
                  </Button>
                </Link>
                <div>
                  <h1 className="text-2xl font-semibold text-foreground">创建商品项目</h1>
                  <p className="text-sm text-muted-foreground mt-1">创建新的商品项目工作空间</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto pb-24">
            <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-6">
                  <h2 className="text-lg font-semibold text-foreground">基础信息</h2>
                  <Badge variant="destructive" className="text-xs">
                    必填
                  </Badge>
                </div>

                <div className="space-y-6">
                  {/* Project Name */}
                  <div>
                    <Label htmlFor="name" className="text-sm font-medium text-foreground">
                      项目名称 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="name"
                      placeholder="例如：2025夏季宽松基础T恤"
                      value={formData.name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                      className="mt-2"
                    />
                    {formData.name && formData.name.length < 2 && (
                      <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        项目名称至少2个字符
                      </p>
                    )}
                    {formData.name.length >= 2 && formData.name.length <= 50 && (
                      <p className="text-xs text-muted-foreground mt-1">{formData.name.length}/50 字符</p>
                    )}
                  </div>

                  {/* Style Type - Card Selection */}
                  <div>
                    <Label className="text-sm font-medium text-foreground">
                      款式类型 <span className="text-destructive">*</span>
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1 mb-3">
                      选择款式类型后，系统将自动生成对应的工作流程和阶段
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        {
                          value: "基础款",
                          title: "基础款",
                          description: "稳定款式，注重成本和规模",
                        },
                        {
                          value: "设计款",
                          title: "设计款",
                          description: "探索设计和风格表达",
                        },
                        {
                          value: "改版/修订",
                          title: "改版/修订",
                          description: "优化或修订现有款式",
                        },
                        {
                          value: "快速复制",
                          title: "快速复制",
                          description: "快速复制，注重效率",
                        },
                      ].map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setFormData((prev) => ({ ...prev, styleType: option.value }))}
                          className={`p-4 rounded-lg border-2 transition-all text-left ${
                            formData.styleType === option.value
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`flex items-center justify-center w-5 h-5 rounded-full border-2 transition-all mt-0.5 ${
                                formData.styleType === option.value
                                  ? "border-primary bg-primary"
                                  : "border-muted-foreground"
                              }`}
                            >
                              {formData.styleType === option.value && (
                                <div className="w-2.5 h-2.5 rounded-full bg-primary-foreground"></div>
                              )}
                            </div>
                            <div className="flex-1">
                              <h3 className="text-sm font-semibold text-foreground mb-1">{option.title}</h3>
                              <p className="text-xs text-muted-foreground">{option.description}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Primary Category */}
                  <div>
                    <Label className="text-sm font-medium text-foreground">
                      一级分类 <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.categoryL1}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, categoryL1: value, categoryL2: "" }))}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="选择一级分类" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="上衣">上衣</SelectItem>
                        <SelectItem value="裤装">裤装</SelectItem>
                        <SelectItem value="裙装">裙装</SelectItem>
                        <SelectItem value="外套">外套</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Secondary Category */}
                  <div>
                    <Label className="text-sm font-medium text-foreground">
                      二级分类 <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.categoryL2}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, categoryL2: value }))}
                      disabled={!formData.categoryL1}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="请先选择一级分类" />
                      </SelectTrigger>
                      <SelectContent>
                        {formData.categoryL1 === "上衣" && (
                          <>
                            <SelectItem value="T恤">T恤</SelectItem>
                            <SelectItem value="衬衫">衬衫</SelectItem>
                            <SelectItem value="卫衣">卫衣</SelectItem>
                          </>
                        )}
                        {formData.categoryL1 === "裤装" && (
                          <>
                            <SelectItem value="牛仔裤">牛仔裤</SelectItem>
                            <SelectItem value="休闲裤">休闲裤</SelectItem>
                            <SelectItem value="短裤">短裤</SelectItem>
                          </>
                        )}
                        {formData.categoryL1 === "裙装" && (
                          <>
                            <SelectItem value="连衣裙">连衣裙</SelectItem>
                            <SelectItem value="半身裙">半身裙</SelectItem>
                          </>
                        )}
                        {formData.categoryL1 === "外套" && (
                          <>
                            <SelectItem value="夹克">夹克</SelectItem>
                            <SelectItem value="风衣">风衣</SelectItem>
                            <SelectItem value="羽绒服">羽绒服</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Style Tags */}
                  <div>
                    <Label className="text-sm font-medium text-foreground">风格标签</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {["休闲", "极简", "甜美", "工装"].map((tag) => (
                        <button
                          key={tag}
                          onClick={() => toggleStyleTag(tag)}
                          className={`px-4 py-2 rounded-lg border transition-all text-sm ${
                            formData.styleTags.includes(tag)
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border hover:border-primary/50 text-foreground"
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>

              {formData.styleType && currentTemplate && (
                <Card className="p-6 bg-muted/30">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-1 h-6 bg-primary rounded-full"></div>
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">模板预览</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        基于所选款式类型，本项目将自动生成以下阶段和工作项
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4 mt-6">
                    {currentTemplate.stages.map((stage, stageIdx) => (
                      <div key={stageIdx} className="pl-4">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-2 h-2 rounded-full bg-primary"></div>
                          <h3 className="text-sm font-semibold text-foreground">阶段：{stage.name}</h3>
                        </div>
                        <div className="space-y-2 pl-4 border-l-2 border-border">
                          {stage.items.map((item, itemIdx) => (
                            <div key={itemIdx} className="flex items-center gap-3 pl-4 py-1.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground"></div>
                              <span className="text-sm text-foreground">{item.name}</span>
                              <div className="flex items-center gap-2">
                                <Badge variant={item.type === "Decision" ? "default" : "secondary"} className="text-xs">
                                  {item.type === "Decision" ? "决策" : "执行"}
                                </Badge>
                                {item.isKey && (
                                  <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">
                                    关键项
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              <Card className="p-6">
                <div className="flex items-center gap-2 mb-6">
                  <h2 className="text-lg font-semibold text-foreground">可选信息</h2>
                  <Badge variant="secondary" className="text-xs">
                    选填
                  </Badge>
                </div>

                <div className="space-y-6">
                  {/* Project Owner */}
                  <div>
                    <Label className="text-sm font-medium text-foreground">项目负责人</Label>
                    <Select
                      value={formData.owner}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, owner: value }))}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="张三">张三（商品运营）</SelectItem>
                        <SelectItem value="李四">李四（商品运营）</SelectItem>
                        <SelectItem value="王五">王五（商品运营）</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">默认为当前用户</p>
                  </div>

                  {/* Project Description */}
                  <div>
                    <Label htmlFor="description" className="text-sm font-medium text-foreground">
                      项目说明
                    </Label>
                    <Textarea
                      id="description"
                      placeholder="背景说明或特殊考虑事项"
                      value={formData.description}
                      onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                      className="mt-2 min-h-[100px]"
                    />
                  </div>
                </div>
              </Card>
            </div>
          </div>

          <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-card/95 backdrop-blur-sm z-20">
            <div className="max-w-5xl mx-auto px-6 py-4">
              <div className="flex items-center justify-end gap-3">
                <Button variant="outline" onClick={handleCancel} disabled={isSubmitting}>
                  取消
                </Button>
                <Button variant="secondary" onClick={handleSaveDraft} disabled={isSubmitting} className="gap-2">
                  <Save className="w-4 h-4" />
                  存为草稿
                </Button>
                <Button
                  onClick={handleCreateProject}
                  disabled={!isFormValid || isSubmitting}
                  className="gap-2 min-w-[120px]"
                >
                  {isSubmitting ? (
                    <>正在创建...</>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      创建项目
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认取消？</AlertDialogTitle>
            <AlertDialogDescription>您已输入的信息将会丢失，确定要取消创建项目吗？</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>继续编辑</AlertDialogCancel>
            <AlertDialogAction onClick={() => router.push("/")}>确认取消</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
