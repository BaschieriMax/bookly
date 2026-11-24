import { useRef, type KeyboardEvent, type ReactNode } from 'react'

interface TabItem<T extends string> {
  value: T
  label: string
}

interface TabListProps<T extends string> {
  /** Prefix of the tab and panel ids (useId()). */
  idBase: string
  label: string
  value: T
  tabs: readonly TabItem<T>[]
  onChange: (value: T) => void
  className?: string
}

const tabId = (idBase: string, value: string) => `${idBase}-tab-${value}`
const panelId = (idBase: string, value: string) => `${idBase}-panel-${value}`

/**
 * WAI-ARIA tabs: only the selected tab is in the tab order, arrow keys / Home / End move
 * between tabs and select them (automatic activation).
 */
export function TabList<T extends string>({
  idBase,
  label,
  value,
  tabs,
  onChange,
  className = '',
}: TabListProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = tabs.findIndex((tab) => tab.value === value)
    const last = tabs.length - 1
    const next =
      event.key === 'ArrowRight'
        ? current === last
          ? 0
          : current + 1
        : event.key === 'ArrowLeft'
          ? current === 0
            ? last
            : current - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null
    if (next === null) return
    event.preventDefault()
    onChange(tabs[next]!.value)
    refs.current[next]?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={`flex gap-1 border-b border-border px-4 ${className}`}
    >
      {tabs.map((tab, index) => {
        const selected = tab.value === value
        return (
          <button
            key={tab.value}
            ref={(node) => {
              refs.current[index] = node
            }}
            id={tabId(idBase, tab.value)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId(idBase, tab.value)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.value)}
            className="-mb-px min-h-12 flex-1 border-b-[3px] border-transparent px-3 text-[15px] font-semibold text-muted transition-colors hover:text-ink aria-selected:border-primary aria-selected:text-primary-text sm:flex-none"
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

interface TabPanelProps {
  idBase: string
  value: string
  children: ReactNode
  /** Hide instead of unmounting, e.g. to keep a form's unsaved values. */
  hidden?: boolean
  className?: string
}

export function TabPanel({
  idBase,
  value,
  children,
  hidden = false,
  className = '',
}: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      id={panelId(idBase, value)}
      aria-labelledby={tabId(idBase, value)}
      hidden={hidden}
      className={className}
    >
      {children}
    </div>
  )
}
