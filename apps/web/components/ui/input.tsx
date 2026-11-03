import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-md border border-stone-300 bg-white px-2.5 text-sm text-stone-900 shadow-sm outline-none placeholder:text-stone-400 focus:border-stone-500 focus:ring-2 focus:ring-stone-300 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
