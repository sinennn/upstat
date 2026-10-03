/**
 * The models layer's network seam. Every app surface reads the Go backend
 * (`api/common`) through these; the only other network read is the public
 * GitHub star count on the marketing page.
 */
export {
  accountRepo,
  authRepo,
  incidentsRepo,
  monitorsRepo,
  statusRepo,
} from "./grpc/repos";
export * from "./github";
