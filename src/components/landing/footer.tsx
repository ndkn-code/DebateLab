import Link from "next/link";
import { MessageSquare } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-zinc-800 px-4 py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-blue-500" />
          <span className="font-semibold text-white">DebateLab</span>
        </div>

        <div className="flex gap-6">
          <Link
            href="/practice"
            className="text-sm text-zinc-400 transition-colors hover:text-white"
          >
            Practice
          </Link>
          <Link
            href="/history"
            className="text-sm text-zinc-400 transition-colors hover:text-white"
          >
            History
          </Link>
        </div>

        <p className="text-sm text-zinc-500">
          &copy; {new Date().getFullYear()} DebateLab. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
