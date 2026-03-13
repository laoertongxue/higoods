import { notFound } from 'next/navigation'
import { systems, menusBySystem } from '@/lib/mock-data'

interface PageProps {
  params: Promise<{
    system: string
    page: string
  }>
}

export default async function DynamicPage({ params }: PageProps) {
  const { system, page } = await params
  
  // 验证系统是否存在
  const systemData = systems.find(s => s.id === system)
  if (!systemData) {
    notFound()
  }
  
  // 查找菜单项
  const menus = menusBySystem[system] || []
  let menuItem: { key: string; title: string } | null = null
  
  for (const group of menus) {
    for (const item of group.items) {
      if (item.key === page) {
        menuItem = { key: item.key, title: item.title }
        break
      }
      if (item.children) {
        for (const child of item.children) {
          if (child.key === page) {
            menuItem = { key: child.key, title: child.title }
            break
          }
        }
      }
    }
    if (menuItem) break
  }
  
  if (!menuItem) {
    notFound()
  }
  
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{menuItem.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {systemData.name} - {menuItem.title} 页面
        </p>
      </div>
      
      <div className="rounded-lg border bg-card p-8 text-center">
        <div className="mx-auto max-w-md space-y-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 mx-auto">
            <span className="text-2xl text-blue-600">
              {menuItem.title.charAt(0)}
            </span>
          </div>
          <h2 className="text-lg font-semibold">{menuItem.title}</h2>
          <p className="text-muted-foreground">
            这是 {systemData.name} ({systemData.shortName}) 系统的 {menuItem.title} 功能页面占位。
            <br />
            实际开发中，请在此处添加具体的业务内容。
          </p>
        </div>
      </div>
    </div>
  )
}
