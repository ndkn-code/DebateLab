import { listAllBandConversions } from "@/lib/api/ielts/band-conversions-repository";
import { groupBandConversionTables } from "@/lib/api/ielts/content-schema";
import { BandConversionsClient } from "@/components/admin/ielts/BandConversionsClient";

export const metadata = { title: "Admin — IELTS band conversions" };

export default async function IeltsBandConversionsPage() {
  const rows = await listAllBandConversions();
  const tables = groupBandConversionTables(rows);
  return <BandConversionsClient tables={tables} />;
}
