import React from "react";
import { Image } from "react-native";

export function HelpChainLogo({
  width = 260,
  height = 159,
  light = false,
}: {
  width?: number;
  height?: number;
  light?: boolean;
}) {
  return (
    <Image
      source={
        light
          ? require("../assets/images/helpchain-logo-light.png")
          : require("../assets/images/helpchain-logo.png")
      }
      style={{ width, height }}
      resizeMode="contain"
      accessible
      accessibilityLabel="HelpChain. Help together. Grow together."
    />
  );
}
