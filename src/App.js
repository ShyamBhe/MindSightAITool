import React, { useMemo, useState, createContext, useContext } from "react";
import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";
import MentalHealthUI from "./Components/MentalHealthUI";
import { I18nProvider, safeGet, safeSet } from "./i18n";

const ColorModeCtx = createContext({ mode: "light", toggle: () => {} });
export const useColorMode = () => useContext(ColorModeCtx);

function App() {
  const [mode, setMode] = useState(() => {
    const saved = safeGet("ms_mode");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const toggle = () => setMode((m) => { const n = m === "light" ? "dark" : "light"; safeSet("ms_mode", n); return n; });
  const theme = useMemo(() => createTheme({
    palette: {
      mode,
      ...(mode === "dark" ? { primary: { main: "#4da3ff" } } : {}),
      ...(mode === "dark" ? { background: { default: "#0f1419", paper: "#1a2129" } } : { background: { default: "#f9fafb", paper: "#ffffff" } }),
    },
  }), [mode]);

  return (
    <ColorModeCtx.Provider value={{ mode, toggle }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <I18nProvider>
          <MentalHealthUI />
        </I18nProvider>
      </ThemeProvider>
    </ColorModeCtx.Provider>
  );
}

export default App;
