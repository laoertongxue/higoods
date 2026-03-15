"use client"

import { Package, ShoppingCart, Factory, Truck, Radio, FileText, Database, BarChart3, Bell } from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"

const systems = [
  { id: "pcs", name: "商品中心系统", abbr: "PCS", icon: Package, active: false },
  { id: "pms", name: "采购管理系统", abbr: "PMS", icon: ShoppingCart, active: true },
  { id: "fcs", name: "工厂协同系统", abbr: "FCS", icon: Factory, active: false },
  { id: "wls", name: "仓储物流系统", abbr: "WLS", icon: Truck, active: false },
  { id: "lsos", name: "直播运营系统", abbr: "LSOS", icon: Radio, active: false },
  { id: "oms", name: "订单管理系统", abbr: "OMS", icon: FileText, active: false },
  { id: "bfis", name: "业财一体化系统", abbr: "BFIS", icon: Database, active: false },
  { id: "dds", name: "数据决策系统", abbr: "DDS", icon: BarChart3, active: false },
]

export function PmsSystemNav() {
  return (
    <div className="border-b border-border bg-card/50 backdrop-blur-sm">
      <div className="max-w-[1920px] mx-auto px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-8">
            <div className="text-xl font-bold text-primary">HiGood</div>

            <div className="flex items-center gap-1 overflow-x-auto">
              {systems.map((system) => {
                const Icon = system.icon
                return (
                  <button
                    key={system.id}
                    className={cn(
                      "flex items-center gap-2 px-4 py-3 border-b-2 transition-all whitespace-nowrap",
                      system.active
                        ? "border-primary text-primary bg-primary/5"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50",
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{system.name}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </Button>

            <div className="flex items-center gap-2">
              <Avatar className="w-8 h-8">
                <AvatarImage src="/placeholder.svg?height=32&width=32" />
                <AvatarFallback>张三</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">张三</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
