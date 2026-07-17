import { EmptyState } from "./empty-state";

// Rendered when the logged-in parent has no children linked yet (the family
// seed SQL hasn't run for this account). Never falls back to demo data.
export function NoKidsState() {
  return (
    <div className="pt-8">
      <EmptyState
        emoji="👶"
        title="No children linked to this account yet"
        body="Run the family seed script (scripts/pivot/04-family-seed.sql) with this account's user ID to link the kids."
      />
    </div>
  );
}
