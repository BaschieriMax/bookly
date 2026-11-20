import '@/styles/fonts-tenant.css'
import { Check, ImageUp, Trash2 } from 'lucide-react'
import { useId, useRef, useState, type ChangeEvent } from 'react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { isHexColor } from '@/lib/color'
import {
  BRAND_FONTS,
  BRAND_GROUNDS,
  BRAND_SWATCHES,
  type BrandFont,
  type BrandGround,
} from '@/features/tenant/brandPresets'
import {
  DEFAULT_PRIMARY,
  primaryTextContrast,
  tenantThemeStyle,
} from '@/features/tenant/tenantTheme'
import type { TenantBrandSettings } from '@/types/api'
import {
  useDeleteLogo,
  useSaveTenantBrand,
  useTenantBrand,
  useTenantSettings,
  useUploadLogo,
} from './adminApi'
import { adminErrorMessage } from './adminErrors'
import { AdminPageHeader, Badge, Panel, QueryState } from './AdminUi'
import { useActiveMembership } from './useAdminRole'

const MAX_LOGO_BYTES = 200 * 1024
const LOGO_TYPES = ['image/png', 'image/webp']

interface Draft {
  primaryColor: string | null
  ground: BrandGround
  headingFont: BrandFont
}

const toDraft = (brand: TenantBrandSettings): Draft => ({
  primaryColor: brand.primaryColor,
  ground: brand.ground === 'Dark' ? 'Dark' : 'Light',
  headingFont: (BRAND_FONTS as readonly string[]).includes(brand.headingFont)
    ? (brand.headingFont as BrandFont)
    : 'Sans',
})

const fontClass: Record<BrandFont, string> = {
  Script: 'font-brand-script',
  Serif: 'font-brand-serif',
  Sans: 'font-brand-sans',
}

/** Segmented radio group (sfondo, carattere): large targets, keyboard friendly. */
function OptionGroup<T extends string>({
  legend,
  options,
  value,
  onChange,
  renderLabel,
}: {
  legend: string
  options: readonly T[]
  value: T
  onChange: (value: T) => void
  renderLabel: (option: T) => React.ReactNode
}) {
  const name = useId()
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-1 text-sm font-semibold">{legend}</legend>
      <div className="grid auto-cols-fr grid-flow-col gap-2">
        {options.map((option) => (
          <label
            key={option}
            className="flex min-h-11 cursor-pointer items-center justify-center rounded-control border border-border-strong bg-surface px-3 py-2 text-center has-checked:border-primary has-checked:bg-primary-soft has-checked:text-primary-text has-focus-visible:outline-2 has-focus-visible:outline-focus"
          >
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              className="sr-only"
            />
            {renderLabel(option)}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function ColorPicker({
  value,
  onChange,
}: {
  value: string | null
  onChange: (value: string | null) => void
}) {
  const { t } = useTranslation('admin')
  const [hexText, setHexText] = useState(value ?? '')
  const [hexError, setHexError] = useState(false)
  const effective = value ?? DEFAULT_PRIMARY

  const pick = (color: string | null) => {
    onChange(color)
    setHexText(color ?? '')
    setHexError(false)
  }

  const onHexChange = (event: ChangeEvent<HTMLInputElement>) => {
    const text = event.target.value.trim()
    setHexText(text)
    const valid = isHexColor(text)
    setHexError(!valid && text !== '')
    if (valid) onChange(text.toLowerCase())
  }

  return (
    <fieldset className="flex min-w-0 flex-col gap-3">
      <legend className="mb-1 text-sm font-semibold">{t('brand.color')}</legend>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={value === null}
          onClick={() => pick(null)}
          className="flex min-h-11 items-center gap-2 rounded-pill border border-border-strong bg-surface px-3 text-sm font-semibold aria-pressed:border-primary aria-pressed:bg-primary-soft"
        >
          {t('brand.defaultColor')}
        </button>
        {BRAND_SWATCHES.map((swatch) => {
          const selected = value === swatch.value
          return (
            <button
              key={swatch.id}
              type="button"
              aria-pressed={selected}
              aria-label={t(`brand.swatches.${swatch.id}`)}
              title={t(`brand.swatches.${swatch.id}`)}
              onClick={() => pick(swatch.value)}
              style={{ backgroundColor: swatch.value }}
              className="flex size-11 items-center justify-center rounded-pill border border-border-strong ring-offset-2 ring-offset-surface aria-pressed:ring-2 aria-pressed:ring-ink"
            >
              {selected && (
                <Check aria-hidden="true" className="size-5 text-white mix-blend-difference" />
              )}
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t('brand.customColor')}
          <input
            type="color"
            value={effective}
            onChange={(event) => pick(event.target.value)}
            className="h-11 w-16 cursor-pointer rounded-control border border-border-strong bg-surface p-1"
          />
        </label>
        <TextField
          label={t('brand.hex')}
          value={hexText}
          placeholder={DEFAULT_PRIMARY}
          spellCheck={false}
          maxLength={7}
          onChange={onHexChange}
          error={hexError ? t('brand.hexInvalid') : undefined}
          className="max-w-44 min-w-32 flex-1"
        />
      </div>
    </fieldset>
  )
}

function LogoField({
  slug,
  hasLogo,
  version,
  onChanged,
}: {
  slug: string
  hasLogo: boolean
  version: number
  onChanged: () => void
}) {
  const { t } = useTranslation(['admin', 'common'])
  const upload = useUploadLogo()
  const remove = useDeleteLogo()
  const inputRef = useRef<HTMLInputElement>(null)

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!LOGO_TYPES.includes(file.type) || file.size > MAX_LOGO_BYTES) {
      toast.error(t('errors.admin.invalid_logo'))
      return
    }
    try {
      await upload.mutateAsync(file)
      onChanged()
      toast.success(t('brand.logoSaved'))
    } catch (error) {
      toast.error(adminErrorMessage(t, error))
    }
  }

  const onRemove = async () => {
    try {
      await remove.mutateAsync(undefined)
      toast.success(t('brand.logoRemoved'))
    } catch (error) {
      toast.error(adminErrorMessage(t, error))
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-semibold">{t('brand.logo')}</span>
      <div className="flex flex-wrap items-center gap-3">
        {hasLogo && (
          <img
            src={`/api/public/tenants/${encodeURIComponent(slug)}/logo?v=${version}`}
            alt={t('brand.logo')}
            className="size-16 rounded-pill border border-border-strong object-cover"
          />
        )}
        <input
          ref={inputRef}
          type="file"
          accept={LOGO_TYPES.join(',')}
          aria-label={hasLogo ? t('brand.replaceLogo') : t('brand.uploadLogo')}
          className="sr-only"
          onChange={(event) => void onFile(event)}
        />
        <Button
          variant="secondary"
          loading={upload.isPending}
          onClick={() => inputRef.current?.click()}
        >
          <ImageUp aria-hidden="true" className="size-4" />
          {hasLogo ? t('brand.replaceLogo') : t('brand.uploadLogo')}
        </Button>
        {hasLogo && (
          <Button variant="ghost" loading={remove.isPending} onClick={() => void onRemove()}>
            <Trash2 aria-hidden="true" className="size-4" />
            {t('brand.removeLogo')}
          </Button>
        )}
      </div>
      <p className="text-sm text-muted">{t('brand.logoHint')}</p>
    </div>
  )
}

/** Live preview of the public page with the draft brand, re-skinned through tokens only. */
function BrandPreview({
  draft,
  name,
  slug,
  hasLogo,
  version,
}: {
  draft: Draft
  name: string
  slug: string
  hasLogo: boolean
  version: number
}) {
  const { t } = useTranslation('admin')
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('')

  return (
    <figure
      aria-label={t('brand.preview')}
      style={tenantThemeStyle({ ...draft, hasLogo })}
      className="overflow-hidden rounded-card border border-border bg-bg text-ink"
    >
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        {hasLogo ? (
          <img
            src={`/api/public/tenants/${encodeURIComponent(slug)}/logo?v=${version}`}
            alt=""
            className="size-10 rounded-pill border border-border-strong object-cover"
          />
        ) : (
          <span className="flex size-10 items-center justify-center rounded-pill border border-border-strong bg-surface text-sm font-semibold text-muted">
            {initials}
          </span>
        )}
        <span className="truncate font-tenant-heading text-2xl leading-tight">{name}</span>
      </div>
      <div className="flex flex-col gap-4 p-5">
        <h3 className="font-tenant-heading text-4xl leading-none">{t('brand.previewHero')}</h3>
        <div className="flex items-center justify-between rounded-card border border-border bg-surface p-4">
          <div className="flex flex-col">
            <span className="font-semibold">{t('brand.previewService')}</span>
            <span className="text-sm text-muted">30 min</span>
          </div>
          <span className="font-semibold text-primary-text">25 €</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {['09:00', '09:30', '10:00'].map((time, index) => (
            <span
              key={time}
              className={`flex min-h-11 items-center justify-center rounded-control border font-semibold ${index === 1 ? 'border-primary bg-primary text-primary-fg' : 'border-border-strong bg-surface'}`}
            >
              {time}
            </span>
          ))}
        </div>
        <span className="flex min-h-12 items-center justify-center rounded-control bg-primary font-semibold text-primary-fg">
          {t('brand.previewBook')}
        </span>
      </div>
    </figure>
  )
}

function BrandEditor({
  brand,
  name,
  slug,
}: {
  brand: TenantBrandSettings
  name: string
  slug: string
}) {
  const { t } = useTranslation(['admin', 'common'])
  const save = useSaveTenantBrand()
  const [draft, setDraft] = useState<Draft>(() => toDraft(brand))
  // Cache-buster for the logo <img>: bumped after every upload.
  const [logoVersion, setLogoVersion] = useState(() => Date.now())
  const saved = toDraft(brand)
  const dirty =
    draft.primaryColor !== saved.primaryColor ||
    draft.ground !== saved.ground ||
    draft.headingFont !== saved.headingFont
  const ratio = primaryTextContrast(draft.primaryColor, draft.ground)
  const ratioText = ratio.toFixed(1).replace('.', ',')

  const onSave = async () => {
    try {
      await save.mutateAsync(draft)
      toast.success(t('saved'))
    } catch (error) {
      toast.error(adminErrorMessage(t, error))
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-start">
      <Panel title={t('brand.title')}>
        <ColorPicker
          value={draft.primaryColor}
          onChange={(primaryColor) => setDraft((d) => ({ ...d, primaryColor }))}
        />
        <p
          role="status"
          className={`rounded-control px-3 py-2 text-sm ${ratio >= 4.5 ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'}`}
        >
          {ratio >= 4.5
            ? t('brand.contrast.ok', { ratio: ratioText })
            : t('brand.contrast.low', { ratio: ratioText })}
        </p>
        <OptionGroup
          legend={t('brand.ground')}
          options={BRAND_GROUNDS}
          value={draft.ground}
          onChange={(ground) => setDraft((d) => ({ ...d, ground }))}
          renderLabel={(option) => t(`brand.grounds.${option}`)}
        />
        <OptionGroup
          legend={t('brand.font')}
          options={BRAND_FONTS}
          value={draft.headingFont}
          onChange={(headingFont) => setDraft((d) => ({ ...d, headingFont }))}
          renderLabel={(option) => (
            <span className="flex flex-col">
              <span className={`text-2xl leading-tight ${fontClass[option]}`}>Aa</span>
              <span className="text-xs">{t(`brand.fonts.${option}`)}</span>
            </span>
          )}
        />
        <LogoField
          slug={slug}
          hasLogo={brand.hasLogo}
          version={logoVersion}
          onChanged={() => setLogoVersion(Date.now())}
        />
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4">
          {dirty && <Badge tone="warning">{t('brand.unsaved')}</Badge>}
          <Button onClick={() => void onSave()} loading={save.isPending} disabled={!dirty}>
            {t('actions.saveChanges')}
          </Button>
        </div>
      </Panel>
      <div className="flex flex-col gap-2 lg:sticky lg:top-6">
        <h2 className="text-sm font-semibold text-muted">{t('brand.preview')}</h2>
        <BrandPreview
          draft={draft}
          name={name}
          slug={slug}
          hasLogo={brand.hasLogo}
          version={logoVersion}
        />
      </div>
    </div>
  )
}

export default function BrandPage() {
  const { t } = useTranslation('admin')
  const { membership } = useActiveMembership()
  const brand = useTenantBrand()
  const settings = useTenantSettings()

  return (
    <section className="flex flex-col gap-6">
      <AdminPageHeader title={t('brand.title')} lead={t('brand.lead')} />
      <QueryState isPending={brand.isPending} error={brand.error}>
        {brand.data && membership && (
          <BrandEditor
            brand={brand.data}
            name={settings.data?.name ?? membership.tenantName}
            slug={membership.tenantSlug}
          />
        )}
      </QueryState>
    </section>
  )
}
