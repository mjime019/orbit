// Demo/seed rows (the demo school, its teachers, the demo parents and their
// kid Johnny) all carry fixed ids in the all-zero namespace. A real
// parent's profile id is their Supabase Auth user id, which is random.
// The channels that reach outside the app (the digest email and
// reply-by-email) deal only with real parents, and through them only with
// real kids.
const SEED_ID_PREFIX = "00000000-0000-0000-0000-";

export function isSeedProfileId(id: string): boolean {
  return id.toLowerCase().startsWith(SEED_ID_PREFIX);
}
