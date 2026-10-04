import { redirect } from "next/navigation";
import { getUserId } from "@/lib/dal";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if (await getUserId()) redirect("/today");
  return (
    <main className="mx-auto flex min-h-full w-full max-w-sm flex-col justify-center gap-6 px-4 py-16">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Diana</h1>
        <p className="text-sm text-muted">Your personal operating system.</p>
      </div>
      <LoginForm />
    </main>
  );
}
