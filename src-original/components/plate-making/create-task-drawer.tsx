'use client'

import { useState } from 'react'
import { CalendarIcon, Upload, Plus } from 'lucide-react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

interface CreateTaskDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateTaskDrawer({ open, onOpenChange }: CreateTaskDrawerProps) {
  const [deadline, setDeadline] = useState<Date>()
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle>新建制版任务</SheetTitle>
        </SheetHeader>
        
        <ScrollArea className="flex-1">
          <div className="px-6 py-4">
            <Accordion type="multiple" defaultValue={['basic', 'source', 'input', 'constraint', 'sample']} className="space-y-4">
              {/* 基本信息 */}
              <AccordionItem value="basic" className="border rounded-lg px-4">
                <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                  基本信息
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pb-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">任务标题 *</Label>
                    <Input id="title" placeholder="请输入任务标题" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>优先级</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="选择优先级" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high">高</SelectItem>
                          <SelectItem value="medium">中</SelectItem>
                          <SelectItem value="low">低</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>负责人 *</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="选择负责人" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="zhangsan">张三</SelectItem>
                          <SelectItem value="lisi">李四</SelectItem>
                          <SelectItem value="wangwu">王五</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>参与人</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="选择参与人（可多选）" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="zhangsan">张三</SelectItem>
                        <SelectItem value="lisi">李四</SelectItem>
                        <SelectItem value="wangwu">王五</SelectItem>
                        <SelectItem value="zhaoliu">赵六</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>截止日期</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            !deadline && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {deadline ? format(deadline, 'PPP', { locale: zhCN }) : '选择日期'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={deadline}
                          onSelect={setDeadline}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </AccordionContent>
              </AccordionItem>
              
              {/* 来源与绑定 */}
              <AccordionItem value="source" className="border rounded-lg px-4">
                <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                  来源与绑定
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pb-4">
                  <div className="space-y-2">
                    <Label>来源类型</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="选择来源类型" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="spu">SPU需求</SelectItem>
                        <SelectItem value="revision">改版需求</SelectItem>
                        <SelectItem value="original">原创设计</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>商品项目</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="选择商品项目" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="prj001">PRJ-2024-001 春季女装项目</SelectItem>
                        <SelectItem value="prj002">PRJ-2024-002 基础款项目</SelectItem>
                        <SelectItem value="prj003">PRJ-2024-003 夏季男装项目</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>商品/SPU</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="选择SPU" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="spu001">SPU-001 基础T恤</SelectItem>
                        <SelectItem value="spu002">SPU-002 连衣裙</SelectItem>
                        <SelectItem value="spu003">SPU-003 休闲短裤</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>改版来源建议</Label>
                    <Textarea placeholder="输入改版建议说明..." rows={2} />
                  </div>
                </AccordionContent>
              </AccordionItem>
              
              {/* 制版输入 */}
              <AccordionItem value="input" className="border rounded-lg px-4">
                <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                  制版输入
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pb-4">
                  <div className="space-y-2">
                    <Label>参考版型</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="选择参考版型" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="v001">版型-001 标准修身</SelectItem>
                        <SelectItem value="v002">版型-002 宽松廓形</SelectItem>
                        <SelectItem value="v003">版型-003 A字型</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>制版图/参考资料</Label>
                    <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-blue-400 transition-colors cursor-pointer">
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">点击或拖拽上传文件</p>
                      <p className="text-xs text-muted-foreground mt-1">支持 JPG, PNG, PDF 格式</p>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
              
              {/* 约束条件 */}
              <AccordionItem value="constraint" className="border rounded-lg px-4">
                <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                  约束条件
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pb-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>目标成本 (元)</Label>
                      <Input type="number" placeholder="0.00" />
                    </div>
                    <div className="space-y-2">
                      <Label>目标利润率 (%)</Label>
                      <Input type="number" placeholder="0" />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>工艺规则</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="选择工艺规则" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">标准工艺</SelectItem>
                        <SelectItem value="premium">高端工艺</SelectItem>
                        <SelectItem value="eco">环保工艺</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </AccordionContent>
              </AccordionItem>
              
              {/* 关联样衣 */}
              <AccordionItem value="sample" className="border rounded-lg px-4">
                <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                  关联样衣
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pb-4">
                  <Button variant="outline" className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    选择关联样衣
                  </Button>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox id="need-test" />
                    <Label htmlFor="need-test" className="text-sm font-normal cursor-pointer">
                      需要测款
                    </Label>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </ScrollArea>
        
        <Separator />
        <SheetFooter className="px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700">
            创建并开始
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
