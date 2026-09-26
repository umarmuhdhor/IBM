import type { ProposalView, RadarState, TaskView } from '@radar/ui'

export function getRadarViewModel(state: RadarState) {
  const tasks = Object.values(state.tasks)
  const members = Object.values(state.members)
  const pending = Object.values(state.proposals).filter(
    (proposal): proposal is ProposalView => proposal.status === 'menunggu'
  )
  return {
    tasks: {
      draft: tasks.filter((task): task is TaskView => task.status === 'terbuka' || task.status === 'draf'),
      working: tasks.filter((task): task is TaskView => task.status === 'dikerjakan'),
      review: tasks.filter((task): task is TaskView => task.status === 'review'),
      done: tasks.filter((task): task is TaskView => task.status === 'selesai')
    },
    pending,
    needsYou: pending.length,
    online: members.filter((member) => member.online).length
  }
}
