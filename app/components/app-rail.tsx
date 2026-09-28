"use client";

/**
 * Side rail (archetype N3 from DESIGN.md).
 *
 * 248px on desktop, sticky and full height with a hairline right border. Under
 * 768px it becomes a fixed bottom bar: brand tag and footer hidden, links in a
 * row. The active route takes the accent soft background, aria-current, and the
 * accent fee color.
 *
 * Market data in Edgebook comes from the Nansen API. Powered by Nansen API.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/markets", label: "Markets", fee: "live" },
  { href: "/journal", label: "Journal", fee: "calls" },
  { href: "/profile", label: "Edge", fee: "edge" },
] as const;

const PRODUCT_LINE =
  "A call ledger for prediction markets, set as a cool instrument on a dark field.";

export default function AppRail() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Edgebook sections"
      className="fixed inset-x-0 bottom-0 z-30 flex items-stretch gap-1 border-t border-hairline bg-bg/95 px-3 py-2 md:sticky md:inset-x-auto md:top-0 md:bottom-auto md:h-screen md:w-[248px] md:flex-col md:self-start md:gap-1 md:overflow-y-auto md:border-t-0 md:border-r md:bg-bg/85 md:px-0 md:py-0"
    >
      <div className="hidden md:flex md:items-center md:gap-3 md:px-5 md:pt-7 md:pb-6">
        <svg
          viewBox="0 0 32 32"
          width="28"
          height="28"
          aria-hidden="true"
          className="flex-none"
        >
          <rect
            width="32"
            height="32"
            rx="7"
            fill="#151B24"
            stroke="#232B36"
            strokeWidth="1.5"
          />
          <circle
            cx="16"
            cy="16"
            r="10"
            fill="none"
            stroke="#232B36"
            strokeWidth="2.5"
          />
          <path
            d="M 16 6 A 10 10 0 0 1 26 16"
            fill="none"
            stroke="#7FD6E6"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="16" cy="16" r="2.5" fill="#7FD6E6" />
          <line
            x1="16"
            y1="16"
            x2="22"
            y2="10"
            stroke="#7FD6E6"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <p className="font-display text-2xl font-bold uppercase tracking-[0.02em] text-text">
          Edgebook<span className="text-accent">.</span>
        </p>
      </div>

      <ul className="flex w-full items-stretch gap-1 md:w-auto md:flex-col md:px-3">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <li key={item.href} className="min-w-0 flex-1 md:flex-none">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[44px] items-center justify-between gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${
                  active
                    ? "bg-accent-soft text-accent"
                    : "text-text-muted hover:bg-raised hover:text-text"
                }`}
              >
                <span className="truncate">{item.label}</span>
                <span
                  className={`font-data text-[11px] font-medium uppercase tracking-[0.1em] ${
                    active ? "text-accent" : "text-text-faint"
                  }`}
                >
                  {item.fee}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto hidden flex-col gap-2 md:flex md:px-5 md:pb-7">
        <div className="h-px w-full bg-hairline" />
        <p className="font-data text-[11px] font-medium uppercase tracking-[0.1em] text-text-faint">
          Powered by Nansen API
        </p>
        <p className="text-[12.5px] leading-[1.5] text-text-muted">
          {PRODUCT_LINE}
        </p>
      </div>
    </nav>
  );
}
