import { ThemeConfig, extendTheme } from "@chakra-ui/react";
import { modalTheme } from "./modal";
import { cardTheme } from "./card";
import { buttonTheme } from "./button";

const themeConfig: ThemeConfig = {
  useSystemColorMode: false,
  disableTransitionOnChange: false,
  initialColorMode: "light",

  // @ts-ignore
  components: {
    Modal: modalTheme,
    Card: cardTheme,
    Button: buttonTheme,
  },
  cssVarPrefix: "vechainKit",
};
export const theme = extendTheme(themeConfig);
