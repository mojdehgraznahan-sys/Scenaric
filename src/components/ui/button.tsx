import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Variants reproduce the prototype's .btn-* styles exactly, now as Tailwind utilities.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border border-transparent font-medium leading-none transition-[background,border-color,color,transform] duration-150 active:translate-y-[0.5px] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
  {
    variants: {
      variant: {
        primary: "bg-brand-orange text-white border-brand-orange hover:bg-brand-orangeHover hover:border-brand-orangeHover",
        ghost: "bg-transparent text-foreground border-border hover:bg-[#F9FAFB] hover:border-border-strong",
        soft: "bg-brand-orangeLight text-brand-orange700 border-brand-orange100 hover:bg-[#FEEBD2]",
        dark: "bg-brand-dark text-white border-brand-dark hover:bg-[#2c2742]",
        onInk: "bg-white/[0.08] text-white border-white/20 hover:bg-white/[0.15]",
      },
      size: {
        default: "px-4 py-2.5 text-sm",
        sm: "px-[11px] py-[7px] text-[13px]",
        lg: "px-[22px] py-[14px] text-[15px]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
