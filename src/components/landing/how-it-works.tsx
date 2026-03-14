"use client";

import { motion } from "framer-motion";
import { ListChecks, Mic, Brain } from "lucide-react";

const steps = [
  {
    icon: ListChecks,
    title: "Choose a Topic",
    description: "Pick from 30+ debate motions across 6 categories",
  },
  {
    icon: Mic,
    title: "Speak Your Mind",
    description: "Record your argument with real-time transcription",
  },
  {
    icon: Brain,
    title: "Get AI Feedback",
    description: "Receive detailed scoring and improvement tips",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="px-4 py-24">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            How It Works
          </h2>
          <p className="mt-4 text-zinc-400">
            Three simple steps to improve your debate skills
          </p>
        </motion.div>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
              className="group relative rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 text-center transition-colors hover:border-zinc-700"
            >
              <div className="mb-6 inline-flex rounded-xl bg-gradient-to-br from-blue-500/10 to-purple-600/10 p-4">
                <step.icon className="h-8 w-8 text-blue-400" />
              </div>
              <div className="mb-2 text-sm font-medium text-blue-400">
                Step {i + 1}
              </div>
              <h3 className="text-xl font-semibold text-white">{step.title}</h3>
              <p className="mt-3 text-sm text-zinc-400">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
