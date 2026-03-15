"use client"

import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { SystemNav } from "@/components/system-nav"
import { SidebarNav } from "@/components/sidebar-nav"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Edit, Copy, Power, PowerOff, ArrowLeft } from "lucide-react"
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
import { useState } from "react"

const templateData: Record<string, any> = {
  "TPL-001": {
    id: "TPL-001",
    name: "基础款 - 完整流程模板",
    tags: ["基础款"],
    status: "active" as const,
    description:
      "适用于基础款的标准化全流程模板，强调极致性价比与多维验证（短视频 + 直播），在测款结论判定后再进入转档与制版准备。",
    creator: "系统管理员",
    createdAt: "2025-01-01 09:00",
    updatedAt: "2025-01-15 14:30",
    stages: [
      {
        id: "stage-1",
        name: "01 立项获取",
        tag: "必经",
        description: "项目立项与样衣获取（含深圳前置打版），确保版型/工艺稳定性。",
        workItemCount: 3,
        workItems: [
          {
            name: "商品项目立项",
            type: "执行类",
            required: "必做",
            roles: "商品运营/项目负责人",
            fieldTemplate: "商品项目基础信息",
            note: "—",
          },
          {
            name: "样衣获取（深圳前置打版）",
            type: "执行类",
            required: "必做",
            roles: "版师/打样/采购",
            fieldTemplate: "纸样/标准工艺（可选）",
            note: "—",
          },
          {
            name: "到样入库与核对",
            type: "执行类",
            required: "必做",
            roles: "样衣管理员/仓储",
            fieldTemplate: "样衣编号/入库记录",
            note: "—",
          },
        ],
      },
      {
        id: "stage-2",
        name: "02 评估定价",
        tag: "必经",
        description: "在进入市场前闭合可行性、成本与定价，降低测款有效但毛利不可做风险。",
        workItemCount: 5,
        workItems: [
          {
            name: "初步可行性判断",
            type: "决策类",
            required: "必做",
            roles: "商品负责人/运营",
            fieldTemplate: "结论与风险项",
            note: "—",
          },
          {
            name: "样衣拍摄与试穿",
            type: "执行类",
            required: "必做",
            roles: "内容运营/摄影/试穿",
            fieldTemplate: "素材/试穿反馈",
            note: "—",
          },
          {
            name: "样衣确认",
            type: "决策类",
            required: "必做",
            roles: "商品负责人/版师",
            fieldTemplate: "确认结论",
            note: "—",
          },
          {
            name: "样衣核价",
            type: "执行类",
            required: "必做",
            roles: "成本/采购/供应链",
            fieldTemplate: "成本明细（可选）",
            note: "—",
          },
          {
            name: "样衣定价",
            type: "决策类",
            required: "必做",
            roles: "商品负责人/财务/运营",
            fieldTemplate: "定价规则（可选）",
            note: "—",
          },
        ],
      },
      {
        id: "stage-3",
        name: "03 市场测款",
        tag: "必经",
        description: "双重验证（短视频验证兴趣，直播验证转化）；测款事实支持多实例。",
        workItemCount: 4,
        workItems: [
          {
            name: "短视频测款",
            type: "事实类",
            required: "必做",
            roles: "内容运营",
            fieldTemplate: "测款记录（短视频）",
            note: "支持多条/多轮",
          },
          {
            name: "商品上架",
            type: "里程碑类",
            required: "必做",
            roles: "电商运营/商品运营",
            fieldTemplate: "上架信息",
            note: "—",
          },
          {
            name: "样衣寄送与周转",
            type: "执行类",
            required: "必做",
            roles: "样衣管理员/物流",
            fieldTemplate: "周转记录",
            note: "—",
          },
          {
            name: "直播测款",
            type: "事实类",
            required: "必做",
            roles: "直播运营/主播团队",
            fieldTemplate: "测款记录（直播）",
            note: "支持多场/多轮",
          },
        ],
      },
      {
        id: "stage-4",
        name: "04 结论与推进",
        tag: "必经",
        description: "以测款结论判定为唯一推进闸口；通过后转档并进入制版准备；若结论为改版则执行反馈改版闭环。",
        workItemCount: 7,
        workItems: [
          {
            name: "测款结论判定",
            type: "决策类",
            required: "必做",
            roles: "商品负责人/项目负责人",
            fieldTemplate: "引用测款事实集合",
            note: "输出：通过/改版/淘汰/暂缓",
          },
          {
            name: "商品项目转档",
            type: "里程碑类",
            required: "可选",
            roles: "商品档案/项目负责人",
            fieldTemplate: "SPU/档案信息",
            note: "判定=通过时执行",
          },
          {
            name: "改版任务",
            type: "执行类",
            required: "可选",
            roles: "版师/工艺/商品负责人",
            fieldTemplate: "改版点/交付物",
            note: "判定=改版时执行；改版类型=反馈改版",
          },
          {
            name: "制版准备·打版任务",
            type: "执行类",
            required: "可选",
            roles: "版师/打样",
            fieldTemplate: "纸样/版型",
            note: "判定=通过时执行",
          },
          {
            name: "制版准备·花型任务",
            type: "执行类",
            required: "可选",
            roles: "花型设计/版师",
            fieldTemplate: "花型文件",
            note: "判定=通过且涉及花型时执行",
          },
          {
            name: "首单样衣打样",
            type: "执行类",
            required: "可选",
            roles: "供应链/打样师",
            fieldTemplate: "打样资料",
            note: "判定=通过时执行",
          },
          {
            name: "产前版样衣",
            type: "执行类",
            required: "可选",
            roles: "版房/产前",
            fieldTemplate: "产前版资料",
            note: "判定=通过时执行",
          },
        ],
      },
      {
        id: "stage-5",
        name: "05 资产处置",
        tag: "必经",
        description: "样衣资产留存与退货处理按项目结论与资产策略执行。",
        workItemCount: 2,
        workItems: [
          {
            name: "样衣留存与库存",
            type: "执行类",
            required: "可选",
            roles: "样衣管理员/仓储",
            fieldTemplate: "库存台账",
            note: "基础款生命周期长，优先留存对照样",
          },
          {
            name: "样衣退货与处理",
            type: "执行类",
            required: "可选",
            roles: "采购/仓储",
            fieldTemplate: "退货记录",
            note: "淘汰/不推进时优先处理",
          },
        ],
      },
    ],
  },
  "TPL-002": {
    id: "TPL-002",
    name: "快时尚款 - 快速上架模板",
    tags: ["快时尚款"],
    status: "active" as const,
    description:
      "适用于快时尚款的高时效流程模板，跳过低效环节，采用先上后测（以直播测款为主），由测款结论判定决定是否推进制版准备。",
    creator: "系统管理员",
    createdAt: "2025-01-01 09:00",
    updatedAt: "2025-01-14 10:20",
    stages: [
      {
        id: "stage-1",
        name: "01 立项获取",
        tag: "必经",
        description: "快速立项与到样闭环，优先保障上新速度。",
        workItemCount: 3,
        workItems: [
          {
            name: "商品项目立项",
            type: "执行类",
            required: "必做",
            roles: "商品运营/项目负责人",
            fieldTemplate: "商品项目基础信息",
            note: "—",
          },
          {
            name: "样衣获取",
            type: "执行类",
            required: "必做",
            roles: "采购/供应链",
            fieldTemplate: "供应商/样衣信息",
            note: "—",
          },
          {
            name: "到样入库与核对",
            type: "执行类",
            required: "必做",
            roles: "样衣管理员/仓储",
            fieldTemplate: "样衣编号/入库记录",
            note: "—",
          },
        ],
      },
      {
        id: "stage-2",
        name: "02 评估定价",
        tag: "必经",
        description: "压缩评估周期，但保留成本与定价闭合，避免上架后不可控。",
        workItemCount: 5,
        workItems: [
          {
            name: "初步可行性判断",
            type: "决策类",
            required: "必做",
            roles: "商品负责人/运营",
            fieldTemplate: "结论与风险项",
            note: "—",
          },
          {
            name: "样衣拍摄与试穿",
            type: "执行类",
            required: "必做",
            roles: "内容运营/摄影/试穿",
            fieldTemplate: "素材/试穿反馈",
            note: "—",
          },
          {
            name: "样衣确认",
            type: "决策类",
            required: "必做",
            roles: "商品负责人/版师",
            fieldTemplate: "确认结论",
            note: "—",
          },
          {
            name: "样衣核价",
            type: "执行类",
            required: "必做",
            roles: "成本/采购/供应链",
            fieldTemplate: "成本明细（可选）",
            note: "—",
          },
          {
            name: "样衣定价",
            type: "决策类",
            required: "必做",
            roles: "商品负责人/运营",
            fieldTemplate: "定价结论",
            note: "—",
          },
        ],
      },
      {
        id: "stage-3",
        name: "03 市场测款",
        tag: "必经",
        description: "先上后测，主要通过直播快速获取市场反馈；测款事实支持多实例。",
        workItemCount: 3,
        workItems: [
          {
            name: "商品上架",
            type: "里程碑类",
            required: "必做",
            roles: "电商运营/商品运营",
            fieldTemplate: "上架信息",
            note: "—",
          },
          {
            name: "样衣寄送与周转",
            type: "执行类",
            required: "必做",
            roles: "样衣管理员/物流",
            fieldTemplate: "周转记录",
            note: "—",
          },
          {
            name: "直播测款",
            type: "事实类",
            required: "必做",
            roles: "直播运营/主播团队",
            fieldTemplate: "测款记录（直播）",
            note: "支持多场/多轮",
          },
        ],
      },
      {
        id: "stage-4",
        name: "04 结论与推进",
        tag: "必经",
        description: "以测款结论判定为唯一推进闸口；通过后快速转档并进入制版准备；若结论为改版则走反馈改版闭环。",
        workItemCount: 7,
        workItems: [
          {
            name: "测款结论判定",
            type: "决策类",
            required: "必做",
            roles: "商品负责人/项目负责人",
            fieldTemplate: "引用测款事实集合",
            note: "输出：通过/改版/淘汰/暂缓",
          },
          {
            name: "商品项目转档",
            type: "里程碑类",
            required: "可选",
            roles: "商品档案/项目负责人",
            fieldTemplate: "SPU/档案信息",
            note: "判定=通过时执行",
          },
          {
            name: "改版任务",
            type: "执行类",
            required: "可选",
            roles: "版师/工艺/商品负责人",
            fieldTemplate: "改版点/交付物",
            note: "判定=改版时执行；改版类型=反馈改版",
          },
          {
            name: "制版准备·打版任务",
            type: "执行类",
            required: "可选",
            roles: "版师/打样",
            fieldTemplate: "纸样/版型",
            note: "判定=通过时执行",
          },
          {
            name: "制版准备·花型任务",
            type: "执行类",
            required: "可选",
            roles: "花型设计/版师",
            fieldTemplate: "花型文件",
            note: "判定=通过且涉及花型时执行",
          },
          {
            name: "首单样衣打样",
            type: "执行类",
            required: "可选",
            roles: "供应链/打样师",
            fieldTemplate: "打样资料",
            note: "判定=通过时执行",
          },
          {
            name: "产前版样衣",
            type: "执行类",
            required: "可选",
            roles: "版房/产前",
            fieldTemplate: "产前版资料",
            note: "判定=通过时执行",
          },
        ],
      },
      {
        id: "stage-5",
        name: "05 资产处置",
        tag: "必经",
        description: "强调快速退货/处理，留存为次要（按策略执行）。",
        workItemCount: 2,
        workItems: [
          {
            name: "样衣退货与处理",
            type: "执行类",
            required: "可选",
            roles: "采购/仓储",
            fieldTemplate: "退货记录",
            note: "快时尚淘汰率高，优先处理",
          },
          {
            name: "样衣留存与库存",
            type: "执行类",
            required: "可选",
            roles: "样衣管理员/仓储",
            fieldTemplate: "库存台账",
            note: "仅留关键对标/复盘样",
          },
        ],
      },
    ],
  },
  "TPL-003": {
    id: "TPL-003",
    name: "改版款 - 旧SPU升级模板",
    tags: ["改版款"],
    status: "active" as const,
    description:
      "适用于基于旧款（SPU）升级的改版款模板，先做前置改版定义，再获取针对性样衣并完成直播测款；不允许前置改版后跳过测款直接进入制版准备，必须经过测款结论判定。",
    creator: "系统管理员",
    createdAt: "2025-01-01 09:00",
    updatedAt: "2025-01-10 16:45",
    stages: [
      {
        id: "stage-1",
        name: "01 立项与前置改版",
        tag: "必经",
        description: "先明确差异化改版点（前置改版），再进入样衣获取与验证。",
        workItemCount: 2,
        workItems: [
          {
            name: "商品项目立项",
            type: "执行类",
            required: "必做",
            roles: "商品运营/项目负责人",
            fieldTemplate: "商品项目基础信息",
            note: "需关联旧SPU（如适用）",
          },
          {
            name: "改版任务",
            type: "执行类",
            required: "必做",
            roles: "版师/工艺/商品负责人",
            fieldTemplate: "改版点/交付物",
            note: "改版类型=前置改版",
          },
        ],
      },
      {
        id: "stage-2",
        name: "02 样衣获取与核对",
        tag: "必经",
        description: "按前置改版目标获取/制作样衣，完成到样核对。",
        workItemCount: 2,
        workItems: [
          {
            name: "样衣获取",
            type: "执行类",
            required: "必做",
            roles: "采购/供应链/打样",
            fieldTemplate: "样衣信息",
            note: "—",
          },
          {
            name: "到样入库与核对",
            type: "执行类",
            required: "必做",
            roles: "样衣管理员/仓储",
            fieldTemplate: "样衣编号/入库记录",
            note: "—",
          },
        ],
      },
      {
        id: "stage-3",
        name: "03 内容验证与定价",
        tag: "必经",
        description: "验证改版部位的穿着效果，并评估改版成本增量。",
        workItemCount: 4,
        workItems: [
          {
            name: "样衣拍摄与试穿",
            type: "执行类",
            required: "必做",
            roles: "内容运营/摄影/试穿",
            fieldTemplate: "素材/试穿反馈",
            note: "—",
          },
          {
            name: "样衣确认",
            type: "决策类",
            required: "必做",
            roles: "商品负责人/版师",
            fieldTemplate: "确认结论",
            note: "—",
          },
          {
            name: "样衣核价",
            type: "执行类",
            required: "必做",
            roles: "成本/采购/供应链",
            fieldTemplate: "成本明细（可选）",
            note: "关注改版增量成本",
          },
          {
            name: "样衣定价",
            type: "决策类",
            required: "必做",
            roles: "商品负责人/运营",
            fieldTemplate: "定价结论",
            note: "—",
          },
        ],
      },
      {
        id: "stage-4",
        name: "04 市场测款",
        tag: "必经",
        description: "以直播为主验证老客接受度与差异化卖点；测款事实支持多实例。",
        workItemCount: 3,
        workItems: [
          {
            name: "商品上架",
            type: "里程碑类",
            required: "必做",
            roles: "电商运营/商品运营",
            fieldTemplate: "上架信息",
            note: "—",
          },
          {
            name: "样衣寄送与周转",
            type: "执行类",
            required: "必做",
            roles: "样衣管理员/物流",
            fieldTemplate: "周转记录",
            note: "—",
          },
          {
            name: "直播测款",
            type: "事实类",
            required: "必做",
            roles: "直播运营/主播团队",
            fieldTemplate: "测款记录（直播）",
            note: "支持多场/多轮",
          },
        ],
      },
      {
        id: "stage-5",
        name: "05 结论与推进",
        tag: "必经",
        description: "测款结论判定为唯一推进闸口；判定通过后才可转档并进入制版准备。",
        workItemCount: 6,
        workItems: [
          {
            name: "测款结论判定",
            type: "决策类",
            required: "必做",
            roles: "商品负责人/项目负责人",
            fieldTemplate: "引用测款事实集合",
            note: "输出：通过/改版/淘汰/暂缓",
          },
          {
            name: "商品项目转档",
            type: "里程碑类",
            required: "可选",
            roles: "商品档案/项目负责人",
            fieldTemplate: "SPU/档案信息",
            note: "判定=通过时执行（不允许跳过判定）",
          },
          {
            name: "制版准备·打版任务",
            type: "执行类",
            required: "可选",
            roles: "版师/打样",
            fieldTemplate: "纸样/版型",
            note: "判定=通过时执行",
          },
          {
            name: "制版准备·花型任务",
            type: "执行类",
            required: "可选",
            roles: "花型设计/版师",
            fieldTemplate: "花型文件",
            note: "判定=通过且涉及花型时执行",
          },
          {
            name: "首单样衣打样",
            type: "执行类",
            required: "可选",
            roles: "供应链/打样师",
            fieldTemplate: "打样资料",
            note: "判定=通过时执行",
          },
          {
            name: "产前版样衣",
            type: "执行类",
            required: "可选",
            roles: "版房/产前",
            fieldTemplate: "产前版资料",
            note: "判定=通过时执行",
          },
        ],
      },
      {
        id: "stage-6",
        name: "06 资产处置",
        tag: "必经",
        description: "样衣需与旧款样衣对照留存；淘汰/不推进时执行退货与处理。",
        workItemCount: 2,
        workItems: [
          {
            name: "样衣留存与库存",
            type: "执行类",
            required: "可选",
            roles: "样衣管理员/仓储",
            fieldTemplate: "库存台账",
            note: "建议与旧款对比存放",
          },
          {
            name: "样衣退货与处理",
            type: "执行类",
            required: "可选",
            roles: "采购/仓储",
            fieldTemplate: "退货记录",
            note: "按淘汰/不推进策略执行",
          },
        ],
      },
    ],
  },
  "TPL-004": {
    id: "TPL-004",
    name: "设计款 - 原创迭代模板",
    tags: ["设计款"],
    status: "active" as const,
    description:
      "适用于原创设计款的流程模板，强调拍摄与细节呈现质量、原创溢价的核价定价，以及直播反馈驱动的迭代优化；最终由测款结论判定决定是否转档并进入制版准备。",
    creator: "系统管理员",
    createdAt: "2025-01-01 09:00",
    updatedAt: "2025-01-08 09:15",
    stages: [
      {
        id: "stage-1",
        name: "01 立项获取",
        tag: "必经",
        description: "原创打样成本高，先把样衣资产与到样验收做扎实。",
        workItemCount: 3,
        workItems: [
          {
            name: "商品项目立项",
            type: "执行类",
            required: "必做",
            roles: "商品运营/项目负责人",
            fieldTemplate: "商品项目基础信息",
            note: "—",
          },
          {
            name: "样衣获取",
            type: "执行类",
            required: "必做",
            roles: "设计/版师/供应链",
            fieldTemplate: "样衣信息",
            note: "—",
          },
          {
            name: "到样入库与核对",
            type: "执行类",
            required: "必做",
            roles: "样衣管理员/仓储",
            fieldTemplate: "样衣编号/入库记录",
            note: "—",
          },
        ],
      },
      {
        id: "stage-2",
        name: "02 内容验证与定价",
        tag: "必经",
        description: "拍摄与试穿质量要求高，用于呈现设计细节并支撑溢价定价。",
        workItemCount: 4,
        workItems: [
          {
            name: "样衣拍摄与试穿",
            type: "执行类",
            required: "必do",
            roles: "内容运营/摄影/试穿",
            fieldTemplate: "素材/试穿反馈",
            note: "需呈现设计细节",
          },
          {
            name: "样衣确认",
            type: "决策类",
            required: "必做",
            roles: "设计负责人/商品负责人",
            fieldTemplate: "确认结论",
            note: "—",
          },
          {
            name: "样衣核价",
            type: "执行类",
            required: "必做",
            roles: "成本/供应链",
            fieldTemplate: "成本明细（可选）",
            note: "需体现原创溢价空间",
          },
          {
            name: "样衣定价",
            type: "决策类",
            required: "必做",
            roles: "商品负责人/运营",
            fieldTemplate: "定价结论",
            note: "—",
          },
        ],
      },
      {
        id: "stage-3",
        name: "03 市场测款与迭代",
        tag: "必经",
        description: "以直播反馈为主驱动优化；测款事实与改版可多轮发生。",
        workItemCount: 4,
        workItems: [
          {
            name: "商品上架",
            type: "里程碑类",
            required: "必做",
            roles: "电商运营/商品运营",
            fieldTemplate: "上架信息",
            note: "—",
          },
          {
            name: "样衣寄送与周转",
            type: "执行类",
            required: "必做",
            roles: "样衣管理员/物流",
            fieldTemplate: "周转记录",
            note: "—",
          },
          {
            name: "直播测款",
            type: "事实类",
            required: "必做",
            roles: "直播运营/主播团队",
            fieldTemplate: "测款记录（直播）",
            note: "支持多场/多轮",
          },
          {
            name: "改版任务",
            type: "执行类",
            required: "可选",
            roles: "设计/版师/工艺",
            fieldTemplate: "改版点/交付物",
            note: "反馈驱动优化；改版类型=反馈改版",
          },
        ],
      },
      {
        id: "stage-4",
        name: "04 结论与推进",
        tag: "必经",
        description: "以测款结论判定为最终闸口；通过后转档并进入制版准备与打样。",
        workItemCount: 6,
        workItems: [
          {
            name: "测款结论判定",
            type: "决策类",
            required: "必做",
            roles: "商品负责人/项目负责人",
            fieldTemplate: "引用测款事实集合",
            note: "输出：通过/改版/淘汰/暂缓",
          },
          {
            name: "商品项目转档",
            type: "里程碑类",
            required: "可选",
            roles: "商品档案/项目负责人",
            fieldTemplate: "SPU/档案信息",
            note: "判定=通过时执行",
          },
          {
            name: "制版准备·打版任务",
            type: "执行类",
            required: "可选",
            roles: "版师/打样",
            fieldTemplate: "纸样/版型",
            note: "判定=通过时执行",
          },
          {
            name: "制版准备·花型任务",
            type: "执行类",
            required: "可选",
            roles: "花型设计/版师",
            fieldTemplate: "花型文件",
            note: "判定=通过且涉及花型时执行",
          },
          {
            name: "首单样衣打样",
            type: "执行类",
            required: "可选",
            roles: "供应链/打样师",
            fieldTemplate: "打样资料",
            note: "判定=通过时执行",
          },
          {
            name: "产前版样衣",
            type: "执行类",
            required: "可选",
            roles: "版房/产前",
            fieldTemplate: "产前版资料",
            note: "判定=通过时执行",
          },
        ],
      },
      {
        id: "stage-5",
        name: "05 资产处置",
        tag: "必经",
        description: "原创样衣更接近品牌资产，需更严格的留存与库存管理。",
        workItemCount: 2,
        workItems: [
          {
            name: "样衣退货与处理",
            type: "执行类",
            required: "可选",
            roles: "采购/仓储",
            fieldTemplate: "退货记录",
            note: "按淘汰/不推进策略执行",
          },
          {
            name: "样衣留存与库存管理",
            type: "执行类",
            required: "可选",
            roles: "样衣管理员/仓储",
            fieldTemplate: "库存台账",
            note: "设计款建议纳入严格资产管理",
          },
        ],
      },
    ],
  },
}

export default function TemplateDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogType, setDialogType] = useState<"toggle" | "copy">("toggle")

  const template = templateData[params.id as string] || templateData["TPL-001"]

  const handleCopy = () => {
    // Copy logic here
    router.push("/templates")
  }

  const handleToggleStatus = () => {
    // Toggle status logic here
    setDialogOpen(false)
  }

  const openDialog = (type: "toggle" | "copy") => {
    setDialogType(type)
    setDialogOpen(true)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SystemNav />
      <div className="flex flex-1 overflow-hidden">
        <SidebarNav />
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => router.push("/templates")} className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                返回
              </Button>
            </div>

            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold text-foreground">{template.name}</h1>
                <div className="flex items-center gap-3">
                  <Badge variant={template.status === "active" ? "default" : "secondary"}>
                    {template.status === "active" ? "启用" : "停用"}
                  </Badge>
                  {template.tags.map((tag: string) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link href={`/templates/${template.id}/edit`}>
                  <Button variant="outline" className="gap-2 bg-transparent">
                    <Edit className="w-4 h-4" />
                    编辑模板
                  </Button>
                </Link>
                <Button variant="outline" onClick={() => openDialog("copy")} className="gap-2">
                  <Copy className="w-4 h-4" />
                  复制模板
                </Button>
                <Button variant="outline" onClick={() => openDialog("toggle")} className="gap-2">
                  {template.status === "active" ? (
                    <>
                      <PowerOff className="w-4 h-4" />
                      停用模板
                    </>
                  ) : (
                    <>
                      <Power className="w-4 h-4" />
                      启用模板
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Basic Info */}
            <Card className="p-6 space-y-4">
              <h2 className="text-lg font-semibold text-foreground">模板基本信息</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">模板名称</div>
                  <div className="text-sm font-medium text-foreground">{template.name}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">创建人</div>
                  <div className="text-sm font-medium text-foreground">{template.creator}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">创建时间</div>
                  <div className="text-sm font-medium text-foreground">{template.createdAt}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">最近更新</div>
                  <div className="text-sm font-medium text-foreground">{template.updatedAt}</div>
                </div>
              </div>
              {template.description && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">模板说明</div>
                  <div className="text-sm text-foreground">{template.description}</div>
                </div>
              )}
            </Card>

            {/* Stages & Work Items */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">阶段&工作项</h2>
                <div className="text-sm text-muted-foreground">
                  共 {template.stages.length} 个阶段，
                  {template.stages.reduce((sum: number, stage: any) => sum + stage.workItemCount, 0)} 个工作项
                </div>
              </div>

              {template.stages.map((stage: any, stageIndex: number) => (
                <Card key={stage.id} className="p-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-base font-semibold text-foreground">{stage.name}</h3>
                        <Badge variant="secondary" className="text-xs">
                          {stage.tag}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{stage.description}</p>
                      <div className="text-xs text-muted-foreground mt-1">
                        阶段工作项数：{stage.workItemCount} 个工作项
                      </div>
                    </div>
                  </div>

                  {/* Work Items Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full border border-border">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2 border-b border-border">
                            工作项名称
                          </th>
                          <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2 border-b border-border">
                            类型
                          </th>
                          <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2 border-b border-border">
                            必做性
                          </th>
                          <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2 border-b border-border">
                            执行角色
                          </th>
                          <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2 border-b border-border">
                            关联字段模板
                          </th>
                          <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2 border-b border-border">
                            备注
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {stage.workItems.map((item: any, index: number) => (
                          <tr key={index} className="border-b border-border hover:bg-muted/20">
                            <td className="px-3 py-2 text-sm text-foreground">{item.name}</td>
                            <td className="px-3 py-2 text-sm">
                              <Badge variant="outline" className="text-xs">
                                {item.type}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 text-sm">
                              <Badge variant={item.required === "必做" ? "default" : "secondary"} className="text-xs">
                                {item.required}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 text-sm text-muted-foreground">{item.roles}</td>
                            <td className="px-3 py-2 text-sm text-muted-foreground">{item.fieldTemplate}</td>
                            <td className="px-3 py-2 text-sm text-muted-foreground">{item.note}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </main>
      </div>

      {/* Action Dialog */}
      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialogType === "toggle" ? (template.status === "active" ? "停用模板" : "启用模板") : "复制模板"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialogType === "toggle"
                ? template.status === "active"
                  ? "停用后，该模板将不能用于新建商品项目，但不影响已使用该模板的项目。确定要停用吗？"
                  : "确定要启用该模板吗？启用后可用于新建商品项目。"
                : "将基于当前模板创建一个副本，名称将自动添加'副本'后缀。确定要复制吗？"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={dialogType === "toggle" ? handleToggleStatus : handleCopy}>
              确定
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
