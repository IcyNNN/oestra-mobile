import { Mic } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, Text, TextInput, View, type TextInputProps } from "react-native";
import type { EventSubscription } from "react-native";

import { getDefaultSpeechRecognitionLang } from "../../utils/speechLocale";

interface VoiceTextInputProps extends TextInputProps {
  showVoiceButton?: boolean;
  /** BCP-47 locale e.g. zh-CN, en-US. Omitted = follow system locale. */
  speechLang?: string;
}

type ExpoSpeechPkg = {
  ExpoSpeechRecognitionModule: {
    requestPermissionsAsync: () => Promise<{ granted: boolean }>;
    start: (options: { lang: string; interimResults: boolean; continuous: boolean }) => void;
    stop: () => void;
    addListener: (event: string, cb: (payload: unknown) => void) => EventSubscription;
  };
};

function tryLoadExpoSpeech(): ExpoSpeechPkg | null {
  try {
    // Do not import at file top: Expo Go has no native module; require() is deferred until user taps mic.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-speech-recognition") as ExpoSpeechPkg;
  } catch {
    return null;
  }
}

export function VoiceTextInput({
  showVoiceButton = true,
  className = "",
  speechLang: speechLangProp,
  value,
  onChangeText,
  ...props
}: VoiceTextInputProps) {
  const speechLang = speechLangProp ?? getDefaultSpeechRecognitionLang();
  const [listening, setListening] = useState(false);
  const baseRef = useRef("");
  const listeningRef = useRef(false);
  const subsRef = useRef<EventSubscription[]>([]);
  const speechPkgRef = useRef<ExpoSpeechPkg | null>(null);

  const clearSubscriptions = useCallback(() => {
    subsRef.current.forEach((s) => s.remove());
    subsRef.current = [];
  }, []);

  useEffect(
    () => () => {
      clearSubscriptions();
      if (speechPkgRef.current) {
        try {
          speechPkgRef.current.ExpoSpeechRecognitionModule.stop();
        } catch {
          // ignore
        }
      }
    },
    [clearSubscriptions],
  );

  const handlePressIn = useCallback(async () => {
    const pkg = tryLoadExpoSpeech();
    if (!pkg) {
      Alert.alert(
        "语音预览",
        "当前环境（如 Expo Go）没有内置「按住说话」所需的语音识别原生模块。\n\n你可以先点击输入框，用系统键盘上的麦克风进行听写；或在本机执行 npx expo run:ios / npx expo run:android 安装 Development Build 后再试。",
      );
      return;
    }

    speechPkgRef.current = pkg;
    const { ExpoSpeechRecognitionModule: mod } = pkg;
    clearSubscriptions();

    const onResult = (event: { results?: Array<{ transcript?: string }> }) => {
      const transcript = event.results?.[0]?.transcript;
      if (transcript == null || !listeningRef.current) return;
      const prefix = baseRef.current;
      const spacer = prefix.length > 0 && !prefix.endsWith(" ") && !prefix.endsWith("\n") ? " " : "";
      onChangeText?.(`${prefix}${spacer}${transcript}`);
    };

    const onError = (event: { error?: string; message?: string }) => {
      listeningRef.current = false;
      setListening(false);
      if (event.error === "aborted") return;
      Alert.alert("语音识别", event.message || event.error || "暂时无法识别，请改用键盘。");
    };

    const onEnd = () => {
      listeningRef.current = false;
      setListening(false);
      clearSubscriptions();
    };

    subsRef.current = [
      mod.addListener("result", onResult as (e: unknown) => void),
      mod.addListener("error", onError as (e: unknown) => void),
      mod.addListener("end", onEnd),
    ];

    try {
      const perm = await mod.requestPermissionsAsync();
      if (!perm.granted) {
        clearSubscriptions();
        Alert.alert("需要权限", "请在系统设置中开启麦克风与语音识别权限。");
        return;
      }
      baseRef.current = typeof value === "string" ? value : "";
      listeningRef.current = true;
      setListening(true);
      mod.start({
        lang: speechLang,
        interimResults: true,
        continuous: true,
      });
    } catch (e) {
      clearSubscriptions();
      listeningRef.current = false;
      setListening(false);
      const message = e instanceof Error ? e.message : String(e);
      Alert.alert("语音不可用", message);
    }
  }, [clearSubscriptions, onChangeText, speechLang, value]);

  const handlePressOut = useCallback(() => {
    const pkg = speechPkgRef.current ?? tryLoadExpoSpeech();
    if (!pkg || !listeningRef.current) return;
    try {
      pkg.ExpoSpeechRecognitionModule.stop();
    } catch {
      listeningRef.current = false;
      setListening(false);
      clearSubscriptions();
    }
  }, [clearSubscriptions]);

  return (
    <View
      className={`flex-row items-center rounded-2xl border border-oestra-mist bg-white px-4 py-3 ${className}`}
    >
      <TextInput
        {...props}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={props.placeholderTextColor ?? "#6B6770"}
        className="flex-1 font-sans text-base text-oestra-text"
      />
      {showVoiceButton ? (
        <Pressable
          accessibilityLabel="按住说话"
          accessibilityHint="按住开始语音识别，松手结束"
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          className={`ml-3 h-9 w-9 items-center justify-center rounded-full ${listening ? "bg-oestra-blush" : "bg-oestra-mist"}`}
        >
          <Mic size={15} color={listening ? "#FFFFFF" : "#3D2B4E"} />
        </Pressable>
      ) : null}
      {listening ? (
        <Text className="ml-2 font-sans text-[10px] text-oestra-blush">聆听中…</Text>
      ) : null}
    </View>
  );
}
