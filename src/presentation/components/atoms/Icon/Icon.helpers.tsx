import type { ReactNode } from "react"

import type { IconName } from "./Icon.types"

const ICON_GEOMETRY: Readonly<Record<IconName, ReactNode>> = {
  "arrow-down": <path d="M12 4v16m0 0 6-6m-6 6-6-6" />,
  "arrow-down-right": <path d="m6 7 11 11m0 0v-8m0 8H9" />,
  "arrow-up": <path d="M12 20V4m0 0 6 6m-6-6-6 6" />,
  "arrow-up-right": <path d="M6 17 17 6m0 0H9m8 0v8" />,
  bank: (
    <>
      <path d="m3 9 9-5 9 5" />
      <path d="M5 10v7m4-7v7m6-7v7m4-7v7M3 20h18M2 8h20" />
    </>
  ),
  calendar: (
    <>
      <rect height="17" rx="2" width="18" x="3" y="4" />
      <path d="M8 2v4m8-4v4M3 9h18" />
    </>
  ),
  category: (
    <>
      <rect height="7" rx="1.5" width="7" x="3" y="3" />
      <rect height="7" rx="1.5" width="7" x="14" y="3" />
      <rect height="7" rx="1.5" width="7" x="3" y="14" />
      <rect height="7" rx="1.5" width="7" x="14" y="14" />
    </>
  ),
  "chevron-left": <path d="m15 18-6-6 6-6" />,
  "chevron-right": <path d="m9 18 6-6-6-6" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  debt: (
    <>
      <path d="M4 7.5h16v10H4z" />
      <path d="M7 12h4m5-2v4M8 5v2m8-2v2" />
      <circle cx="16" cy="12" r="2.5" />
    </>
  ),
  download: <path d="M12 3v12m0 0 5-5m-5 5-5-5M4 21h16" />,
  filter: <path d="M4 5h16M7 12h10m-7 7h4" />,
  receipt: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
      <path d="M9 8h6m-6 4h6m-6 4h3" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m16 16 5 5" />
    </>
  ),
  transfer: (
    <path d="M4 8h14m0 0-4-4m4 4-4 4M20 16H6m0 0 4 4m-4-4 4-4" />
  ),
  trend: (
    <>
      <path d="m3 17 6-6 4 4 8-9" />
      <path d="M15 6h6v6" />
    </>
  ),
  wallet: (
    <>
      <path d="M4 6.5h15a2 2 0 0 1 2 2v10H5a2 2 0 0 1-2-2v-11a3 3 0 0 1 3-3h12" />
      <path d="M16 11h5v4h-5a2 2 0 0 1 0-4Z" />
    </>
  ),
}

export function getIconGeometry(name: IconName): ReactNode {
  return ICON_GEOMETRY[name]
}
