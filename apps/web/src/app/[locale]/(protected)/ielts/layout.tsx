import { notFound } from "next/navigation";
import { isIeltsAccessible } from "@/lib/ielts/access";

/**
 * Launch gate for the entire `/ielts/**` learner subtree (WS-5.1) — home, test
 * library, the mock player and results. The surface 404s unless IELTS is
 * launched (`IELTS_ENABLED`) or the viewer is an admin (pre-launch preview in
 * production), so debate is byte-identical and a direct mock URL stays hidden
 * for everyone else until the track is flipped on.
 */
export default async function IeltsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isIeltsAccessible())) {
    notFound();
  }

  return children;
}
