import type { ProposalView, RadarState, TaskView } from '@radar/ui'

export function getRadarViewModel(state: RadarState) {
  const tasks = Object.values(state.tasks)
  const members = Object.values(state.members)
  const pending = Object.values(state.proposals).filter(
    (proposal): proposal is ProposalView => proposal.status === 'menunggu'
  )
  const review = tasks.filter((task): task is TaskView => task.status === 'review')
  // Submitted, but the PM's Bob has not proposed a review yet: nothing to approve until it does.
  const awaitingReview = review.filter(
    (task) => !pending.some((proposal) => proposal.kind === 'review' && proposal.refId === task.id)
  )
  return {
    tasks: {
      draft: tasks.filter((task): task is TaskView => task.status === 'terbuka' || task.status === 'draf'),
      working: tasks.filter((task): task is TaskView => task.status === 'dikerjakan'),
      review,
      done: tasks.filter((task): task is TaskView => task.status === 'selesai')
    },
    pending,
    awaitingReview,
    needsYou: pending.length + awaitingReview.length,
    online: members.filter((member) => member.online).length
  }
}
