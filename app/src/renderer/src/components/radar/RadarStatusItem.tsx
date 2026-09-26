import { useRadarStore } from '@/store/radar-store'
import { getRadarViewModel } from './radar-view-model'

export function RadarStatusItem() {
  const state = useRadarStore((store) => store.state)
  const connected = useRadarStore((store) => store.connected)
  const model = state ? getRadarViewModel(state) : null
  return <span aria-label="Live Collab status" className="whitespace-nowrap text-[11px] text-muted-foreground"><span className={connected ? 'text-[var(--lc-ok)]' : 'text-destructive'}>●</span> Live Collab{model ? ` · ${model.online} online · ${model.needsYou} needs you` : connected ? ' · connected' : ' · offline'}</span>
}
