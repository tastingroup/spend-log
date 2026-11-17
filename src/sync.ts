import { db } from './db'
import { getSettings, setSettings } from './settings'
import type { Purchase } from './types'

// 시트·가져오기 파일에서 온 행은 타입이 섞여 있으므로 정규화한다
export function normalize(r: Record<string, unknown>): Purchase {
  const s = (k: string) => (r[k] == null ? '' : String(r[k]))
  const n = (k: string) => Number(r[k]) || 0
  return {
    id: s('id'),
    date: s('date').slice(0, 10),
    kind: s('kind') === '생활' ? '생활' : '쇼핑',
    category: s('category'),
    name: s('name'),
    brand: s('brand'),
    place: s('place'),
    channel: s('channel') as Purchase['channel'],
    region: s('region'),
    currency: s('currency') || 'KRW',
    amount: n('amount'),
    rate: n('rate'),
    krw: n('krw'),
    listPrice: n('listPrice') || null,
    qty: n('qty') || 1,
    target: (s('target') || '나') as Purchase['target'],
    recipient: s('recipient'),
    memo: s('memo'),
    updatedAt: n('updatedAt'),
    deleted: n('deleted') ? 1 : 0,
    dirty: 0,
  }
}

let running: Promise<void> | null = null

// 변경분을 시트에 올리고, 시트 전체를 받아 최신 수정 기준으로 합친다
export function syncNow(): Promise<void> {
  running ??= doSync().finally(() => (running = null))
  return running
}

async function doSync() {
  const { syncUrl, syncToken } = getSettings()
  if (!syncUrl) throw new Error('동기화 주소가 설정되지 않았습니다')

  const dirty = await db.purchases.where('dirty').equals(1).toArray()
  const res = await fetch(syncUrl, {
    method: 'POST',
    // text/plain이어야 Apps Script가 CORS 사전 요청 없이 받는다
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ token: syncToken, rows: dirty.map(({ dirty: _d, ...row }) => row) }),
  })
  if (!res.ok) throw new Error(`시트 응답 오류 (${res.status})`)
  const data = await res.json()
  if (!data.ok) throw new Error(data.error === 'unauthorized' ? '토큰이 일치하지 않습니다' : String(data.error))

  await db.transaction('rw', db.purchases, db.photos, async () => {
    for (const row of dirty) {
      const now = await db.purchases.get(row.id)
      if (now && now.updatedAt === row.updatedAt) await db.purchases.update(row.id, { dirty: 0 })
    }
    for (const raw of data.rows as Record<string, unknown>[]) {
      const remote = normalize(raw)
      if (!remote.id) continue
      const local = await db.purchases.get(remote.id)
      if (local && local.updatedAt >= remote.updatedAt) continue
      await db.purchases.put(remote)
      if (remote.deleted) await db.photos.where('purchaseId').equals(remote.id).delete()
    }
  })
  setSettings({ lastSync: Date.now() })
}

// 저장 직후·앱 시작 시 조용히 시도. 실패하면 다음 기회에 다시 올라간다
export function autoSync() {
  if (getSettings().syncUrl && navigator.onLine) syncNow().catch(() => {})
}
