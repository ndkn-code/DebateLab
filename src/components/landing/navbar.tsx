"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Menu, X, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-blue-500" />
          <span className="text-xl font-bold text-white">DebateLab</span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
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
          <Link href="/practice">
            <Button className="bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700">
              Start Practicing
            </Button>
          </Link>
        </div>

        <button
          className="md:hidden text-zinc-400 hover:text-white"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="border-t border-zinc-800 bg-zinc-950 md:hidden"
        >
          <div className="flex flex-col gap-4 p-4">
            <Link
              href="/practice"
              className="text-sm text-zinc-400 hover:text-white"
              onClick={() => setMobileOpen(false)}
            >
              Practice
            </Link>
            <Link
              href="/history"
              className="text-sm text-zinc-400 hover:text-white"
              onClick={() => setMobileOpen(false)}
            >
              History
            </Link>
            <Link href="/practice" onClick={() => setMobileOpen(false)}>
              <Button className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white">
                Start Practicing
              </Button>
            </Link>
          </div>
        </motion.div>
      )}
    </motion.nav>
  );
}
