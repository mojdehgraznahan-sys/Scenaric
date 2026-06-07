import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "w-full resize-none rounded-md border border-border bg-white px-3 py-2.5 text-sm leading-[1.55] outline-none transition-[border,box-shadow] duration-150 placeholder:text-text-3 focus:border-brand-orange focus:shadow-[0_0_0_3px_rgba(249,115,22,0.2)] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
