import type { Dispatch, SetStateAction } from "react";
import {
  ArrowRight,
  BellRing,
  Eye,
  Loader2,
  Mic,
  ShieldCheck,
} from "@/components/ui/icons";
import { buttonVariants } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { IeltsSettingsCopy } from "./copy";
import {
  SaveBar,
  SettingRow,
  SettingsSection,
  type SaveStateValue,
} from "./IeltsSettingsPrimitives";

export type AudioState =
  | "idle"
  | "testing"
  | "ready"
  | "blocked"
  | "unavailable";

export interface NotificationDraft {
  practiceReminders: boolean;
  emailNotifications: boolean;
}

function audioMessage(copy: IeltsSettingsCopy, state: AudioState) {
  const messageByState: Record<AudioState, string> = {
    idle: copy.audioIdle,
    testing: copy.audioTesting,
    ready: copy.audioReady,
    blocked: copy.audioBlocked,
    unavailable: copy.audioUnavailable,
  };
  return messageByState[state];
}

export function ExamDisplaySettings({ copy }: { copy: IeltsSettingsCopy }) {
  return (
    <SettingsSection
      icon={<Eye />}
      title={copy.examTitle}
      caption={copy.examCaption}
    >
      <p className="max-w-prose type-body-sm text-on-surface-variant">
        {copy.examBody}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/ielts/tests"
          className={buttonVariants({ variant: "primary" })}
        >
          {copy.examCta}
          <ArrowRight className="size-4" />
        </Link>
        <Link
          href="/settings#appearance"
          className={buttonVariants({ variant: "secondary" })}
        >
          {copy.displayCta}
        </Link>
      </div>
    </SettingsSection>
  );
}

export function AudioReadinessSettings({
  copy,
  state,
  onCheck,
}: {
  copy: IeltsSettingsCopy;
  state: AudioState;
  onCheck: () => void;
}) {
  return (
    <SettingsSection
      icon={<Mic />}
      title={copy.audioTitle}
      caption={copy.audioCaption}
    >
      <div
        className="rounded-lg bg-surface-container-low p-3"
        role="status"
        aria-live="polite"
      >
        <p className="type-body-sm font-medium text-on-surface">
          {audioMessage(copy, state)}
        </p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={state === "testing"}
          aria-busy={state === "testing"}
          onClick={onCheck}
          className={buttonVariants({ variant: "primary" })}
        >
          {state === "testing" ? (
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
          ) : (
            <Mic className="size-4" />
          )}
          {state === "idle" ? copy.audioCheck : copy.audioAgain}
        </button>
        <Link
          href="/ielts/speaking-rehearsal"
          className={buttonVariants({ variant: "secondary" })}
        >
          {copy.speakingCta}
        </Link>
      </div>
    </SettingsSection>
  );
}

export function NotificationSettings({
  copy,
  draft,
  setDraft,
  saveState,
  isDirty,
  isPending,
  onSave,
}: {
  copy: IeltsSettingsCopy;
  draft: NotificationDraft;
  setDraft: Dispatch<SetStateAction<NotificationDraft>>;
  saveState: SaveStateValue;
  isDirty: boolean;
  isPending: boolean;
  onSave: () => void;
}) {
  return (
    <SettingsSection
      icon={<BellRing />}
      title={copy.notificationTitle}
      caption={copy.notificationCaption}
    >
      <SettingRow
        title={copy.practiceReminders}
        description={copy.practiceRemindersBody}
        control={
          <Switch
            checked={draft.practiceReminders}
            onCheckedChange={(checked) =>
              setDraft((current) => ({
                ...current,
                practiceReminders: checked,
              }))
            }
            aria-label={copy.practiceReminders}
          />
        }
      />
      <SettingRow
        title={copy.emailUpdates}
        description={copy.emailUpdatesBody}
        control={
          <Switch
            checked={draft.emailNotifications}
            onCheckedChange={(checked) =>
              setDraft((current) => ({
                ...current,
                emailNotifications: checked,
              }))
            }
            aria-label={copy.emailUpdates}
          />
        }
      />
      <div className="mt-3">
        <SaveBar
          copy={copy}
          state={saveState}
          disabled={!isDirty || isPending}
          pending={isPending}
          onSave={onSave}
        />
      </div>
      <p className="mt-3 type-caption text-on-surface-variant">
        {copy.notificationsSaveNote}
      </p>
    </SettingsSection>
  );
}

export function PrivacySettings({ copy }: { copy: IeltsSettingsCopy }) {
  return (
    <SettingsSection
      icon={<ShieldCheck />}
      title={copy.privacyTitle}
      caption={copy.privacyCaption}
    >
      <p className="max-w-prose type-body-sm text-on-surface-variant">
        {copy.privacyBody}
      </p>
      <Link
        href="/settings#privacy"
        className={cn(buttonVariants({ variant: "secondary" }), "mt-4")}
      >
        {copy.privacyCta}
        <ArrowRight className="size-4" />
      </Link>
    </SettingsSection>
  );
}

export async function checkMicrophoneReadiness(
  setState: Dispatch<SetStateAction<AudioState>>,
) {
  setState("testing");
  if (!navigator.mediaDevices?.getUserMedia) {
    setState("unavailable");
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    setState("ready");
  } catch (error) {
    const name = error instanceof DOMException ? error.name : "";
    setState(name === "NotFoundError" ? "unavailable" : "blocked");
  }
}
