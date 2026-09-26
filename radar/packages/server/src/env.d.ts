// Secrets are set with `wrangler secret put` (production) or `.dev.vars` (local), so `wrangler types`
// cannot see them. Declared here so `env.ADMIN_SECRET` type-checks; both may be missing at runtime.
interface Env {
  ADMIN_SECRET?: string;
  GITHUB_TOKEN?: string;
}
