"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "./nav";

export function Sidebar() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
              active ? "bg-surface-strong font-medium" : "text-muted hover:bg-surface-strong hover:text-fg"
            }`}
          >
            <Icon aria-hidden size={16} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
