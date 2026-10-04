"use client";

import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { navItems } from "./nav";

/** ⌘K / Ctrl+K. Navigation only for now; capture and search arrive in Slices 1 and 5. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command palette"
      overlayClassName="fixed inset-0 bg-black/30"
      contentClassName="fixed left-1/2 top-[20vh] w-[min(560px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-lg border border-line bg-surface shadow-xl"
    >
      <Command.Input placeholder="Type a command…" className="w-full border-b border-line bg-transparent px-4 py-3 text-sm outline-none" />
      <Command.List className="max-h-80 overflow-y-auto p-2">
        <Command.Empty className="px-3 py-6 text-center text-sm text-muted">No results.</Command.Empty>
        <Command.Group heading="Go to" className="text-xs text-muted [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Command.Item
              key={href}
              value={label}
              onSelect={() => go(href)}
              className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-fg data-[selected=true]:bg-surface-strong"
            >
              <Icon aria-hidden size={16} />
              {label}
            </Command.Item>
          ))}
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
