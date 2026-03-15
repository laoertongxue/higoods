import type React from "react"
import { OFALayout } from "@/components/ofa-layout"

export default function BFISLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <OFALayout>{children}</OFALayout>
}
