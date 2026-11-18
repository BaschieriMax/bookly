import { ArrowDown, ArrowUp, Circle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { CheckboxField } from '@/components/ui/CheckboxField'
import { iconRegistry } from '@/components/navigation/iconRegistry'
import { translateLabel } from '@/components/navigation/navigationItems'
import { AdminPageHeader, Panel, QueryState } from '@/features/admin/AdminUi'
import type { NavigationAdminItem } from '@/types/api'
import { useNavigationAdmin, useUpdateNavigationItem } from './platformApi'
import { platformErrorMessage } from './platformErrors'

const AREAS = ['Admin', 'Platform'] as const

/** Super-admin view of the server-driven sidebar (DEC-019): show/hide and reorder items. */
export default function NavigationAdminPage() {
  const { t } = useTranslation(['platform', 'common', 'nav'])
  const { data: items, isPending, error } = useNavigationAdmin()
  const update = useUpdateNavigationItem()

  const save = async (change: { id: number; isEnabled?: boolean; sortOrder?: number }[]) => {
    try {
      for (const item of change) await update.mutateAsync(item)
      toast.success(t('navigation.saved'))
    } catch (err) {
      toast.error(platformErrorMessage(t, err))
    }
  }

  /** Swaps the sort order with the neighbour; equal orders are spread first so the swap is visible. */
  const move = (list: NavigationAdminItem[], index: number, direction: -1 | 1) => {
    const other = list[index + direction]
    const current = list[index]
    if (!current || !other) return
    const currentOrder = current.sortOrder === other.sortOrder ? index : current.sortOrder
    const otherOrder = current.sortOrder === other.sortOrder ? index + direction : other.sortOrder
    void save([
      { id: current.id, sortOrder: otherOrder },
      { id: other.id, sortOrder: currentOrder },
    ])
  }

  return (
    <section className="flex flex-col gap-6">
      <AdminPageHeader title={t('navigation.title')} lead={t('navigation.lead')} />
      <QueryState isPending={isPending} error={error}>
        {AREAS.map((area) => {
          const list = (items ?? []).filter((i) => i.area === area)
          if (list.length === 0) return null
          return (
            <Panel key={area} title={t(`navigation.areas.${area}`)}>
              <ul className="flex flex-col divide-y divide-border">
                {list.map((item, index) => {
                  const Icon = iconRegistry[item.icon] ?? Circle
                  const label = translateLabel(item.labelKey)
                  return (
                    <li key={item.id} className="flex flex-wrap items-center gap-3 py-2">
                      <Icon aria-hidden="true" className="size-5 shrink-0 text-muted" />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="font-medium">{label}</span>
                        <span className="text-xs text-muted">
                          {item.route} · {t('navigation.roles', { roles: item.roles.join(', ') })}
                        </span>
                      </div>
                      <CheckboxField
                        label={t('navigation.enabled')}
                        checked={item.isEnabled}
                        disabled={update.isPending}
                        onChange={(e) => void save([{ id: item.id, isEnabled: e.target.checked }])}
                      />
                      <div className="flex">
                        <Button
                          variant="ghost"
                          className="px-3"
                          disabled={index === 0 || update.isPending}
                          aria-label={t('navigation.moveUp', { label })}
                          onClick={() => move(list, index, -1)}
                        >
                          <ArrowUp aria-hidden="true" className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          className="px-3"
                          disabled={index === list.length - 1 || update.isPending}
                          aria-label={t('navigation.moveDown', { label })}
                          onClick={() => move(list, index, 1)}
                        >
                          <ArrowDown aria-hidden="true" className="size-4" />
                        </Button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </Panel>
          )
        })}
      </QueryState>
    </section>
  )
}
