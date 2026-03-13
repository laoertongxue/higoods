'use client'

import { SettlementDetailPage } from '@/components/fcs/settlement/settlement-detail-page'
import { use } from 'react'

interface Props {
  params: Promise<{ factoryId: string }>
}

export default function SettlementDetailRoute({ params }: Props) {
  const { factoryId } = use(params)
  return <SettlementDetailPage factoryId={factoryId} />
}
