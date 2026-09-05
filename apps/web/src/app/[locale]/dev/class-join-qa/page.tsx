import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ClassJoinQa } from "./qa-client";

export default async function Page() {
  const host = (await headers()).get("host") ?? "";
  if (
    process.env.NODE_ENV !== "development" ||
    !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)
  )
    notFound();
  return <ClassJoinQa />;
}
