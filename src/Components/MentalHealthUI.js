import React, { useCallback, useEffect, useState } from "react";
import { AppBar, Toolbar, Typography, Button, Container, Box, Alert } from "@mui/material";
import { MessageCircle } from "lucide-react";

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

const WELCOME = { from: "bot", text: "Hi, I'm your companion. How are you feeling today?" };

export default function MentalHealthUI() {
  const [view, setView] = useState("home");
  const [user, setUser] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);

  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [usedFallback, setUsedFallback] = useState(false);
  const [chatError, setChatError] = useState("");

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
    const history = messages.filter((m) => m !== WELCOME).map(({ from, text: t }) => ({ from, text: t }));
    setMessages((prev) => [...prev, { from: "user", text }]);
    setInput(""); setSending(true); setChatError("");
    try {
      const r = await api("/chat", { method: "POST", body: { message: text, history } });
      setMessages((prev) => [...prev, { from: "bot", text: r.reply, crisis: r.crisis }]);
      setResult({ ...r.screening, crisis: r.crisis });
      setUsedFallback(r.usedFallback);
    } catch (e) {
      setMessages((prev) => [...prev, { from: "bot", text: e.status === 429 ? e.message : "Sorry, I couldn't reach the server. Please try again in a moment. If you are in danger, call 112 right now." }]);
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
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh", bgcolor: "#f9fafb" }}>
      <AppBar position="static">
        <Toolbar sx={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 1, py: 1 }}>
          <Box>
            <Typography variant="h6" component="div">MindSight — AI-powered Mental Health Companion</Typography>
            <Typography variant="caption" sx={{ opacity: 0.85 }}>Early detection • Personalized suggestions • Clinician handoff</Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", alignItems: "center" }}>
            {nav("Home", "home")}
            {nav("Results", "results")}
            {nav("Self-help", "selfhelp", () => openGuides())}
            {nav("Medicines", "medicines")}
            {user?.role !== "clinician" && user?.role !== "admin" && nav("Your data", "data", () => needLogin("data"))}
            {user?.role === "clinician" && nav("Clinician area", "clinician")}
            {user?.role === "admin" && nav("Admin", "admin")}
            <Button variant="contained" color="secondary" onClick={() => setChatOpen(true)} startIcon={<MessageCircle size={16} />}>Chat</Button>
            {user ? <Button color="inherit" onClick={logout}>Log out ({user.name.split(" ")[0]})</Button> : <Button color="inherit" onClick={() => setAuthOpen(true)}>Log in</Button>}
          </Box>
        </Toolbar>
      </AppBar>

      <Container sx={{ flex: 1, mt: 4, mb: 4 }}>
        {chatError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setChatError("")}>{chatError}</Alert>}
        {!user && view === "results" && result && (
          <Alert severity="info" sx={{ mb: 2 }}>Log in or sign up to save your results and book an appointment.</Alert>
        )}
        {view === "home" && <QuickStart openChat={() => setChatOpen(true)} goResults={() => setView("results")} goGuides={() => openGuides()} hasResult={!!result} />}
        {view === "results" && (
          <>
            <ScreeningResults result={result} clinicians={clinicians} loadingClinicians={loadingClinicians} onBook={setBookingClinician} onOpenGuides={openGuides} />
            <Box sx={{ mt: 3 }}><Button variant="outlined" onClick={() => setView("home")}>Back to Home</Button></Box>
          </>
        )}
        {view === "selfhelp" && <SelfHelp initialTopic={guideTopic} />}
        {view === "medicines" && <Medicines />}
        {view === "data" && user && <YourData user={user} onLogout={logout} onUserChange={setUser} />}
        {view === "clinician" && user?.role === "clinician" && <ClinicianDashboard />}
        {view === "admin" && user?.role === "admin" && <AdminPanel />}
      </Container>

      <ChatHelper chatOpen={chatOpen} setChatOpen={setChatOpen} messages={messages} input={input} setInput={setInput} sendMessage={sendMessage} sending={sending} usedFallback={usedFallback} />
      <BookingDialog clinician={bookingClinician} onClose={() => { setBookingClinician(null); loadClinicians(result); }} user={user}
        onNeedLogin={() => { setBookingClinician(null); setAuthOpen(true); }} hasScreening={!!result && result.severity !== "none"} />
      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} onAuthed={onAuthed} />

      <Box component="footer" sx={{ textAlign: "center", p: 2, color: "text.secondary", mt: "auto", bgcolor: "#f1f3f4" }}>
        <Typography variant="caption">MindSight is not a medical device or emergency service and does not provide diagnoses. In an emergency call 112.</Typography>
      </Box>
    </Box>
  );
}
