import Link from "next/link";
import { Sparkles } from "lucide-react";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0f0f1a] px-4 py-16">
      <div className="absolute -left-36 top-0 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl" />
      <div className="absolute -right-36 bottom-0 h-96 w-96 rounded-full bg-purple-600/20 blur-3xl" />
      <section className="relative w-full max-w-md rounded-2xl border border-white/10 bg-slate-950/70 p-7 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-9">
        <Link href="/" className="mb-8 flex items-center gap-2 text-sm font-semibold text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-blue-500 to-purple-600">
            <Sparkles className="h-4 w-4" />
          </span>
          Codatron
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-white">{title}</h1>
        <p className="mb-7 mt-2 text-slate-400">{subtitle}</p>
        {children}
      </section>
    </main>
  );
}

export function Field({ label, type, value, onChange }: { label: string; type: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-200">{label}</span>
      <input required minLength={type === "password" ? 8 : undefined} type={type} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-white/10 bg-white/4 px-3.5 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20" />
    </label>
  );
}

export function Divider() {
  return (
    <div className="my-6 flex items-center gap-3 text-xs text-slate-500">
      <span className="h-px flex-1 bg-white/10" />
      OR
      <span className="h-px flex-1 bg-white/10" />
    </div>
  );
}
