import * as RadioGroup from "@radix-ui/react-radio-group";
import * as Label from "@radix-ui/react-label";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_ENFORCEMENT_PREFERENCE,
  parseEnforcementPreference,
  parseV3SurveyEnabled,
  STORAGE_KEY_ENFORCED_V3,
  STORAGE_KEY_V3SURVEY_ENABLED,
  SYNC_POLICY_KEYS,
  type EnforcementPreference,
} from "../constants";
import { reloadFocusedTargetTabIfApplicable } from "./reload-focused-target-tab";

type SurveyEnabledSync = "true" | "false";

export default function App() {
  const [value, setValue] = useState<EnforcementPreference>(DEFAULT_ENFORCEMENT_PREFERENCE);
  const [surveyMode, setSurveyMode] = useState<SurveyEnabledSync>("false");
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<string>("");
  const statusClearTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const enforcementRef = useRef<EnforcementPreference>(DEFAULT_ENFORCEMENT_PREFERENCE);

  useEffect(() => {
    enforcementRef.current = value;
  }, [value]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void chrome.storage.sync
      .get([...SYNC_POLICY_KEYS])
      .then((result) => {
        if (!mountedRef.current) {
          return;
        }
        setValue(parseEnforcementPreference(result[STORAGE_KEY_ENFORCED_V3]));
        setSurveyMode(
          parseV3SurveyEnabled(result[STORAGE_KEY_V3SURVEY_ENABLED]) ? "true" : "false",
        );
        setLoaded(true);
      })
      .catch(() => {
        if (!mountedRef.current) {
          return;
        }
        setValue(DEFAULT_ENFORCEMENT_PREFERENCE);
        setSurveyMode("false");
        setLoaded(true);
      });
  }, []);

  const scheduleStatusClear = useCallback(() => {
    if (statusClearTimerRef.current !== null) {
      window.clearTimeout(statusClearTimerRef.current);
    }
    statusClearTimerRef.current = window.setTimeout(() => {
      statusClearTimerRef.current = null;
      setStatus("");
    }, 2000);
  }, []);

  const resyncFromStorage = useCallback(async () => {
    const result = await chrome.storage.sync.get([...SYNC_POLICY_KEYS]);
    if (!mountedRef.current) {
      return;
    }
    setValue(parseEnforcementPreference(result[STORAGE_KEY_ENFORCED_V3]));
    setSurveyMode(parseV3SurveyEnabled(result[STORAGE_KEY_V3SURVEY_ENABLED]) ? "true" : "false");
  }, []);

  const onSave = useCallback(
    (next: EnforcementPreference) => {
      setValue(next);
      setStatus("Saving your choice…");
      void (async () => {
        try {
          await chrome.storage.sync.set({ [STORAGE_KEY_ENFORCED_V3]: next });
          if (!mountedRef.current) {
            return;
          }
          setStatus("You're all set.");
          await reloadFocusedTargetTabIfApplicable(next);
        } catch (error: unknown) {
          if (!mountedRef.current) {
            return;
          }
          try {
            await resyncFromStorage();
          } catch {
            if (mountedRef.current) {
              setValue(DEFAULT_ENFORCEMENT_PREFERENCE);
            }
          }
          const message =
            error instanceof Error
              ? error.message
              : "Couldn't save your settings. If you use Chrome sync, make sure you're signed in, then try again.";
          if (mountedRef.current) {
            setStatus(message);
          }
        }
        if (mountedRef.current) {
          scheduleStatusClear();
        }
      })();
    },
    [resyncFromStorage, scheduleStatusClear],
  );

  const onSaveSurvey = useCallback(
    (next: SurveyEnabledSync) => {
      setSurveyMode(next);
      setStatus("Saving your choice…");
      void (async () => {
        try {
          await chrome.storage.sync.set({ [STORAGE_KEY_V3SURVEY_ENABLED]: next });
          if (!mountedRef.current) {
            return;
          }
          setStatus("You're all set.");
          await reloadFocusedTargetTabIfApplicable(enforcementRef.current);
        } catch (error: unknown) {
          if (!mountedRef.current) {
            return;
          }
          try {
            await resyncFromStorage();
          } catch {
            if (mountedRef.current) {
              setSurveyMode("false");
            }
          }
          const message =
            error instanceof Error
              ? error.message
              : "Couldn't save your settings. If you use Chrome sync, make sure you're signed in, then try again.";
          if (mountedRef.current) {
            setStatus(message);
          }
        }
        if (mountedRef.current) {
          scheduleStatusClear();
        }
      })();
    },
    [resyncFromStorage, scheduleStatusClear],
  );

  useEffect(() => {
    return () => {
      if (statusClearTimerRef.current !== null) {
        window.clearTimeout(statusClearTimerRef.current);
      }
    };
  }, []);

  if (!loaded) {
    return <div className="px-4 py-6 text-sm text-slate-500">Loading your settings…</div>;
  }

  return (
    <div className="w-[320px] space-y-4 px-4 py-5">
      <div className="space-y-1">
        <h1 className="text-base font-semibold tracking-tight">
          Power Automate: editor preference
        </h1>
        <p className="text-xs text-slate-500">
          Flow and run links sometimes open in the wrong editor. Pick the classic look or the new
          designer below and we will keep links consistent for you. Paused means we leave links
          alone until you turn this back on—the extension stays installed.
        </p>
      </div>

      <RadioGroup.Root
        className="grid gap-2"
        aria-label="Which editor to use for flow and run links"
        value={value}
        onValueChange={(v) => {
          if (v === "true" || v === "false" || v === "off") {
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
              Classic editor
            </Label.Root>
            <p className="text-xs text-slate-500">
              The original Power Automate layout. Use this when links should always open in
              classic—not the newer designer.
            </p>
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
              New designer
            </Label.Root>
            <p className="text-xs text-slate-500">
              The updated flow and run experience from Microsoft. Use this when links should open in
              the new designer, not classic.
            </p>
          </div>
        </div>

        <div
          className={
            "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors " +
            (value === "off"
              ? "border-slate-900 bg-slate-50"
              : "border-slate-200 hover:bg-slate-50/60")
          }
        >
          <RadioGroup.Item
            value="off"
            id="mode-off"
            className="mt-0.5 size-4 shrink-0 rounded-full border border-slate-900 text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            <RadioGroup.Indicator className="flex size-full items-center justify-center after:block after:size-2 after:rounded-full after:bg-slate-900" />
          </RadioGroup.Item>
          <div className="grid gap-0.5">
            <Label.Root htmlFor="mode-off" className="cursor-pointer text-sm font-medium">
              Paused
            </Label.Root>
            <p className="text-xs text-slate-500">
              We will not change links or apply network tweaks for now. Nothing is removed—choose
              Classic or New designer again whenever you want help with links.
            </p>
          </div>
        </div>
      </RadioGroup.Root>

      <div className="space-y-2 border-t border-slate-200 pt-4">
        <h2 className="text-sm font-semibold tracking-tight">Survey links (optional)</h2>
        <p className="text-xs text-slate-500">
          Some organizations use a special &quot;survey&quot; flag on links. Leave this off unless
          you know you need it. With this on, we add the flag when it is missing and keep it
          enabled. That only applies while Classic or New designer is selected—not while Paused.
        </p>
        <RadioGroup.Root
          className="grid gap-2"
          aria-label="Optional survey flag on flow and run links"
          value={surveyMode}
          onValueChange={(v) => {
            if (v === "true" || v === "false") {
              onSaveSurvey(v);
            }
          }}
        >
          <div
            className={
              "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors " +
              (surveyMode === "false"
                ? "border-slate-900 bg-slate-50"
                : "border-slate-200 hover:bg-slate-50/60")
            }
          >
            <RadioGroup.Item
              value="false"
              id="survey-off"
              className="mt-0.5 size-4 shrink-0 rounded-full border border-slate-900 text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              <RadioGroup.Indicator className="flex size-full items-center justify-center after:block after:size-2 after:rounded-full after:bg-slate-900" />
            </RadioGroup.Item>
            <div className="grid gap-0.5">
              <Label.Root htmlFor="survey-off" className="cursor-pointer text-sm font-medium">
                Leave survey links alone
              </Label.Root>
              <p className="text-xs text-slate-500">
                Recommended for most people. We will not add or change the survey part of a link.
              </p>
            </div>
          </div>
          <div
            className={
              "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors " +
              (surveyMode === "true"
                ? "border-slate-900 bg-slate-50"
                : "border-slate-200 hover:bg-slate-50/60")
            }
          >
            <RadioGroup.Item
              value="true"
              id="survey-on"
              className="mt-0.5 size-4 shrink-0 rounded-full border border-slate-900 text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              <RadioGroup.Indicator className="flex size-full items-center justify-center after:block after:size-2 after:rounded-full after:bg-slate-900" />
            </RadioGroup.Item>
            <div className="grid gap-0.5">
              <Label.Root htmlFor="survey-on" className="cursor-pointer text-sm font-medium">
                Turn on survey flag
              </Label.Root>
              <p className="text-xs text-slate-500">
                When a link is missing the survey flag, we add it so the survey flow works as
                expected.
              </p>
            </div>
          </div>
        </RadioGroup.Root>
      </div>

      {status ? <p className="text-xs text-slate-500">{status}</p> : null}
    </div>
  );
}
