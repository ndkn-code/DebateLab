import { redirect } from "next/navigation";

export default function HistoryRedirectPage() {
  redirect("/profile?tab=activities");
}
