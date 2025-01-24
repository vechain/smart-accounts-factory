import { ThemeConfig, extendTheme } from "@chakra-ui/react";

const themeConfig: ThemeConfig = {
  useSystemColorMode: false,
  disableTransitionOnChange: false,
  initialColorMode: "light",
};
export const theme = extendTheme(themeConfig);
