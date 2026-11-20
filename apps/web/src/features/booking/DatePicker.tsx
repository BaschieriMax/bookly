import { DayPicker, type Matcher } from 'react-day-picker'
import { it } from 'react-day-picker/locale'

interface DatePickerProps {
  selected: Date | undefined
  onSelect: (date: Date) => void
  month: Date
  onMonthChange: (month: Date) => void
  startMonth: Date
  endMonth: Date
  disabled: Matcher[]
}

/**
 * Accessible month calendar (react-day-picker, the library behind shadcn/ui's Calendar),
 * styled with the design tokens instead of shadcn's theme variables (DEC-024).
 */
export function DatePicker({
  selected,
  onSelect,
  month,
  onMonthChange,
  startMonth,
  endMonth,
  disabled,
}: DatePickerProps) {
  return (
    <DayPicker
      mode="single"
      required
      locale={it}
      weekStartsOn={1}
      selected={selected}
      onSelect={onSelect}
      month={month}
      onMonthChange={onMonthChange}
      startMonth={startMonth}
      endMonth={endMonth}
      disabled={disabled}
      showOutsideDays={false}
      classNames={{
        root: 'w-full',
        months: 'relative',
        month: 'flex flex-col gap-3',
        month_caption: 'flex h-11 items-center px-1',
        caption_label: 'font-semibold capitalize',
        nav: 'absolute top-0 right-0 flex gap-1',
        button_previous:
          'flex size-11 items-center justify-center rounded-control hover:bg-subtle disabled:opacity-30 [&_svg]:fill-current',
        button_next:
          'flex size-11 items-center justify-center rounded-control hover:bg-subtle disabled:opacity-30 [&_svg]:fill-current',
        // Fixed layout: seven equal columns that shrink with the screen.
        month_grid: 'w-full table-fixed border-collapse',
        weekdays: 'text-xs text-muted',
        weekday: 'pb-1 font-medium capitalize',
        week: '',
        day: 'p-0 text-center',
        // 44 px where it fits; on a 320 px phone seven columns leave 40 px per day.
        day_button:
          'mx-auto flex aspect-square w-full max-w-11 items-center justify-center rounded-control text-[15px] font-semibold hover:bg-subtle disabled:cursor-not-allowed disabled:font-normal disabled:text-muted disabled:line-through disabled:opacity-50 disabled:hover:bg-transparent',
        selected:
          '[&>button]:bg-primary [&>button]:text-primary-fg [&>button]:hover:bg-primary-hover',
        today: '[&>button]:underline [&>button]:underline-offset-4',
        disabled: '',
        outside: 'invisible',
      }}
    />
  )
}
