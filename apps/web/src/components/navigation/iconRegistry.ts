import {
  Building2,
  CalendarDays,
  Clock,
  type LucideIcon,
  Palette,
  PanelLeft,
  Scissors,
  SlidersHorizontal,
  Users,
} from 'lucide-react'

/**
 * Allowlist of icons the server may reference in navigation items (DEC-019).
 * Names follow lucide's kebab-case. Unknown names are ignored by the sidebar.
 */
export const iconRegistry: Readonly<Record<string, LucideIcon>> = {
  'building-2': Building2,
  'calendar-days': CalendarDays,
  clock: Clock,
  palette: Palette,
  'panel-left': PanelLeft,
  scissors: Scissors,
  'sliders-horizontal': SlidersHorizontal,
  users: Users,
}
