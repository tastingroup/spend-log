import { useEffect, useState } from 'react'
import { addPhoto, savePurchase, shrinkImage } from '../db'
import { getRate } from '../fx'
import { CURRENCIES, isChallengeMonth, parseNum, today, uid, won } from '../lib'
import { useSettings } from '../settings'

// 계산대 앞에서 10초 안에 끝내는 입력: 금액 · 통화 · 카테고리 · (사진)
// 긴축 챌린지 달에는 생활비 카테고리도 함께 고를 수 있다
export function QuickAdd({ onClose, onEdit }: { onClose: () => void; onEdit: (id: string) => void }) {
  const settings = useSettings()
  const { categories, defaultCurrency, lifeCategories } = settings
  const [amountStr, setAmountStr] = useState('')
  const [currency, setCurrency] = useState(defaultCurrency)
  const date = today()
  const challenge = isChallengeMonth(date, settings)
  const [category, setCategory] = useState((challenge ? lifeCategories[0] : categories[0]?.name) ?? '기타')
  const [memo, setMemo] = useState('')
  // 쇼핑 카테고리와 이름이 겹치면 쇼핑 기록으로 본다
  const isLife = challenge && lifeCategories.includes(category) && !categories.some((c) => c.name === category)
  const [photos, setPhotos] = useState<Blob[]>([])
  const [rate, setRate] = useState<number | null>(currency === 'KRW' ? 1 : null)
  const [saving, setSaving] = useState(false)
  const amount = parseNum(amountStr)

  useEffect(() => {
    let live = true
    setRate(currency === 'KRW' ? 1 : null)
    getRate(currency, date).then((r) => live && setRate(r))
    return () => {
      live = false
    }
  }, [currency, date])

  async function save(openDetail: boolean) {
    if (!amount || saving) return
    setSaving(true)
    const id = uid()
    const r = rate ?? (await getRate(currency, date)) ?? 0
    await savePurchase({
      id,
      date,
      kind: isLife ? '생활' : '쇼핑',
      category,
      name: '',
      brand: '',
      place: '',
      channel: '',
      region: '',
      currency,
      amount,
      rate: r,
      krw: Math.round(amount * r),
      listPrice: null,
      qty: 1,
      target: '나',
      recipient: '',
      memo: memo.trim(),
      updatedAt: 0,
      deleted: 0,
      dirty: 1,
    })
    for (const blob of photos) await addPhoto(id, blob)
    onClose()
    if (openDetail) onEdit(id)
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end bg-black/40" onClick={onClose}>
      <div
        className="mx-auto w-full max-w-md space-y-4 rounded-t-3xl bg-stone-50 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">빠른 기록</h2>
          <button onClick={onClose} className="px-2 text-2xl text-stone-400" aria-label="닫기">
            ×
          </button>
        </div>

        <div>
          <div className="flex gap-2">
            <input
              autoFocus
              inputMode="decimal"
              placeholder="금액"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value.replace(/[^\d.,]/g, ''))}
              className="field flex-1 text-right text-3xl font-bold tabular-nums"
            />
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="field w-24 font-semibold" aria-label="통화">
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          {currency !== 'KRW' && (
            <p className="mt-1 text-right text-sm text-stone-500">
              {rate
                ? `≈ ${won(amount * rate)} (1 ${currency} = ${rate.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}원)`
                : '환율을 가져오지 못했어요. 온라인이 되면 자동으로 채워집니다.'}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {challenge &&
            lifeCategories.map((name) => (
              <button key={name} onClick={() => setCategory(name)} className={`chip ${category === name ? 'chip-on' : ''}`}>
                {name}
              </button>
            ))}
          {challenge && <span className="basis-full text-xs text-stone-500">쇼핑 (상세 기록)</span>}
          {categories.map((c) => (
            <button key={c.name} onClick={() => setCategory(c.name)} className={`chip ${category === c.name ? 'chip-on' : ''}`}>
              {c.name}
            </button>
          ))}
        </div>

        {challenge && <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="메모 (선택)" className="field" />}

        <label className="btn-ghost block cursor-pointer text-sm">
          📷 영수증·가격표·제품 사진 {photos.length > 0 && `(${photos.length}장)`}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) setPhotos([...photos, await shrinkImage(file)])
            }}
          />
        </label>

        <div className="flex gap-2">
          <button onClick={() => save(true)} disabled={!amount || saving} className="btn-ghost flex-1 disabled:text-stone-300">
            상세까지 입력
          </button>
          <button onClick={() => save(false)} disabled={!amount || saving} className="btn flex-1">
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
