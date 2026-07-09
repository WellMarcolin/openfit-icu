import type { FC, SVGProps } from 'react'
import {
  Activity,
  Bike,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Cloud,
  Download,
  Dumbbell,
  ExternalLink,
  Footprints,
  Gauge,
  Heart,
  Home,
  Info,
  LogOut,
  Menu,
  Moon,
  Mountain,
  Settings,
  Shield,
  Sparkles,
  Sun,
  Target,
  Trash2,
  TrendingUp,
  User,
  Waves,
  X,
  Zap,
  Bell,
  Search,
  RefreshCw,
} from 'lucide-react'

export type AppIcon = FC<SVGProps<SVGSVGElement>>

export {
  Activity as ActivityIcon,
  Activity as ActiveIcon,
  Bell as BellIcon,
  Bike as BikeIcon,
  Calendar as CalendarIcon,
  Check as CheckIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  ChevronsUpDown as ChevronDownIcon,
  ChevronsUpDown as ChevronUpIcon,
  Cloud as CloudIcon,
  Download as ExportIcon,
  Dumbbell as DumbbellIcon,
  ExternalLink as ExternalIcon,
  Footprints as FootprintsIcon,
  Gauge as GaugeIcon,
  Heart as HeartIcon,
  Home as TodayIcon,
  Home as BodyIcon,
  Info as InfoIcon,
  LogOut as DisconnectIcon,
  Menu as MenuIcon,
  Menu as MinusIcon,
  Menu as PanelLeftIcon,
  Moon as MoonIcon,
  Mountain as MountainIcon,
  RefreshCw as LoaderIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
  Shield as ShieldIcon,
  Sparkles as SparkleIcon,
  Sun as SunIcon,
  Target as StepsIcon,
  Target as TargetIcon,
  Trash2 as TrashIcon,
  TrendingUp as TrendIcon,
  User as UserIcon,
  Waves as WavesIcon,
  X as CloseIcon,
  Zap as ZapIcon,
  Heart as SleepIcon,
  Activity as DurationIcon,
  Target as DeviceIcon,
  Heart as WaterIcon,
  Activity as CaloriesIcon,
  Activity as NutritionIcon,
  Heart as BreathingIcon,
  Activity as FloorsIcon,
  Gauge as SignalIcon,
  Activity as DistanceIcon,
  Heart as BatteryIcon,
}

import type { SportType } from '@/types'

const BIKE_SPORTS = new Set(['Ride', 'VirtualRide', 'GravelRide', 'MountainBikeRide'])
const RUN_SPORTS = new Set(['Run', 'VirtualRun', 'TrailRun'])
const WALK_SPORTS = new Set(['Walk', 'Hike'])

export function getSportIcon(sport: SportType): AppIcon {
  if (BIKE_SPORTS.has(sport)) return Bike
  if (RUN_SPORTS.has(sport)) return Footprints
  if (sport === 'Swim') return Waves
  if (WALK_SPORTS.has(sport)) return Mountain
  if (sport === 'WeightTraining') return Dumbbell
  return Activity
}
