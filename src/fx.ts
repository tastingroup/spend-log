// 1 통화 = ? 원. 구매일 환율(frankfurter) → 최신 환율(er-api) → 마지막으로 받아 둔 환율 순으로 시도
const cacheGet = (k: string): number | null => {
  try {
    const v = Number(localStorage.getItem(k))
    return v > 0 ? v : null
  } catch {
    return null
  }
}
const cacheSet = (k: string, v: number) => {
  try {
    localStorage.setItem(k, String(v))
  } catch {
    // 캐시 실패는 무시
  }
}

async function fetchJson(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(4000) })
  if (!res.ok) throw new Error(String(res.status))
  return res.json()
}

export async function getRate(currency: string, date: string): Promise<number | null> {
  if (currency === 'KRW') return 1
  const dayKey = `fx:${currency}:${date}`
  const lastKey = `fx:${currency}:last`
  const cached = cacheGet(dayKey)
  if (cached) return cached

  let rate: number | null = null
  try {
    const d = await fetchJson(`https://api.frankfurter.dev/v1/${date}?base=${currency}&symbols=KRW`)
    rate = Number(d?.rates?.KRW) || null
    if (rate) cacheSet(dayKey, rate)
  } catch {
    // 지원하지 않는 통화이거나 오프라인
  }
  if (!rate) {
    try {
      const d = await fetchJson(`https://open.er-api.com/v6/latest/${currency}`)
      rate = Number(d?.rates?.KRW) || null
    } catch {
      // 오프라인
    }
  }
  if (rate) {
    cacheSet(lastKey, rate)
    return rate
  }
  return cacheGet(lastKey)
}
