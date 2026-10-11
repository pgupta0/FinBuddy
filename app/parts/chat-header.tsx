import { cn } from "@/lib/utils";

export function ChatHeaderBlock({ children, className }: { children?: React.ReactNode, className?: string }) {
    return (
        <div className={cn("gap-2 flex flex-1", className)}>
            {children}
        </div>
    )
}

export function ChatHeader({ children }: { children: React.ReactNode }) {
    return (
        // Solid, blurred bar (not a gradient fade) so header text/icons stay
        // legible against scrolled content behind it — matches the header
        // treatment in Claude/ChatGPT/Grok rather than fading to transparent
        // partway through the bar itself.
        <div className="w-full flex items-center gap-2 py-3 px-3 sm:px-5 bg-background/85 backdrop-blur-md border-b border-border/60 pointer-events-auto">
            {children}
        </div>
    )
}