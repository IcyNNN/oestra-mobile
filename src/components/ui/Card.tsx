import { View, type ViewProps } from "react-native";

type CardPadding = "sm" | "md" | "lg";

interface CardProps extends ViewProps {
  padding?: CardPadding;
}

const paddingMap: Record<CardPadding, string> = {
  sm: "p-3",
  md: "p-5",
  lg: "p-6",
};

export function Card({ padding = "md", className = "", ...props }: CardProps) {
  return (
    <View
      {...props}
      className={`rounded-3xl bg-white ${paddingMap[padding]} ${className}`}
      style={[
        {
          shadowColor: "#2D2A2E",
          shadowOpacity: 0.03,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 1,
        },
        props.style,
      ]}
    />
  );
}
