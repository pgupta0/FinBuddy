"use client";

import { useEffect, useState } from "react";
import { Cpu, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Header dropdown for choosing which model answers.
 *
 * The list comes from /api/models, which only advertises models whose vendor
 * key is actually set on this deployment — so every option here is guaranteed
 * servable. The choice is per-browser (localStorage) and is sent with each
 * chat request, where the server re-validates it; this component is a
 * convenience, never the access control.
 *
 * Renders NOTHING until the fetch resolves. That is deliberate: server-rendered
 * HTML and the first client render must match, and the available model list is
 * only knowable on the client after a request. Computing it during render (or
 * in a useState initializer that reads localStorage) is exactly the pattern
 * that produced the app's "Minified React error #418" hydration crash — see
 * hooks/use-speech-recognition.ts for the same bug and its fix.
 */

const STORAGE_KEY = "finbuddy-selected-model";

export type ModelChoice = { vendor: string; modelId: string };

type SelectableModel = {
  vendor: string;
  vendorLabel: string;
  modelId: string;
  label: string;
  tier: "economy" | "standard" | "premium";
  isVendorDefault: boolean;
};

type ModelsResponse = {
  enabled: boolean;
  models: SelectableModel[];
  current: { vendor: string; modelId: string } | null;
};

const keyOf = (c: { vendor: string; modelId: string }) => `${c.vendor}::${c.modelId}`;

function readStored(): ModelChoice | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ModelChoice;
    return parsed?.vendor && parsed?.modelId ? parsed : null;
  } catch {
    // Private windows and blocked site data both throw here. A missing
    // preference just means "use the server default".
    return null;
  }
}

export function ModelPicker({ onChange }: { onChange: (c: ModelChoice | null) => void }) {
  const [models, setModels] = useState<SelectableModel[]>([]);
  const [selected, setSelected] = useState<ModelChoice | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/models");
        if (!res.ok) return;
        const data = (await res.json()) as ModelsResponse;
        if (cancelled || !data.enabled || data.models.length === 0) return;

        setModels(data.models);

        // A stored choice only counts if this deployment still offers it —
        // keys get removed and catalogs change, and a stale preference would
        // otherwise send a model the server will just discard.
        const stored = readStored();
        const valid =
          stored && data.models.some((m) => keyOf(m) === keyOf(stored)) ? stored : null;
        const initial = valid ?? data.current;

        if (initial) {
          setSelected(initial);
          onChange(initial);
        }
      } catch {
        // Offline or the route is unavailable — the picker stays hidden and
        // the server keeps using its configured default. Nothing breaks.
      }
    })();

    return () => {
      cancelled = true;
    };
    // onChange is a stable useCallback in the parent; this runs once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function select(value: string) {
    const [vendor, modelId] = value.split("::");
    const choice = { vendor, modelId };
    setSelected(choice);
    onChange(choice);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(choice));
    } catch {
      // Preference just won't survive a reload.
    }
  }

  // Only one model available means there is nothing to choose between.
  if (models.length < 2 || !selected) return null;

  const current = models.find((m) => keyOf(m) === keyOf(selected));

  // Preserve the catalog's own vendor ordering rather than sorting by name.
  const vendors: string[] = [];
  for (const m of models) if (!vendors.includes(m.vendor)) vendors.push(m.vendor);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 rounded-lg border border-border bg-card px-2 text-foreground hover:bg-muted"
          aria-label="Change model"
          title={current ? `${current.vendorLabel} · ${current.label}` : "Change model"}
        >
          <Cpu className="hidden size-4 shrink-0 sm:block" />
          <span className="text-xs font-medium sm:hidden">Model</span>
          <span className="hidden max-w-[9rem] truncate text-xs font-medium sm:inline">
            {current?.label ?? "Model"}
          </span>
          <ChevronDown className="size-3.5 shrink-0" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuRadioGroup value={keyOf(selected)} onValueChange={select}>
          {vendors.map((vendor, i) => (
            <div key={vendor}>
              {i > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                {models.find((m) => m.vendor === vendor)?.vendorLabel ?? vendor}
              </DropdownMenuLabel>
              {models
                .filter((m) => m.vendor === vendor)
                .map((m) => (
                  <DropdownMenuRadioItem key={keyOf(m)} value={keyOf(m)} className="text-sm">
                    <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                      <span className="truncate">{m.label}</span>
                      <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {m.tier}
                      </span>
                    </span>
                  </DropdownMenuRadioItem>
                ))}
            </div>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
