import identifierWhiteBgUrl from "../../../assets/Identifier_whiteBg.svg?url";
import { cn } from "@/lib/utils";

/** Helvety identifier mark (`assets/Identifier_whiteBg.svg`). */
export function HelvetyMark({ className }: { className?: string }) {
  return (
    <img
      src={identifierWhiteBgUrl}
      alt=""
      className={cn("h-8 w-8 shrink-0", className)}
      aria-hidden
    />
  );
}
