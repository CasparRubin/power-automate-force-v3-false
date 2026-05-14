import { useCallback, useEffect, useRef, useState } from "react";
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
import { DEVELOPER_NAME, DEVELOPER_URL, SOURCE_REPO_URL } from "./about-meta";
import { reloadFocusedTargetTabIfApplicable } from "./reload-focused-target-tab";
import {
  applyThemeClassToDocument,
  DEFAULT_THEME_PREFERENCE,
  parseThemePreference,
  resolveIsDark,
  subscribePrefersColorScheme,
  type ThemePreference,
} from "./theme-preference";

type SurveyEnabledSync = "true" | "false";

/** Tab body: native scroll + `.popup-tab-scroll` themed scrollbar (see index.css). */
const TAB_PANEL_CLASS =
  "popup-tab-scroll min-h-40 max-h-72 w-full overflow-y-auto overflow-x-hidden pr-1 [scrollbar-gutter:stable]";

function readExtensionVersion(): string {
  if (typeof chrome !== "undefined" && chrome.runtime?.getManifest) {
    return chrome.runtime.getManifest().version;
  }
  return "—";
}

export default function App() {
  const [value, setValue] = useState<EnforcementPreference>(DEFAULT_ENFORCEMENT_PREFERENCE);
  const [surveyMode, setSurveyMode] = useState<SurveyEnabledSync>("false");
  const [themePreference, setThemePreference] = useState<ThemePreference>(DEFAULT_THEME_PREFERENCE);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [extensionVersion, setExtensionVersion] = useState<string>("");
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
        const theme = parseThemePreference(localResult[STORAGE_KEY_POPUP_THEME]);
        setThemePreference(theme);
        applyThemeClassToDocument(resolveIsDark(theme));
        setLoaded(true);
      })
      .catch(() => {
        if (!mountedRef.current) {
          return;
        }
        setValue(DEFAULT_ENFORCEMENT_PREFERENCE);
        setSurveyMode("false");
        setThemePreference(DEFAULT_THEME_PREFERENCE);
        applyThemeClassToDocument(resolveIsDark(DEFAULT_THEME_PREFERENCE));
        setLoaded(true);
      });
  }, []);

  useEffect(() => {
    applyThemeClassToDocument(resolveIsDark(themePreference));
    if (themePreference !== "system") {
      return;
    }
    const onSchemeChange = () => {
      applyThemeClassToDocument(resolveIsDark("system"));
    };
    return subscribePrefersColorScheme(onSchemeChange);
  }, [themePreference]);

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

  const onSaveTheme = useCallback((next: ThemePreference) => {
    setThemePreference(next);
    applyThemeClassToDocument(resolveIsDark(next));
    void chrome.storage.local.set({ [STORAGE_KEY_POPUP_THEME]: next });
  }, []);

  const onSave = useCallback(
    (next: EnforcementPreference) => {
      setValue(next);
      setStatus("Saving…");
      void (async () => {
        try {
          await chrome.storage.sync.set({ [STORAGE_KEY_ENFORCED_V3]: next });
          if (!mountedRef.current) {
            return;
          }
          setStatus("Saved.");
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
              : "Save failed. Check Chrome sync sign-in, then try again.";
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
      setStatus("Saving…");
      void (async () => {
        try {
          await chrome.storage.sync.set({ [STORAGE_KEY_V3SURVEY_ENABLED]: next });
          if (!mountedRef.current) {
            return;
          }
          setStatus("Saved.");
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
              : "Save failed. Check Chrome sync sign-in, then try again.";
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
    return <div className="px-3 py-5 text-sm text-muted-foreground">Loading…</div>;
  }

  const choiceRow = (selected: boolean) =>
    cn(
      "flex cursor-pointer items-start gap-2 rounded-none p-2 transition-colors",
      selected ? "bg-muted" : "hover:bg-muted/60",
    );

  return (
    <div className="flex w-[320px] flex-col gap-2 px-3 py-3 text-sm leading-snug text-foreground">
      <Tabs defaultValue="editor" className="flex flex-col gap-0">
        <TabsList className="grid h-auto w-full grid-cols-3 gap-0.5 bg-muted p-1 text-xs">
          <TabsTrigger value="editor" className="px-2 py-2 text-xs shadow-none">
            Editor
          </TabsTrigger>
          <TabsTrigger value="survey" className="px-2 py-2 text-xs shadow-none">
            Survey
          </TabsTrigger>
          <TabsTrigger value="about" className="px-2 py-2 text-xs shadow-none">
            About
          </TabsTrigger>
        </TabsList>

        <TabsContent value="editor" className="mt-2 outline-none">
          <div className={TAB_PANEL_CLASS}>
            <div className="flex flex-col gap-3 pr-2">
              <div className="flex flex-col gap-0.5">
                <h1 className="text-sm font-semibold tracking-tight text-foreground">
                  Editor preference
                </h1>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Flow and run links use the editor below. Paused stops fixes until you turn an
                  editor back on.
                </p>
              </div>

              <RadioGroup
                className="flex flex-col gap-1.5"
                aria-label="Editor for flow and run links"
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
                      Classic editor
                    </Label>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Always open classic, not new.
                    </p>
                  </div>
                </div>

                <div className={choiceRow(value === "true")}>
                  <RadioGroupItem value="true" id="mode-true" className="mt-0.5 shrink-0" />
                  <div className="flex min-w-0 flex-col gap-0">
                    <Label htmlFor="mode-true" className="cursor-pointer text-sm font-medium">
                      New designer
                    </Label>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Always open the new designer.
                    </p>
                  </div>
                </div>

                <div className={choiceRow(value === "off")}>
                  <RadioGroupItem value="off" id="mode-off" className="mt-0.5 shrink-0" />
                  <div className="flex min-w-0 flex-col gap-0">
                    <Label htmlFor="mode-off" className="cursor-pointer text-sm font-medium">
                      Paused
                    </Label>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      No link fixes. Extension stays installed.
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="survey" className="mt-2 outline-none">
          <div className={TAB_PANEL_CLASS}>
            <div className="flex flex-col gap-3 pr-2">
              <div className="flex flex-col gap-1.5">
                <h2 className="text-sm font-semibold text-foreground">Survey links</h2>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Optional. Turn on only if you need the survey flag on links. Leave off if you do
                  not need it.
                </p>
                <RadioGroup
                  className="flex flex-col gap-1.5"
                  aria-label="Survey flag on links"
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
                        Off
                      </Label>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        Default. Do not change survey links.
                      </p>
                    </div>
                  </div>
                  <div className={choiceRow(surveyMode === "true")}>
                    <RadioGroupItem value="true" id="survey-on" className="mt-0.5 shrink-0" />
                    <div className="flex min-w-0 flex-col gap-0">
                      <Label htmlFor="survey-on" className="cursor-pointer text-sm font-medium">
                        On
                      </Label>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        Add survey flag if it is missing.
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
                  <CardTitle className="text-sm">Power Automate: editor preference</CardTitle>
                  <CardDescription className="text-xs leading-relaxed">
                    Keeps Microsoft Power Automate flow and run links opening in the editor you
                    choose (classic or new designer), or lets you pause rewrites while the extension
                    stays installed.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 p-3 pt-0 text-xs leading-relaxed text-muted-foreground">
                  <div className="flex flex-col gap-1.5">
                    <p className="font-medium text-foreground">Appearance</p>
                    <p className="text-xs text-muted-foreground">
                      Default follows your system theme. If the browser cannot read it, dark mode is
                      used.
                    </p>
                    <RadioGroup
                      className="flex flex-col gap-1.5"
                      aria-label="Popup color theme"
                      value={themePreference}
                      onValueChange={(v) => {
                        if (v === "system" || v === "light" || v === "dark") {
                          onSaveTheme(v);
                        }
                      }}
                    >
                      <div className={choiceRow(themePreference === "system")}>
                        <RadioGroupItem
                          value="system"
                          id="theme-system"
                          className="mt-0.5 shrink-0"
                        />
                        <div className="flex min-w-0 flex-col gap-0">
                          <Label
                            htmlFor="theme-system"
                            className="cursor-pointer text-sm font-medium"
                          >
                            System
                          </Label>
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            Match light or dark with the OS.
                          </p>
                        </div>
                      </div>
                      <div className={choiceRow(themePreference === "light")}>
                        <RadioGroupItem
                          value="light"
                          id="theme-light"
                          className="mt-0.5 shrink-0"
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

                  <p>
                    <span className="font-medium text-foreground">Version:</span> {extensionVersion}
                    <span className="text-foreground"> · </span>
                    <span className="font-medium text-foreground">Build:</span> {__BUILD_ID__}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Developer:</span>{" "}
                    <a
                      className="text-primary underline underline-offset-2"
                      href={DEVELOPER_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {DEVELOPER_NAME}
                    </a>
                  </p>
                  <Separator className="bg-foreground/10" />
                  <p className="font-medium text-foreground">How it works</p>
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
                      query flag to match your editor choice. Optional{" "}
                      <code className="rounded-none bg-muted px-0.5 text-[11px] text-foreground">
                        v3survey
                      </code>{" "}
                      handling lives on the Survey tab.
                    </li>
                    <li>
                      Uses layered enforcement: declarative net request rules, background navigation
                      listeners, and a content script for SPA-style navigations.
                    </li>
                  </ul>
                  <p>
                    <a
                      className="font-medium text-primary underline underline-offset-2"
                      href={SOURCE_REPO_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Source code on GitHub
                    </a>
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {status ? <p className="text-xs text-muted-foreground">{status}</p> : null}
    </div>
  );
}
