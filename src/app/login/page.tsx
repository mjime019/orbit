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
            <span className="w-3 h-3 rounded-full bg-rust inline-block" />
            <span className="font-[family-name:var(--font-playfair)] text-2xl font-semibold tracking-wide text-espresso">
              ORBIT
            </span>
          </div>
          <p className="text-sm text-warm-gray">The boys&apos; story, kept safe.</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
