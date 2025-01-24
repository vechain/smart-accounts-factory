import { ThemeConfig, extendTheme } from "@chakra-ui/react";

const themeConfig: ThemeConfig = {
  useSystemColorMode: false,
  disableTransitionOnChange: false,
  initialColorMode: "light",
  cssVarPrefix: "chakra",
};

const theme = extendTheme({
  ...themeConfig,
  styles: {
    global: {
      body: {
        bg: "white",
        color: "gray.800",
      },
    },
  },
  colors: {
    brand: {
      50: "#f7fafc",
      100: "#edf2f7",
    },
  },
});

export { theme };
