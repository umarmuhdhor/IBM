// Query-string schemas that only the server reads.
import { z } from 'zod';

const EventId = z.coerce.number().int().nonnegative();

/** `?from=&to=&limit=` for the event export (R3 §2.23). `limit` is capped at 1000 by the export service. */
export const ExportQuery = z.object({
  from: EventId.optional(),
  to: EventId.optional(),
  limit: z.coerce.number().int().min(1).optional(),
});

/** `?path=&limit=` for the file history (R3 §2.22). */
export const HistoryQuery = z.object({
  path: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(20).optional(),
});

/** `?from=&to=` event ids for the session report (R3 §2.17), same meaning as the export. */
export const ReportQuery = z.object({
  from: EventId.optional(),
  to: EventId.optional(),
});
