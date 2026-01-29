import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "btns bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "btns bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "btns border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "btns bg-secondary text-secondary-foreground",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
        blue_middle: "btns bg-blue-500 text-white hover:bg-blue-600",
        mvPrimary:
          "btns border bg-mv-primary-bg text-mv-primary-text border-mv-primary-bd hover:brightness-95 dark:hover:brightness-110",
        mvSecondary:
          "btns border bg-mv-secondary-bg text-mv-secondary-text border-mv-secondary-bd hover:brightness-95 dark:hover:brightness-110",
        mvSuccess:
          "btns border bg-mv-success-bg text-mv-success-text border-mv-success-bd hover:brightness-95 dark:hover:brightness-110",
        mvDanger:
          "btns border bg-mv-danger-bg text-mv-danger-text border-mv-danger-bd hover:brightness-95 dark:hover:brightness-110",
        mvWarning:
          "btns border bg-mv-warning-bg text-mv-warning-text border-mv-warning-bd hover:brightness-95 dark:hover:brightness-110",
        mvInfo:
          "btns border bg-mv-info-bg text-mv-info-text border-mv-info-bd hover:brightness-95 dark:hover:brightness-110",
        glass:
          "border border-white/30 dark:border-white/20 bg-white/10 dark:bg-white/5 backdrop-blur-md text-foreground hover:bg-white/20 dark:hover:bg-white/10 hover:border-white/40 dark:hover:border-white/30 shadow-sm hover:shadow-md transition-all",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
