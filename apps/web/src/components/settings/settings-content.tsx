"use client";

import type React from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import {
  BellRing,
  BadgeCheck,
  Building2,
  Camera,
  Clock3,
  Eye,
  Loader2,
  LogOut,
  Mail,
  Save,
  Settings,
  Shield,
  Sparkles,
  Sun,
  User,
  UserPlus,
} from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  BounceSidebar,
  type BounceSidebarItem,
} from "@/components/ui/bounce-sidebar";
import { DurationControl } from "@/components/shared/duration-control";
import {
  PageContainer,
  ProductPageHeader,
} from "@/components/shared/product-layout";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { showToast } from "@/components/shared/toast";
import { InfoHint } from "@/components/settings/info-hint";
import { VoiceSettings } from "@/components/settings/voice-settings";
import { NotificationPreferencesPanel } from "@/components/notifications/notification-preferences-panel";
import type {
  NotificationPreferenceView,
  NotificationUiOperations,
} from "@/components/notifications/contracts";
import {
  claimOrganizationJoinCode,
  saveSettingsWithFeedback as saveSettings,
} from "@/app/[locale]/(protected)/settings/actions";
import { updateLeaderboardPrivacySettings } from "@/app/actions/leaderboards";
import {
  AI_DIFFICULTY_OPTIONS,
  SETTINGS_DRAFT_STORAGE_KEY,
  type SettingsDraft,
  type SettingsDraftSnapshot,
  type SettingsLocale,
  type SettingsProfilePrivacy,
  buildSavedSettingsDraft,
  buildSettingsDraft,
} from "@/lib/settings";
import { notifyAnalyticsConsentChanged } from "@/lib/analytics-consent";
import {
  normalizeSettingsHandleDraft,
  normalizeSettingsStatusDraft,
} from "@/lib/profile-social/ui-model";
import { coercePracticeLanguage } from "@/lib/practice-language";
import {
  SOLO_PREP_DURATION,
  SOLO_SPEECH_DURATION,
} from "@/lib/practice-durations";
import { coerceVoiceForLanguage } from "@/lib/tts-voices";
import { createClient } from "@/lib/supabase/client";
import { resetPracticeClientStateForAuthChange } from "@/lib/practice-client-state";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/database";
import type {
  LeaderboardDisplayMode,
  LeaderboardPrivacySettings,
  OrganizationAffiliationSummary,
} from "@/lib/leaderboards/types";
import {
  formatOrganizationJoinCode,
  isUsableOrganizationJoinCode,
} from "@/lib/organizations/model";

interface SettingsContentProps {
  profile: Profile | null;
  settingsDataError?: "profile" | "privacy" | null;
  profilePrivacySettings?: SettingsProfilePrivacy | null;
  userEmail: string;
  currentLocale: SettingsLocale;
  organizationAffiliation?: OrganizationAffiliationSummary | null;
  organizationAffiliationStatus?: "ready" | "absent" | "unavailable";
  organizationJoinCodesEnabled?: boolean;
  leaderboardPrivacyControlsEnabled?: boolean;
  leaderboardPrivacySettings?: LeaderboardPrivacySettings;
  leaderboardPrivacySettingsStatus?: "ready" | "absent" | "unavailable";
  notificationPreferences?: NotificationPreferenceView[];
  notificationPreferenceOperations?: Pick<
    NotificationUiOperations,
    "getPreferences" | "updatePreferences"
  >;
  notificationPreferenceReviewRequired?: boolean;
}

type SettingsSectionId =
  | "profile"
  | "practice"
  | "voice"
  | "privacy"
  | "discovery"
  | "leaderboards"
  | "notifications"
  | "appearance"
  | "organization"
  | "account";

interface SettingsSectionNavItem {
  id: SettingsSectionId;
  label: string;
  group: string;
  icon: React.ReactNode;
}

function readStoredSnapshot() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_DRAFT_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as SettingsDraftSnapshot;
  } catch {
    return null;
  }
}

function isRenderableAvatar(avatarUrl: string) {
  return (
    avatarUrl.startsWith("http://") ||
    avatarUrl.startsWith("https://") ||
    avatarUrl.startsWith("/") ||
    avatarUrl.startsWith("data:image/")
  );
}

function formatInitials(name: string) {
  const tokens = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);

  if (tokens.length === 0) {
    return "DL";
  }

  return tokens.map((token) => token[0]?.toUpperCase() ?? "").join("");
}

function SectionPanel(props: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const { id, title, description, children } = props;

  return (
    <section
      id={id}
      data-settings-section-id={id}
      aria-labelledby={`${id}-settings-title`}
      aria-describedby={description ? `${id}-settings-description` : undefined}
      className="scroll-mt-28 rounded-xl border border-outline-variant bg-surface shadow-none dark:border-outline-variant/70 dark:bg-surface/95"
    >
      <div className="border-b border-outline-variant/60 px-4 pb-3 pt-4">
        <h2
          id={`${id}-settings-title`}
          className="text-base font-semibold text-on-surface dark:text-on-surface"
        >
          {title}
        </h2>
        {description ? (
          <p id={`${id}-settings-description`} className="sr-only">
            {description}
          </p>
        ) : null}
      </div>
      <div className="space-y-0 pb-3">{children}</div>
    </section>
  );
}

function SettingLabel({
  children,
  info,
}: {
  children: React.ReactNode;
  info?: string;
}) {
  return (
    <label className="mb-2 flex items-center gap-1.5 text-sm font-medium text-on-surface dark:text-on-surface">
      <span>{children}</span>
      {info ? <InfoHint label={info} /> : null}
    </label>
  );
}

function SettingRow(props: {
  title: string;
  description?: string;
  children: React.ReactNode;
  align?: "center" | "start";
}) {
  const { title, description, children, align = "center" } = props;

  return (
    <div
      className={cn(
        "grid min-h-11 gap-4 border-b border-outline-variant/40 px-4 py-2.5 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_minmax(220px,300px)]",
        align === "center" ? "sm:items-center" : "sm:items-start",
      )}
    >
      <div className="min-w-0 pr-2">
        <p className="flex items-center gap-1.5 text-sm font-medium text-on-surface dark:text-on-surface">
          <span>{title}</span>
          {description ? <InfoHint label={description} /> : null}
        </p>
      </div>
      <div className="min-w-0 sm:justify-self-end">{children}</div>
    </div>
  );
}

function ToggleControl(props: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <Switch
      checked={props.checked}
      onCheckedChange={props.onCheckedChange}
      aria-label={props.label}
    />
  );
}

const VISIBILITY_OPTIONS: Array<{
  value: SettingsDraft["profileVisibility"];
  labelKey:
    | "visibility_options.only_me"
    | "visibility_options.friends"
    | "visibility_options.everyone";
}> = [
  {
    value: "private",
    labelKey: "visibility_options.only_me",
  },
  {
    value: "connections",
    labelKey: "visibility_options.friends",
  },
  {
    value: "public",
    labelKey: "visibility_options.everyone",
  },
];

const INPUT_CLASSNAME =
  "h-8 w-full rounded-control border border-outline-variant bg-surface-container-lowest px-3 type-label font-medium text-on-surface outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-3 focus:ring-primary/15 dark:border-outline-variant/70 dark:bg-surface-container-lowest dark:text-on-surface";

const SELECT_CLASSNAME =
  "rounded-lg border-outline-variant bg-white text-on-surface focus:border-primary focus-visible:ring-primary/20 dark:border-outline-variant/70 dark:bg-surface-container-lowest dark:text-on-surface";

type SettingsScrollContainer = HTMLElement | Window;

function isWindowScrollContainer(
  container: SettingsScrollContainer,
): container is Window {
  return container === window;
}

function getSettingsScrollContainer(
  element: HTMLElement | null,
): SettingsScrollContainer {
  let current = element?.parentElement ?? null;

  while (current && current !== document.body) {
    const style = window.getComputedStyle(current);
    const canScroll = current.scrollHeight > current.clientHeight + 2;
    const overflowAllowsScroll =
      style.overflowY === "auto" ||
      style.overflowY === "scroll" ||
      style.overflowY === "overlay";

    if (canScroll && overflowAllowsScroll) {
      return current;
    }

    current = current.parentElement;
  }

  return window;
}

function getScrollContainerTop(container: SettingsScrollContainer) {
  return isWindowScrollContainer(container)
    ? window.scrollY
    : container.scrollTop;
}

function getScrollContainerHeight(container: SettingsScrollContainer) {
  return isWindowScrollContainer(container)
    ? window.innerHeight
    : container.clientHeight;
}

function getScrollContainerMaxTop(container: SettingsScrollContainer) {
  if (isWindowScrollContainer(container)) {
    return Math.max(
      0,
      document.documentElement.scrollHeight - window.innerHeight,
    );
  }

  return Math.max(0, container.scrollHeight - container.clientHeight);
}

function getElementTopInScrollContainer(
  element: HTMLElement,
  container: SettingsScrollContainer,
) {
  if (isWindowScrollContainer(container)) {
    return element.getBoundingClientRect().top + window.scrollY;
  }

  const containerRect = container.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  return elementRect.top - containerRect.top + container.scrollTop;
}

function coerceSettingsVisibilityDraft(
  value: unknown,
  fallback: SettingsDraft["profileVisibility"],
): SettingsDraft["profileVisibility"] {
  if (value === "trusted") {
    return "connections";
  }

  return VISIBILITY_OPTIONS.some((option) => option.value === value)
    ? (value as SettingsDraft["profileVisibility"])
    : fallback;
}

async function fileToAvatarDataUrl(file: File) {
  const imageUrl = URL.createObjectURL(file);

  try {
    const image = new Image();
    image.src = imageUrl;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = reject;
    });

    const size = Math.min(image.width, image.height);
    const sourceX = Math.max(0, (image.width - size) / 2);
    const sourceY = Math.max(0, (image.height - size) / 2);
    const outputSize = 320;
    const canvas = document.createElement("canvas");
    canvas.width = outputSize;
    canvas.height = outputSize;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Unable to process avatar image");
    }

    context.drawImage(
      image,
      sourceX,
      sourceY,
      size,
      size,
      0,
      0,
      outputSize,
      outputSize,
    );

    return canvas.toDataURL("image/jpeg", 0.86);
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function AvatarPreview(props: {
  avatarUrl: string;
  displayName: string;
  fallbackLabel: string;
  sizeClassName?: string;
  textClassName?: string;
}) {
  const {
    avatarUrl,
    displayName,
    fallbackLabel,
    sizeClassName = "h-20 w-20",
    textClassName = "text-xl",
  } = props;
  const initials = formatInitials(displayName);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-full border border-outline-variant bg-surface-container shadow-inner dark:border-outline-variant/70 dark:bg-primary-container",
        sizeClassName,
      )}
    >
      {isRenderableAvatar(avatarUrl) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt={displayName || fallbackLabel}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,_#00B8D9,_#0788A0)] font-semibold text-white">
          <span className={textClassName}>{initials}</span>
        </div>
      )}
    </div>
  );
}

function SettingsContentEditor({
  profile,
  settingsDataError,
  profilePrivacySettings,
  userEmail,
  currentLocale,
  organizationAffiliation,
  organizationAffiliationStatus = organizationAffiliation ? "ready" : "absent",
  organizationJoinCodesEnabled = false,
  leaderboardPrivacyControlsEnabled = false,
  leaderboardPrivacySettings,
  leaderboardPrivacySettingsStatus = leaderboardPrivacySettings
    ? "ready"
    : "absent",
  notificationPreferences,
  notificationPreferenceOperations,
  notificationPreferenceReviewRequired = false,
}: SettingsContentProps) {
  const t = useTranslations("settings");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isSaving, startSavingTransition] = useTransition();
  const [isOrganizationPending, startOrganizationTransition] = useTransition();
  const [isLeaderboardPrivacyPending, startLeaderboardPrivacyTransition] =
    useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [isAvatarProcessing, setIsAvatarProcessing] = useState(false);
  const [organizationCode, setOrganizationCode] = useState("");
  const [leaderboardPrivacy, setLeaderboardPrivacy] =
    useState<LeaderboardPrivacySettings | null>(
      leaderboardPrivacySettings ?? null,
    );

  useEffect(() => {
    // A retry may supply the preferences after the editor first mounted without them.
    if (!leaderboardPrivacy && leaderboardPrivacySettings) {
      setLeaderboardPrivacy(leaderboardPrivacySettings);
    }
  }, [leaderboardPrivacy, leaderboardPrivacySettings]);

  const serverSavedDraft = useMemo(
    () =>
      buildSavedSettingsDraft({
        displayName: profile?.display_name,
        handle: profile?.handle,
        profileStatus: profile?.profile_status,
        avatarUrl: profile?.avatar_url,
        profilePrivacy: profilePrivacySettings,
        preferences:
          (profile?.preferences as Record<string, unknown> | null) ?? {},
        currentLocale,
      }),
    [currentLocale, profile, profilePrivacySettings],
  );

  const serverDraft = useMemo(
    () =>
      buildSettingsDraft({
        displayName: profile?.display_name,
        handle: profile?.handle,
        profileStatus: profile?.profile_status,
        avatarUrl: profile?.avatar_url,
        profilePrivacy: profilePrivacySettings,
        preferences:
          (profile?.preferences as Record<string, unknown> | null) ?? {},
        currentLocale,
      }),
    [currentLocale, profile, profilePrivacySettings],
  );

  const userId = profile?.id ?? "";
  const savedSignature = useMemo(
    () => JSON.stringify(serverSavedDraft),
    [serverSavedDraft],
  );
  const [localSavedDraft, setLocalSavedDraft] = useState<SettingsDraft | null>(
    null,
  );
  const [draft, setDraft] = useState<SettingsDraft>(serverDraft);
  const [hasHydratedStoredDraft, setHasHydratedStoredDraft] = useState(false);

  useEffect(() => {
    const snapshot = readStoredSnapshot();

    if (
      snapshot &&
      snapshot.userId === userId &&
      JSON.stringify(snapshot.saved) === savedSignature
    ) {
      const practiceLanguage = coercePracticeLanguage(
        snapshot.draft.preferredLocale,
      );
      setDraft({
        ...snapshot.draft,
        handle:
          typeof snapshot.draft.handle === "string"
            ? snapshot.draft.handle
            : serverDraft.handle,
        profileStatus:
          typeof snapshot.draft.profileStatus === "string"
            ? snapshot.draft.profileStatus
            : serverDraft.profileStatus,
        profileVisibility:
          typeof snapshot.draft.profileVisibility === "string"
            ? coerceSettingsVisibilityDraft(
                snapshot.draft.profileVisibility,
                serverDraft.profileVisibility,
              )
            : serverDraft.profileVisibility,
        analyticsVisibility:
          typeof snapshot.draft.analyticsVisibility === "string"
            ? coerceSettingsVisibilityDraft(
                snapshot.draft.analyticsVisibility,
                serverDraft.analyticsVisibility,
              )
            : serverDraft.analyticsVisibility,
        activitiesVisibility:
          typeof snapshot.draft.activitiesVisibility === "string"
            ? coerceSettingsVisibilityDraft(
                snapshot.draft.activitiesVisibility,
                serverDraft.activitiesVisibility,
              )
            : serverDraft.activitiesVisibility,
        achievementsVisibility:
          typeof snapshot.draft.achievementsVisibility === "string"
            ? coerceSettingsVisibilityDraft(
                snapshot.draft.achievementsVisibility,
                serverDraft.achievementsVisibility,
              )
            : serverDraft.achievementsVisibility,
        organizationVisibility:
          typeof snapshot.draft.organizationVisibility === "string"
            ? coerceSettingsVisibilityDraft(
                snapshot.draft.organizationVisibility,
                serverDraft.organizationVisibility,
              )
            : serverDraft.organizationVisibility,
        allowConnectionRequests:
          typeof snapshot.draft.allowConnectionRequests === "boolean"
            ? snapshot.draft.allowConnectionRequests
            : serverDraft.allowConnectionRequests,
        searchableByHandle:
          typeof snapshot.draft.searchableByHandle === "boolean"
            ? snapshot.draft.searchableByHandle
            : serverDraft.searchableByHandle,
        friendCodeDiscoveryEnabled: true,
        practiceLanguage,
        ttsVoice: coerceVoiceForLanguage(
          snapshot.draft.ttsVoice,
          practiceLanguage,
        ),
        smartFeaturePopups:
          typeof snapshot.draft.smartFeaturePopups === "boolean"
            ? snapshot.draft.smartFeaturePopups
            : serverDraft.smartFeaturePopups,
        analyticsCookiesEnabled: serverDraft.analyticsCookiesEnabled,
      });
    }

    setHasHydratedStoredDraft(true);
  }, [savedSignature, serverDraft, userId]);

  const effectiveSavedDraft =
    localSavedDraft && JSON.stringify(localSavedDraft) !== savedSignature
      ? localSavedDraft
      : serverSavedDraft;
  const draftSignature = useMemo(() => JSON.stringify(draft), [draft]);
  const savedDraftSignature = useMemo(
    () => JSON.stringify(effectiveSavedDraft),
    [effectiveSavedDraft],
  );
  const isDirty = draftSignature !== savedDraftSignature;
  const profilePreviewHref = effectiveSavedDraft.handle
    ? `/profile/${effectiveSavedDraft.handle}?preview=public`
    : "/profile?preview=public";
  const settingsSections = useMemo<SettingsSectionNavItem[]>(
    () => [
      {
        id: "profile",
        label: t("sections.profile"),
        group: t("sections.group_account"),
        icon: <User className="h-4 w-4" />,
      },
      {
        id: "practice",
        label: t("sections.practice"),
        group: t("sections.group_preferences"),
        icon: <Clock3 className="h-4 w-4" />,
      },
      {
        id: "voice",
        label: t("sections.voice"),
        group: t("sections.group_preferences"),
        icon: <Sparkles className="h-4 w-4" />,
      },
      {
        id: "privacy",
        label: t("sections.privacy"),
        group: t("sections.group_safety"),
        icon: <Shield className="h-4 w-4" />,
      },
      {
        id: "discovery",
        label: t("sections.discovery"),
        group: t("sections.group_safety"),
        icon: <UserPlus className="h-4 w-4" />,
      },
      ...(leaderboardPrivacyControlsEnabled &&
      (leaderboardPrivacy || leaderboardPrivacySettingsStatus === "unavailable")
        ? [
            {
              id: "leaderboards" as const,
              label: t("sections.leaderboards"),
              group: t("sections.group_safety"),
              icon: <BadgeCheck className="h-4 w-4" />,
            },
          ]
        : []),
      {
        id: "notifications",
        label: t("sections.notifications"),
        group: t("sections.group_experience"),
        icon: <BellRing className="h-4 w-4" />,
      },
      {
        id: "appearance",
        label: t("sections.appearance"),
        group: t("sections.group_experience"),
        icon: <Sun className="h-4 w-4" />,
      },
      {
        id: "organization",
        label: t("sections.organization"),
        group: t("sections.group_account"),
        icon: <Building2 className="h-4 w-4" />,
      },
      {
        id: "account",
        label: t("sections.account"),
        group: t("sections.group_account"),
        icon: <LogOut className="h-4 w-4" />,
      },
    ],
    [
      leaderboardPrivacy,
      leaderboardPrivacyControlsEnabled,
      leaderboardPrivacySettingsStatus,
      t,
    ],
  );
  const settingsSectionGroups = useMemo(() => {
    const groups: Array<{
      group: string;
      sections: SettingsSectionNavItem[];
    }> = [];

    for (const section of settingsSections) {
      const previousGroup = groups[groups.length - 1];
      if (previousGroup?.group === section.group) {
        previousGroup.sections.push(section);
      } else {
        groups.push({ group: section.group, sections: [section] });
      }
    }

    return groups;
  }, [settingsSections]);
  const bounceSidebarNavigation = useMemo(() => {
    const items: BounceSidebarItem[] = [];
    const sectionIds: Array<SettingsSectionId | null> = [];

    for (const group of settingsSectionGroups) {
      items.push({ label: group.group, heading: true });
      sectionIds.push(null);

      for (const section of group.sections) {
        items.push({ label: section.label });
        sectionIds.push(section.id);
      }
    }

    return { items, sectionIds };
  }, [settingsSectionGroups]);
  const [activeSection, setActiveSection] =
    useState<SettingsSectionId>("profile");
  const activeBounceSidebarIndex = Math.max(
    0,
    bounceSidebarNavigation.sectionIds.indexOf(activeSection),
  );
  const activeBounceSidebarItem =
    bounceSidebarNavigation.items[activeBounceSidebarIndex];
  const activeBounceSidebarLabel =
    typeof activeBounceSidebarItem === "string"
      ? activeBounceSidebarItem
      : activeBounceSidebarItem?.label;
  const manualActiveSectionRef = useRef<SettingsSectionId | null>(null);
  const getSectionElement = useCallback((sectionId: SettingsSectionId) => {
    return (
      rootRef.current?.querySelector<HTMLElement>(
        `[data-settings-section-id="${sectionId}"]`,
      ) ?? null
    );
  }, []);

  useEffect(() => {
    if (
      !hasHydratedStoredDraft ||
      !userId ||
      settingsDataError ||
      typeof window === "undefined"
    ) {
      return;
    }

    const snapshot: SettingsDraftSnapshot = {
      userId,
      draft,
      saved: effectiveSavedDraft,
    };

    window.localStorage.setItem(
      SETTINGS_DRAFT_STORAGE_KEY,
      JSON.stringify(snapshot),
    );
  }, [
    draft,
    effectiveSavedDraft,
    hasHydratedStoredDraft,
    settingsDataError,
    userId,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let frame = 0;
    const firstSectionElement = getSectionElement(settingsSections[0].id);
    const scrollContainer = getSettingsScrollContainer(firstSectionElement);

    function updateActiveSection() {
      frame = 0;
      const manualActiveSection = manualActiveSectionRef.current;
      const containerHeight = getScrollContainerHeight(scrollContainer);
      const containerRect = isWindowScrollContainer(scrollContainer)
        ? { top: 0, bottom: window.innerHeight }
        : scrollContainer.getBoundingClientRect();

      if (manualActiveSection) {
        const manualElement = getSectionElement(manualActiveSection);
        const manualRect = manualElement?.getBoundingClientRect();
        const visibleHeight = manualRect
          ? Math.min(manualRect.bottom, containerRect.bottom) -
            Math.max(manualRect.top, containerRect.top)
          : 0;

        if (
          manualRect &&
          visibleHeight > Math.min(manualRect.height, containerHeight) * 0.12
        ) {
          setActiveSection(manualActiveSection);
          return;
        }
      }

      manualActiveSectionRef.current = null;
      const scrollTop = getScrollContainerTop(scrollContainer);
      const maxTop = getScrollContainerMaxTop(scrollContainer);
      if (scrollTop >= maxTop - 2) {
        for (const section of [...settingsSections].reverse()) {
          const element = getSectionElement(section.id);
          if (!element) continue;

          const rect = element.getBoundingClientRect();
          if (
            rect.bottom > containerRect.top + 8 &&
            rect.top < containerRect.bottom - 8
          ) {
            setActiveSection(section.id);
            return;
          }
        }
      }

      const anchorY = scrollTop + Math.min(containerHeight * 0.28, 240);
      let nextSection = settingsSections[0].id;

      for (const section of settingsSections) {
        const element = getSectionElement(section.id);
        if (!element) continue;

        const sectionTop = getElementTopInScrollContainer(
          element,
          scrollContainer,
        );
        if (sectionTop <= anchorY + 1) {
          nextSection = section.id;
          continue;
        }

        break;
      }

      setActiveSection(nextSection);
    }

    function scheduleActiveSectionUpdate() {
      if (frame) return;
      frame = window.requestAnimationFrame(updateActiveSection);
    }

    function clearManualActiveSection() {
      if (!manualActiveSectionRef.current) return;
      manualActiveSectionRef.current = null;
      scheduleActiveSectionUpdate();
    }

    updateActiveSection();
    scrollContainer.addEventListener("scroll", scheduleActiveSectionUpdate, {
      passive: true,
    });
    window.addEventListener("wheel", clearManualActiveSection, {
      passive: true,
    });
    window.addEventListener("touchmove", clearManualActiveSection, {
      passive: true,
    });
    window.addEventListener("keydown", clearManualActiveSection);
    window.addEventListener("resize", scheduleActiveSectionUpdate);

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      scrollContainer.removeEventListener(
        "scroll",
        scheduleActiveSectionUpdate,
      );
      window.removeEventListener("wheel", clearManualActiveSection);
      window.removeEventListener("touchmove", clearManualActiveSection);
      window.removeEventListener("keydown", clearManualActiveSection);
      window.removeEventListener("resize", scheduleActiveSectionUpdate);
    };
  }, [getSectionElement, settingsSections]);

  function scrollToSection(sectionId: SettingsSectionId) {
    const element = getSectionElement(sectionId);
    if (!element || typeof window === "undefined") {
      return;
    }

    const scrollContainer = getSettingsScrollContainer(element);
    const offset = window.innerWidth >= 1024 ? 24 : 92;
    const rawTop =
      getElementTopInScrollContainer(element, scrollContainer) - offset;
    const top = Math.min(
      Math.max(0, rawTop),
      getScrollContainerMaxTop(scrollContainer),
    );

    let ancestor = isWindowScrollContainer(scrollContainer)
      ? null
      : scrollContainer.parentElement;
    while (ancestor && ancestor !== document.body) {
      const style = window.getComputedStyle(ancestor);
      if (style.overflowY === "hidden") {
        ancestor.scrollTop = 0;
      }
      ancestor = ancestor.parentElement;
    }

    manualActiveSectionRef.current = sectionId;
    setActiveSection(sectionId);
    scrollContainer.scrollTo({ top, behavior: "auto" });
  }

  function updateDraft<K extends keyof SettingsDraft>(
    key: K,
    value: SettingsDraft[K],
  ) {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updatePreferredLocale(locale: SettingsLocale) {
    const practiceLanguage = coercePracticeLanguage(locale);
    setDraft((current) => ({
      ...current,
      preferredLocale: locale,
      practiceLanguage,
      ttsVoice: coerceVoiceForLanguage(current.ttsVoice, practiceLanguage),
    }));
  }

  async function handleAvatarFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      showToast(t("toast.avatar_invalid"), "warning");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      showToast(t("toast.avatar_too_large"), "warning");
      return;
    }

    setIsAvatarProcessing(true);
    try {
      const avatarUrl = await fileToAvatarDataUrl(file);
      updateDraft("avatarUrl", avatarUrl);
    } catch {
      showToast(t("toast.avatar_invalid"), "error");
    } finally {
      setIsAvatarProcessing(false);
    }
  }

  function handleSave() {
    startSavingTransition(async () => {
      try {
        const result = await saveSettings(draft);
        if ("error" in result && result.error) {
          showToast(t(`toast.${result.error}`), "error");
          return;
        }
        setLocalSavedDraft(result.saved);
        setDraft(result.saved);
        notifyAnalyticsConsentChanged();
        router.refresh();
        showToast(t("toast.saved"), "success");
        if (draft.preferredLocale !== currentLocale) {
          const nextParams = new URLSearchParams(searchParams.toString());
          const nextPath = `${pathname}${nextParams.toString() ? `?${nextParams.toString()}` : ""}${typeof window !== "undefined" ? window.location.hash : ""}`;
          router.replace(nextPath, { locale: draft.preferredLocale });
        }
      } catch {
        showToast(t("toast.save_error"), "error");
      }
    });
  }

  function handleClaimOrganizationCode() {
    startOrganizationTransition(async () => {
      try {
        const result = await claimOrganizationJoinCode(organizationCode);
        if (result.status === "accepted") {
          setOrganizationCode("");
          router.refresh();
          showToast(t("rows.join_accepted"), "success");
          return;
        }

        const joinMessageKey = {
          auth_required: "rows.join_auth_required",
          malformed: "rows.join_malformed",
          not_found: "rows.join_not_found",
          expired: "rows.join_expired",
          revoked: "rows.join_revoked",
          already_redeemed: "rows.join_already_redeemed",
          already_in_org: "rows.join_already_in_org",
        }[result.status];
        showToast(
          joinMessageKey ? t(joinMessageKey) : t("rows.join_not_found"),
          "warning",
        );
      } catch {
        showToast(t("toast.organization_join_error"), "error");
      }
    });
  }

  function updateLeaderboardPrivacyDraft(
    patch: Partial<
      Pick<
        LeaderboardPrivacySettings,
        | "displayMode"
        | "allowKudos"
        | "showOrganization"
        | "participateInLeaderboards"
      >
    >,
  ) {
    if (!leaderboardPrivacy) return;
    setLeaderboardPrivacy({
      ...leaderboardPrivacy,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
  }

  function handleSaveLeaderboardPrivacy() {
    if (!leaderboardPrivacy) return;

    startLeaderboardPrivacyTransition(async () => {
      try {
        const saved = await updateLeaderboardPrivacySettings({
          displayMode: leaderboardPrivacy.displayMode,
          allowKudos: leaderboardPrivacy.allowKudos,
          showOrganization: leaderboardPrivacy.showOrganization,
          participateInLeaderboards:
            leaderboardPrivacy.participateInLeaderboards,
        });
        setLeaderboardPrivacy(saved);
        showToast(t("toast.leaderboard_saved"), "success");
      } catch {
        showToast(t("toast.leaderboard_error"), "error");
      }
    });
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    resetPracticeClientStateForAuthChange();
    router.push("/");
  }

  return (
    <div
      ref={rootRef}
      className="min-h-full bg-transparent text-on-surface dark:bg-transparent dark:text-on-surface"
    >
      <PageContainer size="wide" className="py-5">
        <ProductPageHeader
          title={t("headline")}
          icon={<Settings />}
          className="mb-4"
          actions={
            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-on-surface-variant sm:inline">
                {isDirty ? t("status.unsaved") : t("status.saved")}
              </span>
              <Button
                type="button"
                onClick={handleSave}
                disabled={!isDirty || isSaving}
                className="gap-2 rounded-lg bg-primary px-4 text-white shadow-token-primary hover:bg-primary-dim"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {t("save_changes")}
              </Button>
            </div>
          }
        />

        <div className="sticky top-0 z-20 -mx-4 mb-5 border-y border-outline-variant bg-background/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:hidden">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {settingsSections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => scrollToSection(section.id)}
                aria-current={activeSection === section.id ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
                  activeSection === section.id
                    ? "bg-primary-container text-primary-dim"
                    : "text-on-surface-variant hover:bg-white hover:text-on-surface",
                )}
              >
                {section.icon}
                {section.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid min-w-0 gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <nav
              aria-label={t("headline")}
              className="sticky top-6 rounded-xl border border-outline-variant bg-surface p-4 shadow-none dark:border-outline-variant/70 dark:bg-surface/95"
            >
              <p className="sr-only" aria-live="polite">
                {activeBounceSidebarLabel}
              </p>
              <BounceSidebar
                items={bounceSidebarNavigation.items}
                value={activeBounceSidebarIndex}
                onChange={(index) => {
                  const sectionId = bounceSidebarNavigation.sectionIds[index];
                  if (sectionId) scrollToSection(sectionId);
                }}
                dotColor="var(--primary)"
              />
            </nav>
          </aside>

          <main className="min-w-0 space-y-5 pb-16">
            {settingsDataError ? (
              <p
                role="alert"
                className="rounded-control border border-warning-container bg-warning-container px-4 py-3 type-body text-on-surface"
              >
                {t("rows.settings_unavailable")}
              </p>
            ) : null}
            <SectionPanel
              id="profile"
              title={t("sections.profile")}
              description={t("sections.profile_description")}
            >
              <div className="px-5 py-5">
                <div className="mb-5 flex justify-end">
                  <Link
                    href={profilePreviewHref}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-outline-variant bg-white px-3 text-sm font-semibold text-on-surface transition hover:bg-background dark:border-outline-variant/70 dark:bg-surface-container-lowest dark:text-on-surface"
                  >
                    <Eye className="h-4 w-4 text-primary" />
                    {t("rows.preview_profile")}
                  </Link>
                </div>
                <div className="grid gap-5 lg:grid-cols-[104px_minmax(0,1fr)]">
                  <div className="relative h-fit w-fit">
                    <AvatarPreview
                      avatarUrl={draft.avatarUrl}
                      displayName={draft.displayName}
                      fallbackLabel={t("fields.avatar")}
                      sizeClassName="h-24 w-24"
                      textClassName="text-2xl"
                    />
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      capture="user"
                      onChange={handleAvatarFileChange}
                      className="sr-only"
                    />
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={isAvatarProcessing}
                      aria-label={t("avatar_upload")}
                      className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-primary text-white shadow-token-primary transition hover:bg-primary-dim disabled:opacity-70"
                    >
                      {isAvatarProcessing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Camera className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  <div className="min-w-0 space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <SettingLabel>{t("fields.display_name")}</SettingLabel>
                        <input
                          type="text"
                          value={draft.displayName}
                          onChange={(event) =>
                            updateDraft("displayName", event.target.value)
                          }
                          placeholder={t("fields.display_name_placeholder")}
                          className={INPUT_CLASSNAME}
                        />
                      </div>
                      <div>
                        <SettingLabel>{t("rows.email")}</SettingLabel>
                        <div className="flex h-11 items-center gap-2 rounded-lg border border-outline-variant bg-background px-3 text-sm font-medium text-on-surface-variant dark:border-outline-variant/70 dark:bg-surface-container-lowest">
                          <Mail className="h-4 w-4 shrink-0" />
                          <span className="truncate">{userEmail}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)]">
                      <div>
                        <SettingLabel info={t("fields.handle_helper")}>
                          {t("fields.handle")}
                        </SettingLabel>
                        <div className="flex h-11 items-center rounded-lg border border-outline-variant bg-white text-sm font-medium text-on-surface transition-colors focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/15 dark:border-outline-variant/70 dark:bg-surface-container-lowest dark:text-on-surface">
                          <span className="pl-3 pr-1 text-on-surface-variant">
                            @
                          </span>
                          <input
                            type="text"
                            value={draft.handle}
                            onChange={(event) =>
                              updateDraft(
                                "handle",
                                normalizeSettingsHandleDraft(
                                  event.target.value,
                                ),
                              )
                            }
                            placeholder={t("fields.handle_placeholder")}
                            className="h-full min-w-0 flex-1 bg-transparent pr-3 outline-none placeholder:text-muted-foreground"
                          />
                        </div>
                      </div>
                      <div>
                        <SettingLabel info={t("fields.profile_status_helper")}>
                          {t("fields.profile_status")}
                        </SettingLabel>
                        <input
                          type="text"
                          value={draft.profileStatus}
                          maxLength={140}
                          onChange={(event) =>
                            updateDraft(
                              "profileStatus",
                              normalizeSettingsStatusDraft(event.target.value),
                            )
                          }
                          placeholder={t("fields.profile_status_placeholder")}
                          className={INPUT_CLASSNAME}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </SectionPanel>

            <SectionPanel
              id="practice"
              title={t("sections.practice")}
              description={t("sections.practice_description")}
            >
              <div className="grid gap-4 px-5 py-4 lg:grid-cols-3">
                <DurationControl
                  label={t("fields.default_prep_time")}
                  value={draft.defaultPrepTime}
                  config={SOLO_PREP_DURATION}
                  onChange={(seconds) =>
                    updateDraft("defaultPrepTime", seconds)
                  }
                  compact
                />
                <DurationControl
                  label={t("fields.default_speech_time")}
                  value={draft.defaultSpeechTime}
                  config={SOLO_SPEECH_DURATION}
                  onChange={(seconds) =>
                    updateDraft("defaultSpeechTime", seconds)
                  }
                  compact
                />
                <div>
                  <SettingLabel>{t("fields.default_difficulty")}</SettingLabel>
                  <Select
                    value={draft.defaultDifficulty}
                    onChange={(event) =>
                      updateDraft(
                        "defaultDifficulty",
                        event.target
                          .value as SettingsDraft["defaultDifficulty"],
                      )
                    }
                    className={SELECT_CLASSNAME}
                  >
                    {AI_DIFFICULTY_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {t(`difficulty.${option}`)}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </SectionPanel>

            <SectionPanel
              id="voice"
              title={t("sections.voice")}
              description={t("sections.voice_description")}
            >
              <div className="px-5 py-5">
                <VoiceSettings
                  currentVoice={draft.ttsVoice}
                  practiceLanguage={draft.practiceLanguage}
                  onVoiceChange={(voiceId) => updateDraft("ttsVoice", voiceId)}
                />
              </div>
            </SectionPanel>

            <SectionPanel
              id="privacy"
              title={t("sections.privacy")}
              description={t("sections.privacy_description")}
            >
              {[
                {
                  key: "profileVisibility" as const,
                  title: t("rows.profile_shell"),
                  description: t("rows.profile_shell_description"),
                },
                {
                  key: "analyticsVisibility" as const,
                  title: t("rows.analytics"),
                  description: t("rows.analytics_description"),
                },
                {
                  key: "activitiesVisibility" as const,
                  title: t("rows.activities"),
                  description: t("rows.activities_description"),
                },
                {
                  key: "achievementsVisibility" as const,
                  title: t("rows.achievements"),
                  description: t("rows.achievements_description"),
                },
                {
                  key: "organizationVisibility" as const,
                  title: t("rows.organization"),
                  description: t("rows.organization_description"),
                },
              ].map((item) => (
                <SettingRow
                  key={item.key}
                  title={item.title}
                  description={item.description}
                  align="start"
                >
                  <Select
                    value={draft[item.key]}
                    onChange={(event) =>
                      updateDraft(
                        item.key,
                        event.target
                          .value as SettingsDraft["profileVisibility"],
                      )
                    }
                    className={SELECT_CLASSNAME}
                  >
                    {VISIBILITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {t(option.labelKey)}
                      </option>
                    ))}
                  </Select>
                </SettingRow>
              ))}
            </SectionPanel>

            <SectionPanel
              id="discovery"
              title={t("sections.discovery")}
              description={t("sections.discovery_description")}
            >
              <SettingRow
                title={t("rows.allow_friend_requests")}
                description={t("rows.allow_friend_requests_description")}
              >
                <ToggleControl
                  label={t("rows.allow_friend_requests")}
                  checked={draft.allowConnectionRequests}
                  onCheckedChange={(checked) =>
                    updateDraft("allowConnectionRequests", checked)
                  }
                />
              </SettingRow>
              <SettingRow
                title={t("rows.search_by_handle")}
                description={t("rows.search_by_handle_description")}
              >
                <ToggleControl
                  label={t("rows.search_by_handle")}
                  checked={draft.searchableByHandle}
                  onCheckedChange={(checked) =>
                    updateDraft("searchableByHandle", checked)
                  }
                />
              </SettingRow>
            </SectionPanel>

            {leaderboardPrivacyControlsEnabled &&
            leaderboardPrivacySettingsStatus === "unavailable" ? (
              <SectionPanel
                id="leaderboards"
                title={t("sections.leaderboards")}
                description={t("sections.leaderboards_description")}
              >
                <p
                  className="px-4 py-4 type-body text-on-surface-variant"
                  role="status"
                >
                  {t("rows.leaderboard_unavailable")}
                  <Button
                    type="button"
                    variant="outline"
                    className="ml-2"
                    onClick={() => router.refresh()}
                  >
                    {t("toast.retry")}
                  </Button>
                </p>
              </SectionPanel>
            ) : leaderboardPrivacyControlsEnabled && leaderboardPrivacy ? (
              <SectionPanel
                id="leaderboards"
                title={t("sections.leaderboards")}
                description={t("sections.leaderboards_description")}
              >
                <SettingRow
                  title={t("rows.public_display")}
                  description={t("rows.public_display_description")}
                  align="start"
                >
                  <Select
                    value={leaderboardPrivacy.displayMode}
                    onChange={(event) =>
                      updateLeaderboardPrivacyDraft({
                        displayMode: event.target
                          .value as LeaderboardDisplayMode,
                      })
                    }
                    className={SELECT_CLASSNAME}
                  >
                    <option value="public_name">
                      {t("rows.show_display_name")}
                    </option>
                    <option value="initials_only">
                      {t("rows.show_initials")}
                    </option>
                    <option value="hidden">{t("rows.hide_identity")}</option>
                  </Select>
                </SettingRow>
                <SettingRow
                  title={t("rows.allow_encouragement")}
                  description={t("rows.allow_encouragement_description")}
                >
                  <ToggleControl
                    label={t("rows.allow_encouragement")}
                    checked={leaderboardPrivacy.allowKudos}
                    onCheckedChange={(checked) =>
                      updateLeaderboardPrivacyDraft({ allowKudos: checked })
                    }
                  />
                </SettingRow>
                <SettingRow
                  title={t("rows.show_organization")}
                  description={t("rows.show_organization_description")}
                >
                  <ToggleControl
                    label={t("rows.show_organization")}
                    checked={leaderboardPrivacy.showOrganization}
                    onCheckedChange={(checked) =>
                      updateLeaderboardPrivacyDraft({
                        showOrganization: checked,
                      })
                    }
                  />
                </SettingRow>
                <SettingRow
                  title={t("rows.appear_on_leaderboards")}
                  description={t("rows.appear_on_leaderboards_description")}
                >
                  <ToggleControl
                    label={t("rows.appear_on_leaderboards")}
                    checked={leaderboardPrivacy.participateInLeaderboards}
                    onCheckedChange={(checked) =>
                      updateLeaderboardPrivacyDraft({
                        participateInLeaderboards: checked,
                      })
                    }
                  />
                </SettingRow>
                <div className="flex justify-end px-5 py-4">
                  <Button
                    type="button"
                    onClick={handleSaveLeaderboardPrivacy}
                    disabled={isLeaderboardPrivacyPending}
                    className="gap-2 rounded-lg bg-primary px-4 text-white hover:bg-primary-dim"
                  >
                    {isLeaderboardPrivacyPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {t("rows.save_leaderboard")}
                  </Button>
                </div>
              </SectionPanel>
            ) : null}

            <SectionPanel
              id="notifications"
              title={t("sections.notifications")}
              description={t("sections.notifications_description")}
            >
              <NotificationPreferencesPanel
                locale={currentLocale}
                preferences={notificationPreferences}
                operations={notificationPreferenceOperations}
                migratedPreferenceReviewRequired={
                  notificationPreferenceReviewRequired
                }
              />
            </SectionPanel>

            <SectionPanel
              id="appearance"
              title={t("sections.appearance")}
              description={t("sections.appearance_description")}
            >
              <SettingRow
                title={t("rows.theme")}
                description={t("rows.theme_description")}
              >
                <ThemeToggle variant="public" />
              </SettingRow>
              <SettingRow
                title={t("rows.app_language")}
                description={t("rows.app_language_description")}
                align="start"
              >
                <Select
                  value={draft.preferredLocale}
                  onChange={(event) =>
                    updatePreferredLocale(event.target.value as SettingsLocale)
                  }
                  className={SELECT_CLASSNAME}
                  aria-label={t("rows.app_language")}
                >
                  <option value="vi">{t("languages.vi")}</option>
                  <option value="en">{t("languages.en")}</option>
                </Select>
              </SettingRow>
            </SectionPanel>

            <SectionPanel
              id="organization"
              title={t("sections.organization")}
              description={t("sections.organization_description")}
            >
              {organizationAffiliationStatus === "unavailable" ? (
                <p
                  className="px-4 py-4 type-body text-on-surface-variant"
                  role="status"
                >
                  {t("rows.organization_unavailable")}
                  <Button
                    type="button"
                    variant="outline"
                    className="ml-2"
                    onClick={() => router.refresh()}
                  >
                    {t("toast.retry")}
                  </Button>
                </p>
              ) : organizationAffiliation ? (
                <div className="grid gap-4 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-outline-variant bg-background text-primary">
                      {organizationAffiliation.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={organizationAffiliation.logoUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Building2 className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-on-surface dark:text-on-surface">
                        {organizationAffiliation.name}
                      </p>
                      <p className="truncate text-sm text-on-surface-variant">
                        {organizationAffiliation.subtitle}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface-container px-2.5 py-1 text-xs font-semibold text-success">
                      <BadgeCheck className="h-3.5 w-3.5" />
                      {t("rows.verified")}
                    </span>
                    <span className="rounded-full border border-outline-variant px-2.5 py-1 text-xs font-semibold capitalize text-on-surface-variant">
                      {organizationAffiliation.role}
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  <SettingRow
                    title={t("rows.status")}
                    description={t("rows.not_connected")}
                  >
                    <span className="inline-flex rounded-full border border-outline-variant px-2.5 py-1 text-xs font-semibold text-on-surface-variant">
                      {t("rows.not_verified")}
                    </span>
                  </SettingRow>
                  {organizationJoinCodesEnabled ? (
                    <SettingRow
                      title={t("rows.organization_code")}
                      description={t("rows.organization_code_description")}
                      align="start"
                    >
                      <div className="grid w-full gap-3">
                        <input
                          type="text"
                          value={organizationCode}
                          onChange={(event) =>
                            setOrganizationCode(
                              formatOrganizationJoinCode(
                                event.target.value,
                              ).slice(0, 19),
                            )
                          }
                          placeholder="ABCD-1234"
                          className={cn(
                            INPUT_CLASSNAME,
                            "font-bold tracking-widest placeholder:tracking-normal",
                          )}
                        />
                        <Button
                          type="button"
                          onClick={handleClaimOrganizationCode}
                          disabled={
                            isOrganizationPending ||
                            !isUsableOrganizationJoinCode(organizationCode)
                          }
                          className="gap-2 rounded-lg bg-primary text-white hover:bg-primary-dim"
                        >
                          {isOrganizationPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <UserPlus className="h-4 w-4" />
                          )}
                          {t("rows.join_organization")}
                        </Button>
                      </div>
                    </SettingRow>
                  ) : null}
                </>
              )}
            </SectionPanel>

            <SectionPanel
              id="account"
              title={t("sections.account")}
              description={t("sections.account_description")}
            >
              <div className="grid gap-4 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500">
                    <LogOut className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-red-600">
                      {t("sign_out")}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-red-500/90">
                      {t("sign_out_description")}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSignOut}
                  className="rounded-lg border-red-200 bg-white text-red-600 hover:bg-red-50 dark:border-error/45 dark:bg-surface-container-lowest dark:text-error"
                >
                  {t("sign_out")}
                </Button>
              </div>
            </SectionPanel>
          </main>
        </div>
      </PageContainer>
    </div>
  );
}

export function SettingsContent(props: SettingsContentProps) {
  const t = useTranslations("settings");
  const router = useRouter();

  if (props.settingsDataError) {
    return (
      <PageContainer size="focused" className="py-10">
        <div
          role="alert"
          className="space-y-3 rounded-control border border-warning-container bg-warning-container p-5 text-on-surface"
        >
          <p className="type-body">{t("rows.settings_unavailable")}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.refresh()}
          >
            {t("toast.retry")}
          </Button>
        </div>
      </PageContainer>
    );
  }

  return <SettingsContentEditor {...props} settingsDataError={null} />;
}
