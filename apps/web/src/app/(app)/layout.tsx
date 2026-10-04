import { CommandPalette } from "@/components/command-palette";
import { Sidebar } from "@/components/sidebar";
import { requireUserId } from "@/lib/dal";
import { signOut } from "./actions";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  await requireUserId();
  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <aside className="flex flex-col gap-4 border-b border-line px-4 py-3 md:w-56 md:shrink-0 md:border-r md:border-b-0 md:py-6">
        <div className="flex items-center justify-between md:block">
          <span className="text-base font-semibold tracking-tight">Diana</span>
          <kbd className="hidden rounded border border-line px-1.5 py-0.5 text-xs text-muted md:mt-1 md:inline-block">
            Ctrl K
          </kbd>
        </div>
        <Sidebar />
        <form action={signOut} className="hidden md:mt-auto md:block">
          <button type="submit" className="text-sm text-muted hover:text-fg">
            Sign out
          </button>
        </form>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-10">{children}</main>
      <CommandPalette />
    </div>
  );
}
