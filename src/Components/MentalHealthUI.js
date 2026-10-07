import React, { useCallback, useEffect, useState } from "react";
import { AppBar, Toolbar, Typography, Button, Container, Box, Alert, IconButton, Tooltip, ToggleButtonGroup, ToggleButton } from "@mui/material";
import { MessageCircle } from "lucide-react";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import { useI18n } from "../i18n";
import { useColorMode } from "../App";

import { api } from "../api";
import QuickStart from "./QuickStart";
import ScreeningResults from "./ScreeningResults";
import ChatHelper from "./ChatHelper";
import BookingDialog from "./BookingDialog";
import AuthDialog from "./AuthDialog";
import SelfHelp from "./SelfHelp";
import Medicines from "./Medicines";
import YourData from "./YourData";
import ClinicianDashboard from "./ClinicianDashboard";
import AdminPanel from "./AdminPanel";

// Text is rendered with t("welcomeBot") in ChatHelper, so it follows the language toggle.
const WELCOME = { from: "bot", text: "", welcome: true };

export default function MentalHealthUI() {
  const { t, lang, setLang } = useI18n();
  const { mode, toggle } = useColorMode();
  const [view, setView] = useState("home");
  const [user, setUser] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);

  const [chatOpen, setChatOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [unread, setUnread] = useState(false);
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [usedFallback, setUsedFallback] = useState(false);
  const [chatError, setChatError] = useState("");

  const chatOpenRef = React.useRef(false); const minimizedRef = React.useRef(false);
  useEffect(() => { chatOpenRef.current = chatOpen; minimizedRef.current = minimized; if (chatOpen && !minimized) setUnread(false); }, [chatOpen, minimized]);
  const [result, setResult] = useState(null);
  const [clinicians, setClinicians] = useState([]);
  const [loadingClinicians, setLoadingClinicians] = useState(false);
  const [bookingClinician, setBookingClinician] = useState(null);
  const [guideTopic, setGuideTopic] = useState("anxiety");

  // Restore session (cookie) and previous chat history.
  useEffect(() => {
    api("/auth/me").then(async (d) => {
      setUser(d.user);
      if (d.user?.role === "patient") loadHistory();
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadHistory() {
    try {
      const d = await api("/me/data");
      const prior = d.chat.slice(-30).map((m) => ({ from: m.role, text: m.text }));
      if (prior.length) setMessages([WELCOME, ...prior]);
      const s = d.screenings[0];
      if (s) setResult({ score: s.score, category: s.category, severity: s.severity, matches: s.matches, source: s.source, advice: [], crisis: null });
    } catch { /* not critical */ }
  }

  function onAuthed(u) {
    setUser(u); setAuthOpen(false);
    setView(u.role === "clinician" ? "clinician" : u.role === "admin" ? "admin" : "home");
    if (u.role === "patient") loadHistory();
  }
  async function logout() {
    try { await api("/auth/logout", { method: "POST" }); } catch { /* ignore */ }
    setUser(null); setMessages([WELCOME]); setResult(null); setView("home");
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;
    const history = messages.filter((m) => !m.welcome).map(({ from, text: t }) => ({ from, text: t }));
    setMessages((prev) => [...prev, { from: "user", text }]);
    setInput(""); setSending(true); setChatError("");
    try {
      const r = await api("/chat", { method: "POST", body: { message: text, history, lang } });
      setMessages((prev) => [...prev, { from: "bot", text: r.reply, crisis: r.crisis }]);
      setResult({ ...r.screening, crisis: r.crisis });
      setUsedFallback(r.usedFallback);
      if (!chatOpenRef.current || minimizedRef.current) setUnread(true);
    } catch (e) {
      setMessages((prev) => [...prev, { from: "bot", text: e.status === 429 ? e.message : t("chatServerError") }]);
    } finally { setSending(false); }
  }

  const loadClinicians = useCallback(async (r) => {
    setLoadingClinicians(true);
    try {
      const q = r ? `?severity=${r.severity}&categories=${r.matches.map((m) => m.category).join(",")}` : "";
      setClinicians((await api(`/clinicians${q}`)).clinicians);
    } catch (e) { setChatError(e.message); } finally { setLoadingClinicians(false); }
  }, []);

  useEffect(() => { if (view === "results") loadClinicians(result); }, [view, result, loadClinicians]);

  const openGuides = (topic) => { if (topic) setGuideTopic(topic); setView("selfhelp"); };
  const needLogin = (target) => { if (!user) { setAuthOpen(true); return false; } setView(target); return true; };

  const nav = (label, v, onClick) => <Button color="inherit" onClick={onClick || (() => setView(v))} sx={{ borderBottom: view === v ? "2px solid white" : "2px solid transparent", borderRadius: 0 }}>{label}</Button>;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="static">
        <Toolbar sx={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 1, py: 1 }}>
          <Box>
            <Typography variant="h6" component="div">{t("appTitle")}</Typography>
            <Typography variant="caption" sx={{ opacity: 0.85 }}>{t("appSubtitle")}</Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", alignItems: "center" }}>
            {nav(t("navHome"), "home")}
            {nav(t("navResults"), "results")}
            {nav(t("navSelfHelp"), "selfhelp", () => openGuides())}
            {nav(t("navMedicines"), "medicines")}
            {user?.role !== "clinician" && user?.role !== "admin" && nav(t("navData"), "data", () => needLogin("data"))}
            {user?.role === "clinician" && nav(t("navClinician"), "clinician")}
            {user?.role === "admin" && nav(t("navAdmin"), "admin")}
            <Button variant="contained" color="secondary" onClick={() => { setChatOpen(true); setMinimized(false); }} startIcon={<MessageCircle size={16} />}>{t("navChat")}</Button>
            <ToggleButtonGroup exclusive size="small" value={lang} onChange={(_, v) => v && setLang(v)} aria-label={t("language")} sx={{ ml: 1, "& .MuiToggleButton-root": { color: "inherit", borderColor: "rgba(255,255,255,0.5)", py: 0.25, px: 1 }, "& .Mui-selected": { bgcolor: "rgba(255,255,255,0.25) !important" } }}>
              <ToggleButton value="en">EN</ToggleButton>
              <ToggleButton value="fi">FI</ToggleButton>
            </ToggleButtonGroup>
            <Tooltip title={mode === "dark" ? t("themeLight") : t("themeDark")}>
              <IconButton color="inherit" onClick={toggle} aria-label={mode === "dark" ? t("themeLight") : t("themeDark")}>{mode === "dark" ? <LightModeIcon /> : <DarkModeIcon />}</IconButton>
            </Tooltip>
            {user ? <Button color="inherit" onClick={logout}>{t("logOut")} ({user.name.split(" ")[0]})</Button> : <Button color="inherit" onClick={() => setAuthOpen(true)}>{t("logIn")}</Button>}
          </Box>
        </Toolbar>
      </AppBar>

      <Container sx={{ flex: 1, mt: 4, mb: 4 }}>
        {chatError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setChatError("")}>{chatError}</Alert>}
        {!user && view === "results" && result && (
          <Alert severity="info" sx={{ mb: 2 }}>{t("loginToSave")}</Alert>
        )}
        {view === "home" && <QuickStart openChat={() => { setChatOpen(true); setMinimized(false); }} goResults={() => setView("results")} goGuides={() => openGuides()} hasResult={!!result} />}
        {view === "results" && (
          <>
            <ScreeningResults result={result} clinicians={clinicians} loadingClinicians={loadingClinicians} onBook={setBookingClinician} onOpenGuides={openGuides} />
            <Box sx={{ mt: 3 }}><Button variant="outlined" onClick={() => setView("home")}>{t("backHome")}</Button></Box>
          </>
        )}
        {view === "selfhelp" && <SelfHelp initialTopic={guideTopic} />}
        {view === "medicines" && <Medicines />}
        {view === "data" && user && <YourData user={user} onLogout={logout} onUserChange={setUser} />}
        {view === "clinician" && user?.role === "clinician" && <ClinicianDashboard />}
        {view === "admin" && user?.role === "admin" && <AdminPanel />}
      </Container>

      <ChatHelper chatOpen={chatOpen} setChatOpen={setChatOpen} minimized={minimized} setMinimized={setMinimized} unread={unread} messages={messages} input={input} setInput={setInput} sendMessage={sendMessage} sending={sending} usedFallback={usedFallback} />
      <BookingDialog clinician={bookingClinician} onClose={() => { setBookingClinician(null); loadClinicians(result); }} user={user}
        onNeedLogin={() => { setBookingClinician(null); setAuthOpen(true); }} hasScreening={!!result && result.severity !== "none"} />
      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} onAuthed={onAuthed} />

      <Box component="footer" sx={{ textAlign: "center", p: 2, color: "text.secondary", mt: "auto", bgcolor: (th) => (th.palette.mode === "dark" ? "#141a20" : "#f1f3f4") }}>
        <Typography variant="caption">{t("footer")}
        © 2026 Shyam Bhetuwal. All rights reserved.</Typography>
      </Box>
    </Box>
  );
}
