/// <reference types="vite/client" />

declare module 'lucide-react' {
  import { FC, SVGProps } from 'react'
  type Icon = FC<SVGProps<SVGSVGElement>>
  export const ArrowDown: Icon
  export const ArrowUp: Icon
  export const ChevronsUpDown: Icon
  export const LoaderCircle: Icon
  export const RefreshCw: Icon
  export const Sparkles: Icon
  export const Plus: Icon
  export const Square: Icon
  export const X: Icon
  export const AlertCircle: Icon
  export const Check: Icon
  export const ChevronLeft: Icon
  export const ChevronRight: Icon
  export const Cloud: Icon
  export const Heart: Icon
  export const Home: Icon
  export const Menu: Icon
  export const Settings: Icon
  export const User: Icon
  export const Activity: Icon
  export const Calendar: Icon
  export const Zap: Icon
  export const TrendingUp: Icon
  export const TrendingDown: Icon
  export const Gauge: Icon
  export const Target: Icon
  export const Shield: Icon
  export const Info: Icon
  export const Sun: Icon
  export const Moon: Icon
  export const Bell: Icon
  export const Search: Icon
  export const Download: Icon
  export const Upload: Icon
  export const Trash2: Icon
  export const Edit3: Icon
  export const ExternalLink: Icon
  export const LogOut: Icon
}

declare module '@assistant-ui/react' {
  export const AssistantRuntimeProvider: any
  export const AuiIf: any
  export const ComposerPrimitive: any
  export const MessagePrimitive: any
  export const ThreadPrimitive: any
  export const useAssistantRuntime: any
  export const useLocalRuntime: any
  export type ChatModelAdapter = any
  export type ThreadMessage = any
}
