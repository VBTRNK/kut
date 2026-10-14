"use client";

import { Field } from "@/components/ui/form";
import { Button } from "@/components/ui/button";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInErrorMessage } from "@/lib/auth/sign-in-error";
import { loginIdentifierToEmail } from "@/lib/auth/username";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function signIn(formData: FormData) {
    setErrorMessage(null);
    setIsSubmitting(true);

    const identifier = String(formData.get("identifier") ?? "");
    const password = String(formData.get("password") ?? "");
    const { error } = await createClient().auth.signInWithPassword({
      email: loginIdentifierToEmail(identifier),
      password,
    });

    if (error) {
      setErrorMessage(signInErrorMessage(error));
      setIsSubmitting(false);
      return;
    }

    // Everyone lands on Home, admins included (KB-011). Home is the page built
    // to answer "what changed since I was last here" — the week's risers, club
    // activity, coins, Club Value, rank and the current Chronicle issue. This
    // used to be a hardcoded "/admin/attendance" for every member, which
    // requireAdmin() then bounced non-admins away from.
    router.replace("/");
    router.refresh();
  }

  return (
    <form action={signIn} className="space-y-5">
      <Field
        label="Username"
        autoCapitalize="none"
        autoComplete="username"
        name="identifier"
        required
        spellCheck={false}
        help="Or the email address you joined with."
      />
      <Field
        label="Password"
        autoComplete="current-password"
        minLength={8}
        name="password"
        required
        type="password"
      />
      {errorMessage && (
        <p className="rounded-xl border border-brick-line/40 bg-brick-bg p-3 text-small font-semibold text-brick">
          {errorMessage}
        </p>
      )}
      <Button wide disabled={isSubmitting} type="submit">
        {isSubmitting ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
