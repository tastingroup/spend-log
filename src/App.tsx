import { useEffect, useState } from 'react'
import { fillMissingRates, usePurchases } from './db'
import { autoSync } from './sync'
import { Home } from './components/Home'
import { ListView } from './components/ListView'
import { SettingsView } from './components/SettingsView'
import { QuickAdd } from './components/QuickAdd'
import { EditForm } from './components/EditForm'

type Tab = 'home' | 'list' | 'settings'
const TABS: [Tab, string][] = [
  ['home', '홈'],
  ['list', '찾아보기'],
  ['settings', '설정'],
]

export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [editId, setEditId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const purchases = usePurchases()

  useEffect(() => {
    const run = () => fillMissingRates().then(autoSync)
    run()
    window.addEventListener('online', run)
    return () => window.removeEventListener('online', run)
  }, [])

  return (
    <div className="mx-auto min-h-dvh max-w-md pb-28">
      {tab === 'home' && <Home purchases={purchases} onOpen={setEditId} />}
      {tab === 'list' && <ListView purchases={purchases} onOpen={setEditId} />}
      {tab === 'settings' && <SettingsView purchases={purchases} />}

      <button
        onClick={() => setAdding(true)}
        aria-label="구매 기록 추가"
        className="fixed right-[max(1.25rem,calc(50%-13rem))] bottom-20 z-20 h-16 w-16 rounded-full bg-amber-500 text-4xl leading-none font-light text-white shadow-lg active:bg-amber-600"
      >
        +
      </button>

      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-md">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 py-4 text-sm ${tab === key ? 'font-bold text-stone-900' : 'text-stone-400'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      {adding && <QuickAdd onClose={() => setAdding(false)} onEdit={setEditId} />}
      {editId && <EditForm key={editId} id={editId} purchases={purchases} onClose={() => setEditId(null)} />}
    </div>
  )
}
