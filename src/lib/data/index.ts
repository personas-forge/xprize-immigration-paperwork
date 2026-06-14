/**
 * Data layer — public surface.
 *
 * Import from `@/lib/data` rather than reaching into feature mock files. The
 * whole point of this boundary is swappability: today these are in-memory
 * fixtures; replacing them with a database or API client should not touch a
 * single consumer.
 */
export {
  getCases,
  getCaseById,
  getCriteria,
  getCaseFacts,
  getOutstandingTasks,
  getPetitionExcerpt,
} from "./cases";
export { getForms, getFormById } from "./forms";
