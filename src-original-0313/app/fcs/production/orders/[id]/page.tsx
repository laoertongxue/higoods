'use client'

import { OrderDetailPage } from '@/components/fcs/production/order-detail-page'
import { use } from 'react'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function Page({ params }: PageProps) {
  const { id } = use(params)
  return <OrderDetailPage orderId={id} />
}
