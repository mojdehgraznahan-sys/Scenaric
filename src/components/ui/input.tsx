import * as React from "react";

import { cn } from "@/lib/utils";

// Mirrors the prototype .input: orange focus ring (3px) + orange border on focus.
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "w-full rounded-md border border-border bg-white px-3 py-2.5 text-sm outline-none transition-[border,box-shadow] duration-150 placeholder:text-text-3 focus:border-brand-orange focus:shadow-[0_0_0_3px_rgba(249,115,22,0.2)] disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
