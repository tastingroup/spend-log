import Dexie, { type EntityTable } from 'dexie'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Photo, Purchase } from './types'
import { getRate } from './fx'
import { uid } from './lib'
import { autoSync, normalize } from './sync'

export const db = new Dexie('spend-log') as Dexie & {
  purchases: EntityTable<Purchase, 'id'>
  photos: EntityTable<Photo, 'id'>
}

db.version(1).stores({
  purchases: 'id, date, category, dirty',
  photos: 'id, purchaseId',
})
// v2: 생활비 기록 도입. 기존 기록은 모두 쇼핑
db.version(2).stores({}).upgrade((tx) =>
  tx
    .table('purchases')
    .toCollection()
    .modify((p) => {
      p.kind ??= '쇼핑'
    }),
)

export async function savePurchase(p: Purchase) {
  await db.purchases.put({ ...p, updatedAt: Date.now(), dirty: 1 })
  autoSync()
}

export async function removePurchase(id: string) {
  await db.purchases.update(id, { deleted: 1, updatedAt: Date.now(), dirty: 1 })
  await db.photos.where('purchaseId').equals(id).delete()
  autoSync()
}

export async function addPhoto(purchaseId: string, blob: Blob) {
  await db.photos.add({ id: uid(), purchaseId, blob })
}

// 파일에서 읽은 기록을 넣는다. 같은 ID는 덮어쓰므로 다시 가져와도 중복되지 않는다
export async function importPurchases(rows: Record<string, unknown>[]) {
  const valid = rows.map(normalize).filter((p) => p.id && p.date)
  await db.purchases.bulkPut(valid.map((p) => ({ ...p, updatedAt: p.updatedAt || Date.now(), dirty: 1 as const })))
  autoSync()
  return valid.length
}

// 오프라인에서 기록해 환율이 비어 있는 외화 구매를 채운다
export async function fillMissingRates() {
  const missing = await db.purchases.filter((p) => !p.deleted && p.currency !== 'KRW' && !p.rate).toArray()
  for (const p of missing) {
    const rate = await getRate(p.currency, p.date)
    if (rate) await db.purchases.update(p.id, { rate, krw: Math.round(p.amount * rate), updatedAt: Date.now(), dirty: 1 })
  }
}

// 삭제되지 않은 기록, 최신순
export function usePurchases(): Purchase[] {
  return (
    useLiveQuery(async () => {
      const all = await db.purchases.filter((p) => !p.deleted).toArray()
      return all.sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt)
    }, []) ?? []
  )
}

export function usePhotos(purchaseId: string): Photo[] {
  return useLiveQuery(() => db.photos.where('purchaseId').equals(purchaseId).toArray(), [purchaseId]) ?? []
}

// 카메라 사진을 긴 변 1280px JPEG로 줄인다
export async function shrinkImage(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', 0.8))
}
