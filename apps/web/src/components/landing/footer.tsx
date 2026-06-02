import Link from "next/link";
import { LogoMark } from "./logo-mark";

export function Footer() {
  return (
    <footer className="border-t border-zinc-800 px-4 py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
        <div className="flex items-center gap-2">
          <LogoMark size="sm" variant="dark" />
        </div>

        <div className="flex gap-6">
          <Link
            href="/practice"
            className="text-sm text-zinc-400 transition-colors hover:text-white"
          >
            Practice
          </Link>
          <Link
            href="/profile?tab=activities"
            className="text-sm text-zinc-400 transition-colors hover:text-white"
          >
            Activities
          </Link>
        </div>

        <p className="text-sm text-zinc-500">
          &copy; {new Date().getFullYear()} Thinkfy. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
