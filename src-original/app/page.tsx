'use client'

import dynamic from 'next/dynamic'

// 使用 dynamic + ssr:false 完全跳过服务端渲染，
// 避免 Radix UI 生成的 ID 在 SSR 与客户端不一致导致 hydration mismatch，
// 同时也避免服务端加载有缓存问题的 tech-pack 模块。
const ClientApp = dynamic(() => import('@/components/fcs/client-app'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center">
      <div className="text-muted-foreground">Loading...</div>
    </div>
  ),
})

export default function Home() {
  return <ClientApp />
}
