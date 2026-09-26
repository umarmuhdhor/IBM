// Query-string schemas that only the server reads.
import { z } from 'zod';

const EventId = z.coerce.number().int().nonnegative();

/** `?from=&to=&limit=` for the event export (R3 §2.23). `limit` is capped at 1000 by the export service. */
export const ExportQuery = z.object({
  from: EventId.optional(),
  to: EventId.optional(),
  limit: z.coerce.number().int().min(1).optional(),
});
