import * as RadioGroup from "@radix-ui/react-radio-group";
import * as Label from "@radix-ui/react-label";
import { useCallback, useEffect, useState } from "react";
import { DEFAULT_ENFORCED_V3, STORAGE_KEY_ENFORCED_V3, type EnforcedV3 } from "../constants";

export default function App() {
  const [value, setValue] = useState<EnforcedV3>(DEFAULT_ENFORCED_V3);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    void chrome.storage.sync.get(STORAGE_KEY_ENFORCED_V3).then((result) => {
      const raw = result[STORAGE_KEY_ENFORCED_V3];
      setValue(raw === "true" ? "true" : "false");
      setLoaded(true);
    });
  }, []);

  const onSave = useCallback((next: EnforcedV3) => {
    setStatus("Saving…");
    void chrome.storage.sync.set({ [STORAGE_KEY_ENFORCED_V3]: next }, () => {
      if (chrome.runtime.lastError) {
        setStatus(chrome.runtime.lastError.message || "Could not save.");
        return;
      }
      setValue(next);
      setStatus("Saved.");
      window.setTimeout(() => setStatus(""), 2000);
    });
  }, []);

  if (!loaded) {
    return <div className="px-4 py-6 text-sm text-slate-500">Loading…</div>;
  }

  return (
    <div className="w-[320px] space-y-4 px-4 py-5">
      <div className="space-y-1">
        <h1 className="text-base font-semibold tracking-tight">Power Automate version enforcer</h1>
        <p className="text-xs text-slate-500">
          Enforce query <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">v3</code> on
          flow and run URLs. When{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">v3survey</code> exists, it
          is aligned to the same value.
        </p>
      </div>

      <RadioGroup.Root
        className="grid gap-2"
        value={value}
        onValueChange={(v) => {
          if (v === "true" || v === "false") {
            onSave(v);
          }
        }}
      >
        <div
          className={
            "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors " +
            (value === "false"
              ? "border-slate-900 bg-slate-50"
              : "border-slate-200 hover:bg-slate-50/60")
          }
        >
          <RadioGroup.Item
            value="false"
            id="mode-false"
            className="mt-0.5 size-4 shrink-0 rounded-full border border-slate-900 text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            <RadioGroup.Indicator className="flex size-full items-center justify-center after:block after:size-2 after:rounded-full after:bg-slate-900" />
          </RadioGroup.Item>
          <div className="grid gap-0.5">
            <Label.Root htmlFor="mode-false" className="cursor-pointer text-sm font-medium">
              Classic editor (v3=false)
            </Label.Root>
            <p className="text-xs text-slate-500">Force the legacy flow designer experience.</p>
          </div>
        </div>

        <div
          className={
            "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors " +
            (value === "true"
              ? "border-slate-900 bg-slate-50"
              : "border-slate-200 hover:bg-slate-50/60")
          }
        >
          <RadioGroup.Item
            value="true"
            id="mode-true"
            className="mt-0.5 size-4 shrink-0 rounded-full border border-slate-900 text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            <RadioGroup.Indicator className="flex size-full items-center justify-center after:block after:size-2 after:rounded-full after:bg-slate-900" />
          </RadioGroup.Item>
          <div className="grid gap-0.5">
            <Label.Root htmlFor="mode-true" className="cursor-pointer text-sm font-medium">
              New designer (v3=true)
            </Label.Root>
            <p className="text-xs text-slate-500">
              Force the current designer when Microsoft links omit or flip v3.
            </p>
          </div>
        </div>
      </RadioGroup.Root>

      {status ? <p className="text-xs text-slate-500">{status}</p> : null}
    </div>
  );
}
