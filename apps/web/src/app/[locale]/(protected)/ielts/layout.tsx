import { notFound } from "next/navigation";
import { IELTS_ENABLED } from "@/lib/features";

/**
 * Launch gate for the entire `/ielts/**` learner subtree (WS-5.1) — home, test
 * library, the mock player and results. While `IELTS_ENABLED` is off the whole
 * surface 404s, so debate is byte-identical and a direct mock URL stays hidden
 * until the track is flipped on.
 */
export default function IeltsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!IELTS_ENABLED) {
    notFound();
  }

  return children;
}
