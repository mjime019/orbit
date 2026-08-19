import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (user) redirect("/parent");

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-6">
      <div className="w-full max-w-[360px] fade-up">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span
              className="w-4 h-4 rounded-full inline-block"
              style={{ background: "var(--gradient-orbit)" }}
            />
            <span className="font-[family-name:var(--font-display)] text-3xl font-medium text-espresso">
              orbit
            </span>
          </div>
          <p className="text-sm text-warm-gray">The boys&apos; story, kept safe.</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
