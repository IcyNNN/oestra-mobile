import { Mic } from "lucide-react-native";
import { Alert, Pressable, TextInput, View, type TextInputProps } from "react-native";

interface VoiceTextInputProps extends TextInputProps {
  showVoiceButton?: boolean;
}

export function VoiceTextInput({
  showVoiceButton = true,
  className = "",
  ...props
}: VoiceTextInputProps) {
  return (
    <View
      className={`flex-row items-center rounded-2xl border border-oestra-mist bg-white px-4 py-3 ${className}`}
    >
      <TextInput
        {...props}
        placeholderTextColor={props.placeholderTextColor ?? "#6B6770"}
        className="flex-1 font-sans text-base text-oestra-text"
      />
      {showVoiceButton ? (
        <Pressable
          onPress={() =>
            Alert.alert(
              "语音输入",
              "请点击输入框后使用系统键盘麦克风说话，Oestra 会自动接收转写文字。",
            )
          }
          className="ml-3 h-9 w-9 items-center justify-center rounded-full bg-oestra-mist"
        >
          <Mic size={15} color="#3D2B4E" />
        </Pressable>
      ) : null}
    </View>
  );
}
