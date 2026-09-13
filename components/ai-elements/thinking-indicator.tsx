"use client";

import { Shimmer } from "@/components/ai-elements/shimmer";
import { useRotatingLabel } from "@/hooks/use-rotating-label";
import { Pipette } from "lucide-react";
import type { FunLabelCategory } from "@/lib/fun-labels";

/**
 * Shows a fun rotating label with shimmer.
 * Used during the "submitted" phase (waiting for first response from model).
 * When isCompacting=true, shows compaction-specific labels with an archive icon.
 */
export function ThinkingIndicator({ isCompacting = false }: { isCompacting?: boolean }) {
  const category: FunLabelCategory = isCompacting ? "compacting" : "thinking";
  const label = useRotatingLabel(category, 3000);

  return (
    <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
      {isCompacting && <Pipette className="size-4" />}

      <Shimmer className="text-sm" duration={1}>
        {label}
      </Shimmer>
    </div>
  );
}
