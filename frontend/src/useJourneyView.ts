import { useMemo, useState } from 'react'
import { sortJourneys, type Journey, type SortKey } from './pipeline'

/** How a row draws its journey: across the stages, or along the calendar. */
export type TrackMode = 'stages' | 'dates'

/** The board's filter, sort and track state, and the journeys it leaves visible. */
export function useJourneyView(journeys: Journey[]) {
  const [stage, setStage] = useState<string | null>(null)
  const [sort, setSort] = useState<SortKey>('stage')
  const [showClosed, setShowClosed] = useState(false)
  const [mode, setMode] = useState<TrackMode>('stages')
  const visible = useMemo(
    () => sortJourneys(journeys.filter((journey) => (showClosed || !journey.closed) && (!stage || journey.application.stage === stage)), sort),
    [journeys, showClosed, stage, sort],
  )
  return { stage, setStage, sort, setSort, showClosed, setShowClosed, mode, setMode, visible }
}

export type JourneyView = ReturnType<typeof useJourneyView>
