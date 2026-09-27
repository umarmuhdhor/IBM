import type { RadarState, TaskView } from '@radar/ui'
import { CoderTaskCard } from './CoderTaskCard'
import { PlanApprovalCard } from './PlanApprovalCard'
import { StepProgressBar, stepProgress, TaskStatusLabel } from './TaskStatusLabel'

type Props = {
  state: RadarState
  role: 'coder' | 'pm' | 'mc' | null
  /** The member this app works as: the coder, or the owner's own seat for Mission Control. */
  seatId: string | null
}

function ReadonlyTaskCard({ task }: { task: TaskView }) {
  const { checked, total } = stepProgress(task)
  return (
    <article aria-label={task.title} className="space-y-2 rounded-lg border border-border bg-card p-3">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h5 className="min-w-0 text-sm font-medium [overflow-wrap:anywhere]">
          <span className="mr-2 font-mono text-xs text-muted-foreground">{task.id}</span>
          {task.title}
        </h5>
        <TaskStatusLabel status={task.status} />
      </header>
      {task.files.length > 0 && (
        <p className="font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]">{task.files.join(', ')}</p>
      )}
      <StepProgressBar checked={checked} total={total} />
      {total > 0 && (
        <ul className="space-y-1">
          {task.steps.map((step, i) => (
            <li key={i} className="flex items-start gap-2 text-xs">
              <span aria-hidden="true" className="w-3 shrink-0 text-muted-foreground">{step.done ? '✓' : '○'}</span>
              <span className={step.done ? 'text-muted-foreground [overflow-wrap:anywhere]' : '[overflow-wrap:anywhere]'}>
                <span className="sr-only">{step.done ? 'Done: ' : 'To do: '}</span>
                {step.text}
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="space-y-0.5">
      <h3 className="text-sm font-semibold">{title}</h3>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function TaskBoardView({ state, role, seatId }: Props) {
  const tasks = Object.values(state.tasks).filter((task) => task.status !== 'batal')
  const pm = Object.values(state.members).find((member) => member.role === 'pm')
  const plans = Object.values(state.proposals).filter((p) => p.kind === 'plan' && p.status === 'menunggu')
  const decides = role === 'pm' || (role === 'mc' && !pm)
  const readOnlyNote = decides ? null : pm ? `Waiting for ${pm.name} (PM) to approve.` : 'The owner approves plans in Mission Control.'
  const mine = seatId ? tasks.filter((task) => task.ownerId === seatId) : []
  const showMine = role === 'coder' || (role === 'mc' && seatId !== null)
  const showTeam = role === 'pm' || role === 'mc'
  const coders = Object.values(state.members).filter((member) => member.role === 'coder')

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-4">
      {plans.length > 0 && (
        <section aria-label="Plans to approve" className="space-y-3">
          <SectionHeading
            title={decides ? `Plans to approve · ${plans.length}` : `Plans waiting · ${plans.length}`}
            hint={decides ? 'Your Bob (PM Lead) split the work. Approve to hand each task to its coder.' : undefined}
          />
          {plans.map((proposal) => (
            <PlanApprovalCard key={proposal.id} proposal={proposal} state={state} readOnlyNote={readOnlyNote} />
          ))}
        </section>
      )}

      {showMine && (
        <section aria-label="My tasks" className="space-y-3">
          <SectionHeading
            title="My tasks"
            hint="Start in Bob opens IBM Bob IDE and copies a prompt. Pick the Live Collab Coder mode and paste it; Bob works through the steps and ticks them. You can tick steps here too."
          />
          {mine.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
              No tasks for you yet. The PM splits the work in Bob (PM Lead mode); once it is approved, your tasks appear here.
            </p>
          ) : (
            mine.map((task) => <CoderTaskCard key={task.id} task={task} />)
          )}
        </section>
      )}

      {showTeam && (
        <section aria-label="Team progress" className="space-y-4">
          <SectionHeading title="Team progress" hint="Updates live as coders tick their steps." />
          {tasks.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
              No tasks yet. Put the brief in the project folder (.md), then ask Bob in PM Lead mode: “@brief.md split this for the coders with propose_plan”.
            </p>
          ) : (
            coders.map((coder) => {
              const own = tasks.filter((task) => task.ownerId === coder.id)
              if (own.length === 0) {
                return null
              }
              const total = own.reduce((sum, task) => sum + task.steps.length, 0)
              const done = own.reduce((sum, task) => sum + task.steps.filter((step) => step.done).length, 0)
              return (
                <div key={coder.id} className="space-y-2">
                  <h4 className="flex items-baseline justify-between text-xs font-semibold">
                    <span>{coder.name}</span>
                    {total > 0 && <span className="font-normal text-muted-foreground tabular-nums">{done}/{total} steps</span>}
                  </h4>
                  {own.map((task) => <ReadonlyTaskCard key={task.id} task={task} />)}
                </div>
              )
            })
          )}
        </section>
      )}
    </div>
  )
}
