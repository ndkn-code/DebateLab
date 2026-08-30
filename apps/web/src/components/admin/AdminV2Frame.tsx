import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import styles from "./admin-v2.module.css";

export function AdminV2Frame({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(styles.root, className)}>{children}</div>;
}
