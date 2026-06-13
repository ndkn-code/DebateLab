import { redirect } from "next/navigation";
import { claimClubInvitation } from "@/app/actions/admin-clubs";
import { Eyebrow } from "@/components/ui/typography";

export const metadata = { title: "Join Club" };

export default async function JoinClubInvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await claimClubInvitation(token);

  if (result.status === "auth_required") {
    redirect(`/auth/login?next=${encodeURIComponent(`/join/club/${token}`)}`);
  }

  if (result.status === "accepted" && result.clubId) {
    redirect(`/dashboard/clubs/${result.clubId}?invite=accepted`);
  }

  const message =
    result.status === "email_mismatch"
      ? `This invitation belongs to ${result.expectedEmail}. Sign in with that email to accept it.`
      : result.status === "already_in_org"
        ? "Your account is already connected to another organization. Ask an admin to move you first."
      : result.status === "expired"
        ? "This club invitation has expired. Ask the club admin to send a new one."
        : result.status === "revoked"
          ? "This club invitation is no longer active."
          : "We could not find that club invitation.";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <section className="w-full max-w-md rounded-lg border border-outline-variant bg-white p-6 text-center shadow-sm">
        <Eyebrow className="text-primary">Thinkfy Club</Eyebrow>
        <h1 className="mt-3 text-2xl font-bold text-on-surface">Invitation not accepted</h1>
        <p className="mt-2 text-sm leading-6 text-on-surface-variant">{message}</p>
      </section>
    </main>
  );
}
