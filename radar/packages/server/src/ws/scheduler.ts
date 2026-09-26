// The DO's single alarm (fase 03 step 11, R4 §7). Each provider reports its next deadline (hello timeouts now,
// the 30 s lock job in fase 05); the alarm is set to the earliest one and removed when there is none, so an
// idle DO can hibernate. `setAlarm` costs a row written, so an unchanged or later deadline is not set again: an
// alarm that fires early is harmless (handlers are idempotent) and the alarm handler reschedules.
export type DeadlineProvider = () => number | null;

export class AlarmScheduler {
  constructor(
    private readonly storage: DurableObjectStorage,
    private readonly providers: readonly DeadlineProvider[],
  ) {}

  nextDeadline(): number | null {
    let next: number | null = null;
    for (const p of this.providers) {
      const d = p();
      if (d !== null && (next === null || d < next)) next = d;
    }
    return next;
  }

  async reschedule(): Promise<void> {
    const next = this.nextDeadline();
    const current = await this.storage.getAlarm();
    if (next === null) {
      if (current !== null) await this.storage.deleteAlarm();
      return;
    }
    if (current === null || next < current) await this.storage.setAlarm(next);
  }
}
