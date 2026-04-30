import { ActivityIndicator, Pressable, Text, type PressableProps } from "react-native";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends PressableProps {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variantClassMap: Record<ButtonVariant, string> = {
  primary: "bg-oestra-purple",
  secondary: "border border-oestra-purple bg-transparent",
  ghost: "bg-transparent",
};

const textClassMap: Record<ButtonVariant, string> = {
  primary: "text-white",
  secondary: "text-oestra-purple",
  ghost: "text-oestra-purple",
};

const sizeClassMap: Record<ButtonSize, string> = {
  sm: "px-4 py-2.5",
  md: "px-5 py-3.5",
  lg: "px-6 py-4",
};

const textSizeClassMap: Record<ButtonSize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
};

export function Button({
  title,
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      {...props}
      disabled={isDisabled}
      className={`items-center justify-center rounded-2xl ${variantClassMap[variant]} ${sizeClassMap[size]} ${isDisabled ? "opacity-60" : ""}`}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? "#FFFFFF" : "#3D2B4E"} />
      ) : (
        <Text className={`font-sans-bold ${textClassMap[variant]} ${textSizeClassMap[size]}`}>{title}</Text>
      )}
    </Pressable>
  );
}
