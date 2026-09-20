"use client";

import Link from "next/link";
import { FormEvent, Suspense, useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import GoogleSignIn from "@/components/google-sign-in";
import { useAuth } from "@/components/auth-provider";
import { AuthShell, Divider, Field } from "@/components/auth-shell";

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const { refresh } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [message, setMessage] = useState(
    search.get("registered") ? "Account created. Log in to continue." : ""
  );
  const [pending, setPending] = useState(false);

  const finish = useCallback(async () => {
    await refresh();
    const nextUrl = search.get("next") || "/editor";
    router.push(nextUrl);
    router.refresh();
  }, [refresh, router, search]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await response.json();
    setPending(false);

    if (!response.ok) {
      return setMessage(data.message);
    }

    await finish();
  }

  return (
    <>
      <form onSubmit={submit} className="space-y-4">
        <Field
          label="Email address"
          type="email"
          value={form.email}
          onChange={(value) => setForm({ ...form, email: value })}
        />
        <Field
          label="Password"
          type="password"
          value={form.password}
          onChange={(value) => setForm({ ...form, password: value })}
        />
        {message && (
          <p className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
            {message}
          </p>
        )}
        <button
          disabled={pending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-blue-500 to-purple-600 px-4 py-3 font-medium shadow-lg shadow-blue-500/20 transition hover:to-purple-700 disabled:opacity-60"
        >
          {pending ? (
            "Logging in..."
          ) : (
            <>
              <span>Log in</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>
      <Divider />
      <GoogleSignIn onSuccess={finish} onError={setMessage} />
    </>
  );
}

export default function LoginPage() {
  return (
    <AuthShell title="Welcome back" subtitle="Log in to continue building with AI.">
      <Suspense
        fallback={
          <div className="flex justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
          </div>
        }
      >
        <LoginForm />
      </Suspense>
      <p className="mt-7 text-center text-sm text-slate-400">
        No account?{" "}
        <Link href="/signup" className="font-medium text-indigo-300 hover:text-white">
          Register first
        </Link>
      </p>
    </AuthShell>
  );
}
