import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"
import { cn } from "@/lib/utils"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-right"
      closeButton
      offset="1rem"
      expand={false}
      gap={10}
      visibleToasts={4}
      toastOptions={{
        duration: 4200,
        classNames: {
          toast: cn(
            "cn-toast group/toast flex w-full items-start gap-3 overflow-hidden p-4",
            "rounded-2xl border shadow-[0_10px_40px_-10px_rgba(0,0,0,0.18),inset_0_1px_0_0_rgba(255,255,255,0.65)]",
            "bg-white/85 backdrop-blur-xl backdrop-saturate-150",
            "text-foreground dark:border-white/12 dark:bg-zinc-900/88 dark:shadow-[0_12px_48px_-12px_rgba(0,0,0,0.55),inset_0_1px_0_0_rgba(255,255,255,0.06)]",
          ),
          title: "text-[0.9375rem] font-semibold leading-snug tracking-tight text-foreground pr-6",
          description: "text-[0.8125rem] leading-relaxed text-muted-foreground mt-0.5",
          content: "flex-1 min-w-0",
          icon: "mt-0.5 shrink-0 [&_svg]:size-[1.125rem]",
          closeButton:
            "absolute right-2 top-2 rounded-lg border border-transparent bg-black/[0.04] p-1 text-muted-foreground opacity-70 transition-all hover:bg-black/[0.08] hover:opacity-100 hover:text-foreground dark:bg-white/10 dark:hover:bg-white/15",
          actionButton:
            "rounded-lg border border-border/80 bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm hover:bg-primary/90",
          cancelButton:
            "rounded-lg border border-border bg-transparent px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted",
          success: cn(
            "border-l-[3px] border-l-emerald-500/90",
            "[&_[data-icon]]:flex [&_[data-icon]]:size-9 [&_[data-icon]]:items-center [&_[data-icon]]:justify-center [&_[data-icon]]:rounded-xl",
            "[&_[data-icon]]:bg-emerald-500/12 [&_[data-icon]]:text-emerald-600 dark:[&_[data-icon]]:text-emerald-400",
          ),
          error: cn(
            "border-l-[3px] border-l-red-500/90",
            "[&_[data-icon]]:flex [&_[data-icon]]:size-9 [&_[data-icon]]:items-center [&_[data-icon]]:justify-center [&_[data-icon]]:rounded-xl",
            "[&_[data-icon]]:bg-red-500/12 [&_[data-icon]]:text-red-600 dark:[&_[data-icon]]:text-red-400",
          ),
          info: cn(
            "border-l-[3px] border-l-sky-500/90",
            "[&_[data-icon]]:flex [&_[data-icon]]:size-9 [&_[data-icon]]:items-center [&_[data-icon]]:justify-center [&_[data-icon]]:rounded-xl",
            "[&_[data-icon]]:bg-sky-500/12 [&_[data-icon]]:text-sky-600 dark:[&_[data-icon]]:text-sky-400",
          ),
          warning: cn(
            "border-l-[3px] border-l-amber-500/90",
            "[&_[data-icon]]:flex [&_[data-icon]]:size-9 [&_[data-icon]]:items-center [&_[data-icon]]:justify-center [&_[data-icon]]:rounded-xl",
            "[&_[data-icon]]:bg-amber-500/12 [&_[data-icon]]:text-amber-600 dark:[&_[data-icon]]:text-amber-400",
          ),
          loading: cn(
            "border-l-[3px] border-l-violet-500/80",
            "[&_[data-icon]]:flex [&_[data-icon]]:size-9 [&_[data-icon]]:items-center [&_[data-icon]]:justify-center [&_[data-icon]]:rounded-xl",
            "[&_[data-icon]]:bg-violet-500/12 [&_[data-icon]]:text-violet-600 dark:[&_[data-icon]]:text-violet-400",
          ),
          default: "border-border/60",
        },
      }}
      icons={{
        success: <CircleCheckIcon className="size-[1.125rem]" strokeWidth={2.25} />,
        info: <InfoIcon className="size-[1.125rem]" strokeWidth={2.25} />,
        warning: <TriangleAlertIcon className="size-[1.125rem]" strokeWidth={2.25} />,
        error: <OctagonXIcon className="size-[1.125rem]" strokeWidth={2.25} />,
        loading: <Loader2Icon className="size-[1.125rem] animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "hsl(var(--popover) / 0.92)",
          "--normal-text": "hsl(var(--popover-foreground))",
          "--normal-border": "hsl(var(--border))",
          "--border-radius": "1rem",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
