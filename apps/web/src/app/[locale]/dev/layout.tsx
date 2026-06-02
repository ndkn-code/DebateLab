import { LocalizedAppProviders } from "../localized-app-providers";

export default function DevLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <LocalizedAppProviders>{children}</LocalizedAppProviders>;
}
