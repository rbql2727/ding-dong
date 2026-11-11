import type { Visibility } from '../lib/types'
import { VISIBILITY_OPTIONS } from '../lib/visibility'

/** 공개 범위 고르기 (라디오 카드) */
export function VisibilityPicker({
  value,
  onChange,
  name,
  legend = '공개 범위',
  hint,
}: {
  value: Visibility
  onChange: (v: Visibility) => void
  name: string
  legend?: string
  hint?: string
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-gray-700">{legend}</legend>
      <div className="space-y-2">
        {VISIBILITY_OPTIONS.map((o) => {
          const checked = value === o.value
          return (
            <label
              key={o.value}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                checked ? 'border-(--wiki) bg-gray-50' : 'border-gray-200'
              }`}
            >
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={checked}
                onChange={() => onChange(o.value)}
                className="mt-0.5 size-5 shrink-0 accent-(--wiki)"
              />
              <span>
                <span className="block font-semibold text-gray-900">{o.label}</span>
                <span className="block text-sm text-gray-500">{o.description}</span>
              </span>
            </label>
          )
        })}
      </div>
      {hint && <p className="mt-2 text-xs text-gray-400">{hint}</p>}
    </fieldset>
  )
}
