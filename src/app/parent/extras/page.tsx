export const dynamic = "force-dynamic";

import Link from "next/link";
import {
  getChildWithProfile,
  getExtracurricularProviders,
} from "@/lib/queries";
import { ProviderList } from "./provider-list";

export default async function ExtrasPage() {
  const { child, profile } = await getChildWithProfile();

  if (!child) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 shadow-sm text-center max-w-md">
          <p className="text-espresso text-lg font-semibold mb-2">
            Supabase not configured
          </p>
          <p className="text-warm-gray text-sm">
            Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in
            your .env.local file.
          </p>
        </div>
      </div>
    );
  }

  const providers = await getExtracurricularProviders(
    child.school_id ?? undefined
  );

  return (
    <div className="min-h-screen bg-cream">
      <div className="mx-auto max-w-[640px] px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/parent"
            className="text-warm-gray hover:text-espresso transition-colors text-lg"
          >
            {"\u2190"}
          </Link>
          <div>
            <h1 className="font-[family-name:var(--font-playfair)] text-2xl font-bold text-espresso">
              {"\u2B50"} Extracurriculars
            </h1>
            <p className="text-warm-gray text-sm mt-0.5">
              Curated programs for {child.name}
            </p>
          </div>
        </div>

        <ProviderList
          providers={providers}
          childName={child.name}
          interests={profile?.interests ?? []}
        />
      </div>
    </div>
  );
}
