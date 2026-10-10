import { redirect } from "next/navigation";
import { getUserId } from "@/lib/dal";
import { LoginForm } from "./login-form";

function linkError(code: string | undefined): string | null {
  if (!code) return null;
  if (code === "otp_expired" || code === "access_denied") {
    return "That sign-in link has expired or was already used. Request a new one below.";
  }
  if (code === "exchange_failed") {
    return "That link was opened in a different browser from the one that asked for it (another device, profile or a private window). Request a new one below and open it in this browser.";
  }
  return "That sign-in link did not work. Request a new one below.";
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getUserId()) redirect("/today");
  const { error } = await searchParams;
  const message = linkError(Array.isArray(error) ? error[0] : error);
  return (
    <main className="mx-auto flex min-h-full w-full max-w-sm flex-col justify-center gap-6 px-4 py-16">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Diana</h1>
        <p className="text-sm text-muted">Your personal operating system.</p>
      </div>
      {message && (
        <p role="alert" className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-danger">
          {message}
        </p>
      )}
      <LoginForm />
    </main>
  );
}
