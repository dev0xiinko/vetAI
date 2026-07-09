import { redirect } from "next/navigation";
import { PawPrint } from "lucide-react";
import { getSessionProfile } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await getSessionProfile();
  if (session) redirect("/");

  return (
    <div className="flex h-screen">
      {/* Brand panel */}
      <div className="relative hidden flex-1 flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-brand to-brand-dark p-12 text-white md:flex">
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-white/[0.06]" />
        <div className="absolute -bottom-20 -right-16 h-64 w-64 rounded-full bg-white/[0.05]" />
        <PawPrint size={60} className="relative" />
        <div className="relative mt-4 text-[34px] font-bold">VetiAssist AI</div>
        <div className="relative mt-1 text-[15px] opacity-85">
          Smart Veterinary Care
        </div>
      </div>

      {/* Form panel */}
      <div className="flex w-full flex-none flex-col justify-center bg-surface px-8 md:w-[480px] md:px-16">
        <div className="text-[26px] font-bold text-ink">Welcome Back!</div>
        <div className="mb-8 mt-1 text-sm text-muted-2">
          Please login to your account
        </div>
        <LoginForm />
        <div className="mt-6 text-center text-xs text-faint">
          Accounts are provisioned by a clinic administrator.
        </div>
      </div>
    </div>
  );
}
