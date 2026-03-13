/** @type {import('next').NextConfig} */
/* cache-bust: 2026-03-12 */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      // 染印加工单旧路径
      { source: '/fcs/dye-print-orders', destination: '/fcs/process/dye-print-orders', permanent: false },
      // 旧 execution 路径收口到 progress 规范路径
      { source: '/fcs/execution/progress',       destination: '/fcs/progress/board',           permanent: false },
      { source: '/fcs/execution/triage',         destination: '/fcs/progress/exceptions',      permanent: false },
      { source: '/fcs/execution/notifications',  destination: '/fcs/progress/urge',            permanent: false },
      { source: '/fcs/execution/handover-trace', destination: '/fcs/progress/handover',        permanent: false },
      { source: '/fcs/execution/material-trace', destination: '/fcs/progress/material',        permanent: false },
      { source: '/fcs/execution/status-sync',    destination: '/fcs/progress/status-writeback', permanent: false },
      // 旧 dispatch 路径收口
      { source: '/fcs/dispatch/modes',           destination: '/fcs/dispatch/board',           permanent: false },
      { source: '/fcs/dispatch/bidding',         destination: '/fcs/dispatch/tenders',         permanent: false },
      { source: '/fcs/dispatch/direct',          destination: '/fcs/dispatch/board',           permanent: false },
      // 旧 quality 路径收口
      { source: '/fcs/quality/inspection',       destination: '/fcs/quality/qc-records',       permanent: false },
      { source: '/fcs/quality/penalty',          destination: '/fcs/quality/deduction-calc',   permanent: false },
    ]
  },
}

export default nextConfig
