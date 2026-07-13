import * as React from "react";
import { cn } from "../../lib/utils";

const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "grid gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted",
      className,
    )}
    {...props}
  />
));
Label.displayName = "Label";

export { Label };
