import { LocalizedAppProviders } from "../localized-app-providers";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <LocalizedAppProviders>{children}</LocalizedAppProviders>;
}
