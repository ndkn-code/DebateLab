"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Menu, X } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { LogoMark } from "./logo-mark";

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <LogoMark size="sm" variant="dark" />
        </Link>

        <div className="hidden items-center gap-8 md:flex">
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
          <Link href="/practice">
            <Button className="bg-primary text-on-primary hover:bg-primary-dim">
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
              href="/profile?tab=activities"
              className="text-sm text-zinc-400 hover:text-white"
              onClick={() => setMobileOpen(false)}
            >
              Activities
            </Link>
            <Link href="/practice" onClick={() => setMobileOpen(false)}>
              <Button className="w-full bg-primary text-on-primary hover:bg-primary-dim">
                Start Practicing
              </Button>
            </Link>
          </div>
        </motion.div>
      )}
    </motion.nav>
  );
}
