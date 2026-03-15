"use client"

import { useParams } from "next/navigation"
import NewTemplatePage from "../../new/page"

export default function EditTemplatePage() {
  const params = useParams()
  // In a real app, this would fetch the template data and pass it to the form
  // For now, we'll reuse the new template page component
  return <NewTemplatePage />
}
