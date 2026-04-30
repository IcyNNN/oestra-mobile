import { Eye, EyeOff } from "lucide-react-native";
import { useState } from "react";
import { Pressable, TextInput, View, type TextInputProps } from "react-native";

interface InputProps extends TextInputProps {
  error?: boolean;
}

export function Input({ error = false, secureTextEntry, className = "", ...props }: InputProps) {
  const [visible, setVisible] = useState(false);
  const isPassword = Boolean(secureTextEntry);
  const shouldMask = isPassword && !visible;

  return (
    <View
      className={`flex-row items-center rounded-2xl border bg-white px-4 py-3 ${error ? "border-oestra-blush" : "border-oestra-mist"} ${className}`}
    >
      <TextInput
        {...props}
        secureTextEntry={shouldMask}
        className="flex-1 font-sans text-base text-oestra-text"
        placeholderTextColor={props.placeholderTextColor ?? "#6B6770"}
      />
      {isPassword ? (
        <Pressable onPress={() => setVisible((v) => !v)} className="pl-3">
          {visible ? <EyeOff size={18} color="#6B6770" /> : <Eye size={18} color="#6B6770" />}
        </Pressable>
      ) : null}
    </View>
  );
}
