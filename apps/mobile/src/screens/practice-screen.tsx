import {
  createPracticeSessionConfig,
  DEFAULT_PRACTICE_LANGUAGE,
  SOLO_PREP_DURATION,
  SOLO_SPEECH_DURATION,
  formatDurationLabel,
  getCategoryKey,
  getLocalizedCategoryOptions,
  getLocalizedTopics,
  getPracticeLanguageConfig,
  type AiDifficulty,
  type CategoryFilterKey,
  type DebateTopic,
  type PracticeLanguage,
  type PracticeMode,
  type PracticeSide,
  type PracticeTrack,
} from "@thinkfy/shared/practice";
import { createThinkfyApiClient } from "@thinkfy/shared/api-client";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import {
  AppButton,
  AppText,
  Badge,
  IconBadge,
  ProgressBar,
  Screen,
  SectionHeader,
  StateBlock,
  Surface,
  useThinkfyColors,
} from "@/components/ui";
import { spacing } from "@/design/tokens";
import { useAuth } from "@/lib/auth";
import { isDesignPreviewEnabled } from "@/lib/design-preview";
import { mobileEnv } from "@/lib/env";
import { trackMobilePracticeEvent } from "@/lib/mobile-analytics";
import { usePracticeSession } from "@/lib/practice-session";

const difficultyTone = {
  beginner: "success",
  intermediate: "warning",
  advanced: "error",
} as const;

const aiDifficultyOptions: AiDifficulty[] = ["easy", "medium", "hard"];
const sideOptions: { value: PracticeSide; label: string }[] = [
  { value: "random", label: "Random" },
  { value: "proposition", label: "For" },
  { value: "opposition", label: "Against" },
];

function normalizeQuery(value: string) {
  return value.trim().toLowerCase();
}

function getTopicSummary(topic: DebateTopic) {
  return (
    topic.context ??
    "Practice a structured claim, evidence, impact, and rebuttal path."
  );
}

function getTopicMatchText(topic: DebateTopic) {
  return [
    topic.title,
    topic.category,
    topic.context,
    ...(topic.suggestedPoints?.proposition ?? []),
    ...(topic.suggestedPoints?.opposition ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function formatSeconds(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  return `${minutes}m`;
}

export function PracticeScreen() {
  const colors = useThinkfyColors();
  const router = useRouter();
  const params = useLocalSearchParams<{
    topicId?: string;
    track?: PracticeTrack;
  }>();
  const { getAccessToken, user } = useAuth();
  const previewEnabled = isDesignPreviewEnabled();
  const { beginSession, restoredAt } = usePracticeSession();
  const [practiceLanguage, setPracticeLanguage] = useState<PracticeLanguage>(
    DEFAULT_PRACTICE_LANGUAGE
  );
  const [practiceTrack, setPracticeTrack] = useState<PracticeTrack>(
    params.track === "speaking" ? "speaking" : "debate"
  );
  const [mode, setMode] = useState<PracticeMode>("full");
  const [side, setSide] = useState<PracticeSide>("random");
  const [prepTime, setPrepTime] = useState(SOLO_PREP_DURATION.defaultSeconds);
  const [speechTime, setSpeechTime] = useState(
    SOLO_SPEECH_DURATION.defaultSeconds
  );
  const [aiDifficulty, setAiDifficulty] = useState<AiDifficulty>("medium");
  const [activeCategory, setActiveCategory] =
    useState<CategoryFilterKey>("all");
  const [search, setSearch] = useState("");
  const localizedTopics = useMemo(
    () => getLocalizedTopics(practiceLanguage),
    [practiceLanguage]
  );
  const [selectedTopicId, setSelectedTopicId] = useState(
    params.topicId ?? localizedTopics[0]?.id ?? ""
  );
  const languageConfig = getPracticeLanguageConfig(practiceLanguage);
  const categoryOptions = getLocalizedCategoryOptions(practiceLanguage);
  const selectedTopic = useMemo(
    () =>
      localizedTopics.find((topic) => topic.id === selectedTopicId) ??
      localizedTopics[0],
    [localizedTopics, selectedTopicId]
  );
  const filteredTopics = useMemo(() => {
    const query = normalizeQuery(search);

    return localizedTopics.filter((topic) => {
      const categoryMatches =
        activeCategory === "all" ||
        getCategoryKey(topic.category) === activeCategory;
      const queryMatches = !query || getTopicMatchText(topic).includes(query);

      return categoryMatches && queryMatches;
    });
  }, [activeCategory, localizedTopics, search]);
  const apiClient = useMemo(
    () =>
      user && mobileEnv.apiBaseUrl
        ? createThinkfyApiClient({
            baseUrl: mobileEnv.apiBaseUrl,
            getAccessToken,
          })
        : null,
    [getAccessToken, user]
  );

  useEffect(() => {
    if (!params.topicId) return;
    if (localizedTopics.some((topic) => topic.id === params.topicId)) {
      setSelectedTopicId(params.topicId);
    }
  }, [localizedTopics, params.topicId]);

  useEffect(() => {
    if (!selectedTopicId && localizedTopics[0]) {
      setSelectedTopicId(localizedTopics[0].id);
    }
  }, [localizedTopics, selectedTopicId]);

  useEffect(() => {
    trackMobilePracticeEvent(apiClient, "mobile_practice_setup_viewed", "/practice", {
      preview: previewEnabled,
      restored: Boolean(restoredAt),
    });
  }, [apiClient, previewEnabled, restoredAt]);

  const handleTrackChange = (nextTrack: PracticeTrack) => {
    setPracticeTrack(nextTrack);
    if (nextTrack === "speaking") {
      setMode("quick");
    }
  };

  const handleBegin = async () => {
    if (!selectedTopic) return;

    const config = createPracticeSessionConfig({
      topic: selectedTopic,
      practiceTrack,
      practiceLanguage,
      mode,
      side,
      prepTime,
      speechTime,
      aiDifficulty,
    });

    await beginSession(config);
    trackMobilePracticeEvent(apiClient, "mobile_practice_started", "/practice", {
      aiDifficulty,
      mode: config.mode,
      practiceLanguage,
      practiceTrack,
      side: config.resolvedSide,
      topicId: selectedTopic.id,
    });
    router.push("/practice/session" as Href);
  };

  if (!user && !previewEnabled) {
    return (
      <Screen
        eyebrow="Practice"
        subtitle="Sign in to choose a topic and record a mobile practice run."
        title="Practice is ready"
        testID="practice-screen-signed-out"
      >
        <StateBlock
          actionLabel="Go to sign in"
          body="The mobile practice flow needs your account so recordings and later feedback stay tied to you."
          onPress={() => router.replace("/")}
          state="empty"
          title="Sign in first"
        />
      </Screen>
    );
  }

  return (
    <Screen
      eyebrow="Practice"
      subtitle="Choose a motion, tune the setup, then run a recorded speaking rep."
      title="Build your next rep"
      testID="practice-screen"
    >
      <Surface tone="primary">
        <View style={styles.heroRow}>
          <IconBadge name="mic.fill" size={42} />
          <View style={styles.flexCopy}>
            <AppText variant="heading">First-week prototype path</AppText>
            <AppText color={colors.muted} variant="caption">
              Setup, prep, mic, speaking, and local recording. Feedback starts in
              Phase 7.
            </AppText>
          </View>
        </View>
        <ProgressBar value={0.55} />
      </Surface>

      <SectionHeader action={`${filteredTopics.length} topics`} title="Topic" />
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={setSearch}
        placeholder="Search motions, skills, or categories"
        placeholderTextColor={colors.muted}
        style={[
          styles.searchInput,
          {
            backgroundColor: colors.surface,
            borderColor: colors.outlineVariant,
            color: colors.foreground,
          },
        ]}
        value={search}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.horizontalScroller}
      >
        <View style={styles.chipRow}>
          {categoryOptions.map((category) => (
            <ChoiceChip
              key={category.key}
              label={category.label}
              onPress={() => setActiveCategory(category.key)}
              selected={activeCategory === category.key}
            />
          ))}
        </View>
      </ScrollView>
      <View style={styles.topicStack}>
        {filteredTopics.slice(0, 8).map((topic) => (
          <TopicChoice
            key={topic.id}
            onPress={() => setSelectedTopicId(topic.id)}
            selected={topic.id === selectedTopic?.id}
            topic={topic}
          />
        ))}
      </View>
      {filteredTopics.length === 0 ? (
        <StateBlock
          actionLabel="Clear search"
          body="Try another keyword or return to all categories."
          onPress={() => {
            setSearch("");
            setActiveCategory("all");
          }}
          title="No topics found"
        />
      ) : null}

      {selectedTopic ? (
        <>
          <SectionHeader title="Selected motion" />
          <Surface>
            <View style={styles.selectedHeader}>
              <Badge tone={difficultyTone[selectedTopic.difficulty]}>
                {selectedTopic.difficulty}
              </Badge>
              <Badge tone="neutral">{selectedTopic.category}</Badge>
            </View>
            <AppText variant="heading">{selectedTopic.title}</AppText>
            <AppText color={colors.muted} variant="body">
              {getTopicSummary(selectedTopic)}
            </AppText>
            <PointPreview
              label="For"
              points={selectedTopic.suggestedPoints?.proposition}
            />
            <PointPreview
              label="Against"
              points={selectedTopic.suggestedPoints?.opposition}
            />
          </Surface>
        </>
      ) : null}

      <SectionHeader title="Setup" />
      <Surface>
        <AppText variant="bodyStrong">Language</AppText>
        <View style={styles.chipRow}>
          <ChoiceChip
            label="English"
            onPress={() => setPracticeLanguage("en")}
            selected={practiceLanguage === "en"}
          />
          <ChoiceChip
            label="Vietnamese"
            onPress={() => setPracticeLanguage("vi")}
            selected={practiceLanguage === "vi"}
          />
        </View>
        <AppText color={colors.muted} variant="caption">
          {languageConfig.aiName} coaching language
        </AppText>

        <AppText variant="bodyStrong">Track</AppText>
        <View style={styles.twoColumn}>
          <ModeCard
            body="One timed speech, fast and focused."
            icon="mic"
            onPress={() => handleTrackChange("speaking")}
            selected={practiceTrack === "speaking"}
            title="Speaking"
          />
          <ModeCard
            body="Debate setup now, full rounds later."
            icon="scale.3d"
            onPress={() => handleTrackChange("debate")}
            selected={practiceTrack === "debate"}
            title="Debate"
          />
        </View>

        <AppText variant="bodyStrong">Mode</AppText>
        <View style={styles.chipRow}>
          <ChoiceChip
            label="Quick"
            onPress={() => setMode("quick")}
            selected={mode === "quick" || practiceTrack === "speaking"}
          />
          <ChoiceChip
            disabled={practiceTrack === "speaking"}
            label="Full"
            onPress={() => setMode("full")}
            selected={practiceTrack === "debate" && mode === "full"}
          />
        </View>

        <AppText variant="bodyStrong">Side</AppText>
        <View style={styles.chipRow}>
          {sideOptions.map((option) => (
            <ChoiceChip
              key={option.value}
              label={option.label}
              onPress={() => setSide(option.value)}
              selected={side === option.value}
            />
          ))}
        </View>

        <AppText variant="bodyStrong">Coach difficulty</AppText>
        <View style={styles.chipRow}>
          {aiDifficultyOptions.map((option) => (
            <ChoiceChip
              key={option}
              label={option}
              onPress={() => setAiDifficulty(option)}
              selected={aiDifficulty === option}
            />
          ))}
        </View>

        <DurationPicker
          label="Prep time"
          onChange={setPrepTime}
          options={SOLO_PREP_DURATION.presetSeconds}
          value={prepTime}
        />
        <DurationPicker
          label="Speak time"
          onChange={setSpeechTime}
          options={SOLO_SPEECH_DURATION.presetSeconds}
          value={speechTime}
        />
      </Surface>

      <AppButton onPress={handleBegin}>Start mic check</AppButton>
    </Screen>
  );
}

function ChoiceChip({
  disabled = false,
  label,
  selected,
  onPress,
}: {
  disabled?: boolean;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useThinkfyColors();

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choiceChip,
        {
          backgroundColor: selected ? colors.primary : colors.surfaceDim,
          borderColor: selected ? colors.primary : colors.outlineVariant,
        },
        pressed ? styles.pressed : null,
        disabled ? styles.disabled : null,
      ]}
    >
      <AppText
        color={selected ? colors.inverseText : colors.foreground}
        variant="caption"
      >
        {label}
      </AppText>
    </Pressable>
  );
}

function TopicChoice({
  topic,
  selected,
  onPress,
}: {
  topic: DebateTopic;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useThinkfyColors();

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed ? styles.pressed : null]}>
      <Surface
        style={[
          styles.topicChoice,
          selected
            ? {
                backgroundColor: colors.primaryContainer,
                borderColor: colors.primary,
              }
            : null,
        ]}
      >
        <View style={styles.topicTitleRow}>
          <View style={styles.flexCopy}>
            <AppText variant="bodyStrong">{topic.title}</AppText>
            <AppText color={colors.muted} numberOfLines={2} variant="caption">
              {getTopicSummary(topic)}
            </AppText>
          </View>
          <Badge tone={difficultyTone[topic.difficulty]}>
            {topic.difficulty}
          </Badge>
        </View>
      </Surface>
    </Pressable>
  );
}

function PointPreview({
  label,
  points,
}: {
  label: string;
  points?: string[];
}) {
  const colors = useThinkfyColors();
  const firstPoint = points?.[0];

  if (!firstPoint) return null;

  return (
    <View style={styles.pointPreview}>
      <Badge tone="neutral">{label}</Badge>
      <AppText color={colors.muted} variant="caption">
        {firstPoint}
      </AppText>
    </View>
  );
}

function ModeCard({
  body,
  icon,
  selected,
  title,
  onPress,
}: {
  body: string;
  icon: "mic" | "scale.3d";
  selected: boolean;
  title: string;
  onPress: () => void;
}) {
  const colors = useThinkfyColors();

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed ? styles.pressed : null]}>
      <Surface
        style={[
          styles.modeCard,
          selected
            ? {
                backgroundColor: colors.primaryContainer,
                borderColor: colors.primary,
              }
            : null,
        ]}
      >
        <IconBadge name={icon} size={34} />
        <View style={styles.flexCopy}>
          <AppText variant="bodyStrong">{title}</AppText>
          <AppText color={colors.muted} variant="caption">
            {body}
          </AppText>
        </View>
      </Surface>
    </Pressable>
  );
}

function DurationPicker({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly number[];
  value: number;
  onChange: (value: number) => void;
}) {
  const colors = useThinkfyColors();

  return (
    <View style={styles.durationBlock}>
      <View style={styles.durationHeader}>
        <AppText variant="bodyStrong">{label}</AppText>
        <AppText color={colors.primary} variant="caption">
          {formatDurationLabel(value)}
        </AppText>
      </View>
      <View style={styles.chipRow}>
        {options.map((seconds) => (
          <ChoiceChip
            key={seconds}
            label={formatSeconds(seconds)}
            onPress={() => onChange(seconds)}
            selected={value === seconds}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
  flexCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  searchInput: {
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  horizontalScroller: {
    marginHorizontal: -spacing.screen,
    paddingHorizontal: spacing.screen,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  choiceChip: {
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 38,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pressed: {
    opacity: 0.78,
  },
  disabled: {
    opacity: 0.45,
  },
  topicStack: {
    gap: spacing.sm,
  },
  topicChoice: {
    borderRadius: 8,
    padding: spacing.md,
  },
  topicTitleRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
  },
  selectedHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  pointPreview: {
    gap: spacing.xs,
  },
  twoColumn: {
    gap: spacing.sm,
  },
  modeCard: {
    alignItems: "center",
    borderRadius: 8,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
  },
  durationBlock: {
    gap: spacing.sm,
  },
  durationHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
