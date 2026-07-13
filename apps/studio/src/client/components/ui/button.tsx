import * as React from "react";
import { cn } from "../../lib/utils";

type ButtonVariant = "default" | "outline" | "ghost" | "link";
type ButtonSize = "default" | "sm" | "icon";

const variants: Record<ButtonVariant, string> = {
  default:
    "border border-foreground bg-foreground text-background hover:bg-navy",
  outline: "border border-border bg-transparent text-foreground hover:bg-soft",
  ghost: "border border-transparent bg-transparent hover:bg-soft",
  link: "border border-transparent bg-transparent px-0 underline-offset-4 hover:underline",
};

const sizes: Record<ButtonSize, string> = {
  default: "h-10 px-5 py-2",
  sm: "h-8 px-3 text-xs",
  icon: "h-9 w-9",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "default", size = "default", type, ...props },
    ref,
  ) => (
    <button
      ref={ref}
      type={type || "button"}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { Button };
