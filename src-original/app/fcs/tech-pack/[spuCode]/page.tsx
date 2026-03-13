'use client'

import { TechPackPage } from '@/components/fcs/tech-pack/tech-pack-view'
import { use } from 'react'

interface PageProps {
  params: Promise<{ spuCode: string }>
}

export default function Page({ params }: PageProps) {
  const { spuCode } = use(params)
  return <TechPackPage spuCode={decodeURIComponent(spuCode)} />
}
