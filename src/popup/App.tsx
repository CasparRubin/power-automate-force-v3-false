import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeInfo,
  ExternalLink,
  GitBranch,
  Globe,
  Loader2,
  MessageSquare,
  Moon,
  Package,
  Palette,
  PenLine,
  Sun,
  Workflow,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  DEFAULT_ENFORCEMENT_PREFERENCE,
  parseEnforcementPreference,
  parseV3SurveyEnabled,
  STORAGE_KEY_ENFORCED_V3,
  STORAGE_KEY_POPUP_THEME,
  STORAGE_KEY_V3SURVEY_ENABLED,
  SYNC_POLICY_KEYS,
  type EnforcementPreference,
} from "../constants";
import {
  DEVELOPER_NAME,
  DEVELOPER_URL,
  EXTENSION_DISPLAY_NAME,
  SOURCE_REPO_URL,
} from "./about-meta";
import { HelvetyMark } from "./components/HelvetyMark";
import { persistPolicyPreferenceAndOptionalReload } from "./persist-policy-preference";
import { createAsyncQueue } from "./sync-write-queue";
import {
  applyThemeClassToDocument,
  defaultThemeFromSystem,
  parseThemePreference,
  resolveIsDark,
  type ThemePreference,
} from "./theme-preference";

type SurveyEnabledSync = "true" | "false";

/** Tab body: native scroll + `.popup-tab-scroll` themed scrollbar (see index.css). */
const TAB_PANEL_CLASS =
  "popup-tab-scroll min-h-40 max-h-72 w-full overflow-y-auto overflow-x-hidden pr-1 [scrollbar-gutter:stable]";

function PolicyPanelBusyHint({
  isPolicySyncBusy,
  isTargetTabReloadBusy,
}: {
  isPolicySyncBusy: boolean;
  isTargetTabReloadBusy: boolean;
}) {
  if (isPolicySyncBusy) {
    return <span className="shrink-0 text-[11px] font-medium text-muted-foreground">Saving…</span>;
  }
  if (isTargetTabReloadBusy) {
    return (
      <span className="shrink-0 text-[11px] font-medium text-muted-foreground">Reloading tab…</span>
    );
  }
  return null;
}

function readExtensionVersion(): string {
  if (typeof chrome !== "undefined" && chrome.runtime?.getManifest) {
    return chrome.runtime.getManifest().version;
  }
  return "—";
}

export default function App() {
  const [value, setValue] = useState<EnforcementPreference>(DEFAULT_ENFORCEMENT_PREFERENCE);
  /** Sync `v3surveyEnabled`: `"false"` = Hide (default, `v3survey=false` on URLs, adds if missing); `"true"` = Show (normalize in-URL `v3survey` to `true` only). */
  const [surveyMode, setSurveyMode] = useState<SurveyEnabledSync>("false");
  const [themePreference, setThemePreference] = useState<ThemePreference>(() =>
    defaultThemeFromSystem(),
  );
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<string>("");
  /** True while `chrome.storage.sync.set` is in flight for editor or survey policy keys. */
  const [isPolicySyncBusy, setIsPolicySyncBusy] = useState(false);
  /** True while `chrome.tabs.reload` runs for a flow/run tab (inputs stay enabled). */
  const [isTargetTabReloadBusy, setIsTargetTabReloadBusy] = useState(false);
  const [extensionVersion, setExtensionVersion] = useState<string>("");
  const statusClearTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const enforcementRef = useRef<EnforcementPreference>(DEFAULT_ENFORCEMENT_PREFERENCE);
  const syncWriteDepthRef = useRef(0);
  const editorWriteQueue = useMemo(() => createAsyncQueue(), []);
  const surveyWriteQueue = useMemo(() => createAsyncQueue(), []);

  const beginSyncWrite = useCallback(() => {
    syncWriteDepthRef.current += 1;
    if (syncWriteDepthRef.current === 1) {
      setIsPolicySyncBusy(true);
    }
  }, []);

  const endSyncWrite = useCallback(() => {
    syncWriteDepthRef.current -= 1;
    if (syncWriteDepthRef.current <= 0) {
      syncWriteDepthRef.current = 0;
      setIsPolicySyncBusy(false);
    }
  }, []);

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
    setExtensionVersion(readExtensionVersion());
  }, []);

  useEffect(() => {
    void Promise.all([
      chrome.storage.sync.get([...SYNC_POLICY_KEYS]),
      chrome.storage.local.get(STORAGE_KEY_POPUP_THEME),
    ])
      .then(([syncResult, localResult]) => {
        if (!mountedRef.current) {
          return;
        }
        setValue(parseEnforcementPreference(syncResult[STORAGE_KEY_ENFORCED_V3]));
        setSurveyMode(
          parseV3SurveyEnabled(syncResult[STORAGE_KEY_V3SURVEY_ENABLED]) ? "true" : "false",
        );
        const raw = localResult[STORAGE_KEY_POPUP_THEME];
        const theme = parseThemePreference(raw);
        setThemePreference(theme);
        applyThemeClassToDocument(resolveIsDark(theme));
        if (raw !== theme) {
          void chrome.storage.local.set({ [STORAGE_KEY_POPUP_THEME]: theme });
        }
        setLoaded(true);
      })
      .catch(() => {
        if (!mountedRef.current) {
          return;
        }
        setValue(DEFAULT_ENFORCEMENT_PREFERENCE);
        setSurveyMode("false");
        const theme = parseThemePreference(undefined);
        setThemePreference(theme);
        applyThemeClassToDocument(resolveIsDark(theme));
        setLoaded(true);
      });
  }, []);

  useEffect(() => {
    applyThemeClassToDocument(resolveIsDark(themePreference));
  }, [themePreference]);

  const clearPendingStatusDismiss = useCallback(() => {
    if (statusClearTimerRef.current !== null) {
      window.clearTimeout(statusClearTimerRef.current);
      statusClearTimerRef.current = null;
    }
  }, []);

  const scheduleStatusClear = useCallback(
    (clearAfterMs: number = 2000) => {
      clearPendingStatusDismiss();
      statusClearTimerRef.current = window.setTimeout(() => {
        statusClearTimerRef.current = null;
        setStatus("");
      }, clearAfterMs);
    },
    [clearPendingStatusDismiss],
  );

  const resyncFromStorage = useCallback(async () => {
    const result = await chrome.storage.sync.get([...SYNC_POLICY_KEYS]);
    if (!mountedRef.current) {
      return;
    }
    setValue(parseEnforcementPreference(result[STORAGE_KEY_ENFORCED_V3]));
    setSurveyMode(parseV3SurveyEnabled(result[STORAGE_KEY_V3SURVEY_ENABLED]) ? "true" : "false");
  }, []);

  const onSaveTheme = useCallback((next: ThemePreference) => {
    setThemePreference(next);
    applyThemeClassToDocument(resolveIsDark(next));
    void chrome.storage.local.set({ [STORAGE_KEY_POPUP_THEME]: next });
  }, []);

  const onSave = useCallback(
    (next: EnforcementPreference) => {
      setValue(next);
      void editorWriteQueue.enqueue(() =>
        persistPolicyPreferenceAndOptionalReload({
          storagePatch: { [STORAGE_KEY_ENFORCED_V3]: next },
          logLabel: "enforcedV3",
          getReloadPreference: () => next,
          mountedRef,
          beginSyncWrite,
          endSyncWrite,
          clearPendingStatusDismiss,
          setStatus,
          setIsTargetTabReloadBusy,
          resyncFromStorage,
          scheduleStatusClear,
          onResyncHardFailure: () => setValue(DEFAULT_ENFORCEMENT_PREFERENCE),
        }),
      );
    },
    [
      beginSyncWrite,
      clearPendingStatusDismiss,
      editorWriteQueue,
      endSyncWrite,
      resyncFromStorage,
      scheduleStatusClear,
    ],
  );

  const onSaveSurvey = useCallback(
    (next: SurveyEnabledSync) => {
      setSurveyMode(next);
      void surveyWriteQueue.enqueue(() =>
        persistPolicyPreferenceAndOptionalReload({
          storagePatch: { [STORAGE_KEY_V3SURVEY_ENABLED]: next },
          logLabel: "v3survey",
          getReloadPreference: () => enforcementRef.current,
          mountedRef,
          beginSyncWrite,
          endSyncWrite,
          clearPendingStatusDismiss,
          setStatus,
          setIsTargetTabReloadBusy,
          resyncFromStorage,
          scheduleStatusClear,
          onResyncHardFailure: () => setSurveyMode("false"),
        }),
      );
    },
    [
      beginSyncWrite,
      clearPendingStatusDismiss,
      endSyncWrite,
      resyncFromStorage,
      scheduleStatusClear,
      surveyWriteQueue,
    ],
  );

  useEffect(() => {
    return () => {
      clearPendingStatusDismiss();
    };
  }, [clearPendingStatusDismiss]);

  if (!loaded) {
    return (
      <div className="flex w-[320px] flex-col gap-2 px-3 py-3 text-sm leading-snug text-foreground">
        <header className="flex select-none items-center gap-2.5 border-b border-border/60 pb-2">
          <HelvetyMark />
          <div className="flex min-w-0 flex-1 flex-col gap-0">
            <span className="text-sm font-semibold tracking-tight text-foreground">
              {DEVELOPER_NAME}
            </span>
            <span className="text-[11px] leading-tight text-muted-foreground">
              {EXTENSION_DISPLAY_NAME}
            </span>
          </div>
        </header>
        <p className="text-xs text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const choiceRow = (selected: boolean) =>
    cn(
      "flex cursor-pointer items-start gap-2 rounded-none p-2 transition-colors",
      selected ? "bg-muted" : "hover:bg-muted/60",
    );

  return (
    <div className="flex w-[320px] flex-col gap-2 px-3 py-3 text-sm leading-snug text-foreground">
      <Tabs defaultValue="editor" className="flex flex-col gap-0">
        <header className="mb-2 flex select-none items-center gap-2.5 border-b border-border/60 pb-2">
          <HelvetyMark />
          <div className="flex min-w-0 flex-1 flex-col gap-0">
            <span className="text-sm font-semibold tracking-tight text-foreground">
              {DEVELOPER_NAME}
            </span>
            <span className="text-[11px] leading-tight text-muted-foreground">
              {EXTENSION_DISPLAY_NAME}
            </span>
          </div>
        </header>
        <TabsList className="grid h-auto w-full grid-cols-3 gap-0.5 bg-muted p-1 text-xs">
          <TabsTrigger
            value="editor"
            className="flex flex-col gap-0.5 px-2 py-2 text-xs shadow-none"
          >
            <PenLine className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>Editor</span>
          </TabsTrigger>
          <TabsTrigger
            value="survey"
            className="flex flex-col gap-0.5 px-2 py-2 text-xs shadow-none"
          >
            <MessageSquare className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>Survey</span>
          </TabsTrigger>
          <TabsTrigger
            value="about"
            className="flex flex-col gap-0.5 px-2 py-2 text-xs shadow-none"
          >
            <BadgeInfo className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>About</span>
          </TabsTrigger>
        </TabsList>

        {status || isPolicySyncBusy || isTargetTabReloadBusy ? (
          <div
            role="status"
            aria-live="polite"
            className="mt-2 flex min-h-[1.25rem] items-center gap-2 text-xs text-muted-foreground"
          >
            {isPolicySyncBusy || isTargetTabReloadBusy ? (
              <Loader2
                className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground"
                aria-hidden
              />
            ) : null}
            {status ? <span className="min-w-0 leading-snug">{status}</span> : null}
          </div>
        ) : null}

        <TabsContent value="editor" className="mt-2 outline-none">
          <div className={TAB_PANEL_CLASS} aria-busy={isPolicySyncBusy || isTargetTabReloadBusy}>
            <div className="flex flex-col gap-3 pr-2">
              <div className="flex flex-col gap-0.5">
                <div className="flex min-h-[1.25rem] items-baseline justify-between gap-2">
                  <h1 className="text-sm font-semibold tracking-tight text-foreground">Editor</h1>
                  <PolicyPanelBusyHint
                    isPolicySyncBusy={isPolicySyncBusy}
                    isTargetTabReloadBusy={isTargetTabReloadBusy}
                  />
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Choose how flow and run links open in Power Automate: classic designer, new
                  designer, or paused. Paused turns off link changes until you pick an editor again.
                </p>
              </div>

              <RadioGroup
                className="flex flex-col gap-1.5"
                aria-label="Editor for flow and run links"
                disabled={isPolicySyncBusy}
                value={value}
                onValueChange={(v) => {
                  if (v === "true" || v === "false" || v === "off") {
                    onSave(v);
                  }
                }}
              >
                <div className={choiceRow(value === "false")}>
                  <RadioGroupItem value="false" id="mode-false" className="mt-0.5 shrink-0" />
                  <div className="flex min-w-0 flex-col gap-0">
                    <Label htmlFor="mode-false" className="cursor-pointer text-sm font-medium">
                      Classic Designer
                    </Label>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Rewritten links use{" "}
                      <code className="rounded-none bg-muted px-0.5 text-[11px] text-foreground">
                        v3=false
                      </code>
                      .
                    </p>
                  </div>
                </div>

                <div className={choiceRow(value === "true")}>
                  <RadioGroupItem value="true" id="mode-true" className="mt-0.5 shrink-0" />
                  <div className="flex min-w-0 flex-col gap-0">
                    <Label htmlFor="mode-true" className="cursor-pointer text-sm font-medium">
                      New Designer
                    </Label>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Rewritten links use{" "}
                      <code className="rounded-none bg-muted px-0.5 text-[11px] text-foreground">
                        v3=true
                      </code>
                      .
                    </p>
                  </div>
                </div>

                <div className={choiceRow(value === "off")}>
                  <RadioGroupItem value="off" id="mode-off" className="mt-0.5 shrink-0" />
                  <div className="flex min-w-0 flex-col gap-0">
                    <Label htmlFor="mode-off" className="cursor-pointer text-sm font-medium">
                      Paused
                    </Label>
                    <p className="text-xs leading-relaxed text-muted-foreground">Pause extension</p>
                  </div>
                </div>
              </RadioGroup>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="survey" className="mt-2 outline-none">
          <div className={TAB_PANEL_CLASS} aria-busy={isPolicySyncBusy || isTargetTabReloadBusy}>
            <div className="flex flex-col gap-3 pr-2">
              <div className="flex flex-col gap-1.5">
                <div className="flex min-h-[1.25rem] items-baseline justify-between gap-2">
                  <h2 className="text-sm font-semibold text-foreground">
                    Survey (<code className="text-[11px]">v3survey</code>)
                  </h2>
                  <PolicyPanelBusyHint
                    isPolicySyncBusy={isPolicySyncBusy}
                    isTargetTabReloadBusy={isTargetTabReloadBusy}
                  />
                </div>
                <div className="flex flex-col gap-1 text-xs leading-relaxed text-muted-foreground">
                  <p>
                    Microsoft may tie a short in-product survey to the{" "}
                    <code className="rounded-none bg-muted px-0.5 text-[11px] text-foreground">
                      v3survey
                    </code>{" "}
                    query flag on flow and run URLs when you use the classic designer.
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Hide</span> (default) always sets{" "}
                    <code className="rounded-none bg-muted px-0.5 text-[11px] text-foreground">
                      v3survey=false
                    </code>{" "}
                    when the extension rewrites a link.{" "}
                    <span className="font-medium text-foreground">Show</span> only applies when{" "}
                    <code className="rounded-none bg-muted px-0.5 text-[11px] text-foreground">
                      v3survey
                    </code>{" "}
                    is already on the URL: it is normalized to{" "}
                    <code className="rounded-none bg-muted px-0.5 text-[11px] text-foreground">
                      v3survey=true
                    </code>
                    . Nothing is added if the flag is missing.
                  </p>
                </div>
                <RadioGroup
                  className="flex flex-col gap-1.5"
                  aria-label="Survey visibility (v3survey)"
                  disabled={isPolicySyncBusy}
                  value={surveyMode}
                  onValueChange={(v) => {
                    if (v === "true" || v === "false") {
                      onSaveSurvey(v);
                    }
                  }}
                >
                  <div className={choiceRow(surveyMode === "false")}>
                    <RadioGroupItem value="false" id="survey-off" className="mt-0.5 shrink-0" />
                    <div className="flex min-w-0 flex-col gap-0">
                      <Label htmlFor="survey-off" className="cursor-pointer text-sm font-medium">
                        Hide <span className="text-muted-foreground">(default)</span>
                      </Label>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        Use{" "}
                        <code className="rounded-none bg-muted px-0.5 text-[11px] text-foreground">
                          v3survey=false
                        </code>{" "}
                        on rewrites so the survey prompt stays off.
                      </p>
                    </div>
                  </div>
                  <div className={choiceRow(surveyMode === "true")}>
                    <RadioGroupItem value="true" id="survey-on" className="mt-0.5 shrink-0" />
                    <div className="flex min-w-0 flex-col gap-0">
                      <Label htmlFor="survey-on" className="cursor-pointer text-sm font-medium">
                        Show
                      </Label>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        If the URL already has{" "}
                        <code className="rounded-none bg-muted px-0.5 text-[11px] text-foreground">
                          v3survey
                        </code>
                        , normalize it to{" "}
                        <code className="rounded-none bg-muted px-0.5 text-[11px] text-foreground">
                          true
                        </code>
                        . Does not add the flag when it is missing.
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="about" className="mt-2 outline-none">
          <div className={TAB_PANEL_CLASS}>
            <div className="pr-2">
              <Card className="bg-transparent">
                <CardHeader className="flex flex-col gap-1 p-3 pb-2">
                  <CardTitle className="text-sm">{EXTENSION_DISPLAY_NAME}</CardTitle>
                  <CardDescription className="text-xs leading-relaxed">
                    Aligns Microsoft Power Automate flow and run URLs with the classic or new
                    designer, optional <span className="font-medium text-foreground">v3survey</span>{" "}
                    Hide/Show from the Survey tab, and pause (no rewrites while the extension stays
                    installed).
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 p-3 pt-0 text-xs leading-relaxed text-muted-foreground">
                  <div className="flex flex-col gap-1.5">
                    <p className="flex items-center gap-2 font-medium text-foreground">
                      <Palette className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      Appearance
                    </p>
                    <p className="text-xs text-muted-foreground">
                      If nothing is saved yet, light or dark is chosen from your system theme. Your
                      choice below is saved on this device only.
                    </p>
                    <RadioGroup
                      className="flex flex-col gap-1.5"
                      aria-label="Popup color theme"
                      value={themePreference}
                      onValueChange={(v) => {
                        if (v === "light" || v === "dark") {
                          onSaveTheme(v);
                        }
                      }}
                    >
                      <div className={choiceRow(themePreference === "light")}>
                        <RadioGroupItem
                          value="light"
                          id="theme-light"
                          className="mt-0.5 shrink-0"
                        />
                        <Sun
                          className={cn(
                            "mt-0.5 h-4 w-4 shrink-0",
                            themePreference === "light" ? "text-primary" : "text-muted-foreground",
                          )}
                          aria-hidden
                        />
                        <div className="flex min-w-0 flex-col gap-0">
                          <Label
                            htmlFor="theme-light"
                            className="cursor-pointer text-sm font-medium"
                          >
                            Light
                          </Label>
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            Always light.
                          </p>
                        </div>
                      </div>
                      <div className={choiceRow(themePreference === "dark")}>
                        <RadioGroupItem value="dark" id="theme-dark" className="mt-0.5 shrink-0" />
                        <Moon
                          className={cn(
                            "mt-0.5 h-4 w-4 shrink-0",
                            themePreference === "dark" ? "text-primary" : "text-muted-foreground",
                          )}
                          aria-hidden
                        />
                        <div className="flex min-w-0 flex-col gap-0">
                          <Label
                            htmlFor="theme-dark"
                            className="cursor-pointer text-sm font-medium"
                          >
                            Dark
                          </Label>
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            Always dark.
                          </p>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>

                  <Separator className="bg-foreground/10" />

                  <p className="flex items-center gap-2 font-medium text-foreground">
                    <Workflow className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    How it works
                  </p>
                  <ul className="flex list-disc flex-col gap-1 pl-4">
                    <li>
                      Rewrites only URLs on Power Automate hosts whose path contains{" "}
                      <code className="rounded-none bg-muted px-0.5 text-[11px] text-foreground">
                        /flows/
                      </code>{" "}
                      or{" "}
                      <code className="rounded-none bg-muted px-0.5 text-[11px] text-foreground">
                        /runs/
                      </code>
                      , and only while enforcement is not paused.
                    </li>
                    <li>
                      Adjusts the{" "}
                      <code className="rounded-none bg-muted px-0.5 text-[11px] text-foreground">
                        v3
                      </code>{" "}
                      query flag to match your editor choice. The Survey tab sets{" "}
                      <code className="rounded-none bg-muted px-0.5 text-[11px] text-foreground">
                        v3survey
                      </code>
                      : <span className="font-medium text-foreground">Hide</span> (default) uses{" "}
                      <code className="rounded-none bg-muted px-0.5 text-[11px] text-foreground">
                        v3survey=false
                      </code>{" "}
                      on rewrites; <span className="font-medium text-foreground">Show</span> only
                      normalizes an existing flag to{" "}
                      <code className="rounded-none bg-muted px-0.5 text-[11px] text-foreground">
                        true
                      </code>{" "}
                      and never adds it when absent.
                    </li>
                    <li>
                      Uses layered enforcement: declarative net request rules, background navigation
                      listeners, and a content script for SPA-style navigations.
                    </li>
                    <li>
                      The toolbar icon shows a small badge:{" "}
                      <span className="font-medium text-foreground">C</span> for Classic or{" "}
                      <span className="font-medium text-foreground">N</span> for New Designer; the
                      badge is cleared while{" "}
                      <span className="font-medium text-foreground">Paused</span>.
                    </li>
                  </ul>
                  <p>
                    <a
                      className="inline-flex items-center gap-1.5 font-medium text-primary underline underline-offset-2"
                      href={SOURCE_REPO_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <GitBranch className="h-4 w-4 shrink-0" aria-hidden />
                      Source code on GitHub
                      <ExternalLink className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                    </a>
                  </p>

                  <Separator className="bg-foreground/10" />

                  <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                    <Package
                      className="h-3.5 w-3.5 shrink-0 translate-y-0.5 text-muted-foreground"
                      aria-hidden
                    />
                    <span className="font-medium text-foreground">Version:</span> {extensionVersion}
                  </p>
                  <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                    <span className="font-medium text-foreground">Developer:</span>
                    <a
                      className="inline-flex items-center gap-1.5 text-primary underline underline-offset-2"
                      href={DEVELOPER_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      {DEVELOPER_NAME}
                      <ExternalLink className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                    </a>
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
