import { BeautifulLoadingState } from "@/components/beautifului";

export function TypingIndicator({ label }: { label?: string }) {
  return (
    <div className="px-1 py-3">
      <BeautifulLoadingState label={label} variant="drive" />
    </div>
  );
}
