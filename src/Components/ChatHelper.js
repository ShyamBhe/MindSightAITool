import React, { useEffect, useRef, useState, useCallback } from "react";
import { Paper, Box, Typography, TextField, IconButton, CircularProgress, Alert, Fab, Tooltip, Badge } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import CloseIcon from "@mui/icons-material/Close";
import MinimizeIcon from "@mui/icons-material/Remove";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import ChatIcon from "@mui/icons-material/ChatBubbleOutline";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import CrisisCard from "./CrisisCard";
import { useI18n } from "../i18n";

const SR = typeof window !== "undefined" ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;

export default function ChatHelper({ chatOpen, setChatOpen, minimized, setMinimized, unread, messages, input, setInput, sendMessage, sending, usedFallback }) {
  const { t, locale } = useI18n();
  const endRef = useRef(null);
  const recRef = useRef(null);
  const lastSpokenRef = useRef(messages.length);
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState("");
  const [speakReplies, setSpeakReplies] = useState(false);

  useEffect(() => { if (chatOpen && !minimized) endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, sending, chatOpen, minimized]);

  // Read new bot replies aloud (browser's built-in text-to-speech, no cost, no API key).
  useEffect(() => {
    if (messages.length <= lastSpokenRef.current) { lastSpokenRef.current = messages.length; return; }
    const last = messages[messages.length - 1];
    lastSpokenRef.current = messages.length;
    if (speakReplies && canSpeak && last?.from === "bot") {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(last.text);
      u.lang = locale;
      window.speechSynthesis.speak(u);
    }
  }, [messages, speakReplies, locale]);
  useEffect(() => () => { recRef.current?.abort?.(); if (canSpeak) window.speechSynthesis.cancel(); }, []);

  const toggleSpeak = () => { if (speakReplies && canSpeak) window.speechSynthesis.cancel(); setSpeakReplies((v) => !v); };

  const toggleMic = useCallback(() => {
    if (!SR) return;
    if (listening) { recRef.current?.stop(); return; }
    setMicError("");
    const rec = new SR();
    rec.lang = locale;
    rec.interimResults = true;
    rec.continuous = false;
    const base = input ? input.trimEnd() + " " : "";
    rec.onresult = (e) => setInput(base + Array.from(e.results).map((r) => r[0].transcript).join(""));
    rec.onerror = (e) => { if (e.error === "not-allowed" || e.error === "service-not-allowed") setMicError(t("micDenied")); setListening(false); };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    try { rec.start(); } catch { setListening(false); }
  }, [listening, locale, input, setInput, t]);

  // Closed: floating chat button (bottom-right) so chat is reachable from every page.
  if (!chatOpen) {
    return (
      <Tooltip title={t("chatOpen")} placement="left">
        <Fab color="secondary" aria-label={t("chatOpen")} onClick={() => { setChatOpen(true); setMinimized(false); }}
          sx={{ position: "fixed", bottom: 20, right: 20, zIndex: 1300 }}>
          <Badge color="error" variant="dot" invisible={!unread}><ChatIcon /></Badge>
        </Fab>
      </Tooltip>
    );
  }

  const header = (
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: minimized ? "pointer" : "default" }} onClick={minimized ? () => setMinimized(false) : undefined}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        <Badge color="error" variant="dot" invisible={!(minimized && unread)} sx={{ "& .MuiBadge-badge": { right: -8 } }}>{t("chatTitle")}</Badge>
      </Typography>
      <Box onClick={(e) => e.stopPropagation()}>
        {!minimized && canSpeak && (
          <Tooltip title={speakReplies ? t("speakOn") : t("speakOff")}>
            <IconButton size="small" onClick={toggleSpeak} aria-label={speakReplies ? t("speakOn") : t("speakOff")}>{speakReplies ? <VolumeUpIcon fontSize="small" /> : <VolumeOffIcon fontSize="small" />}</IconButton>
          </Tooltip>
        )}
        <Tooltip title={minimized ? t("chatExpand") : t("chatMinimize")}>
          <IconButton size="small" onClick={() => setMinimized(!minimized)} aria-label={minimized ? t("chatExpand") : t("chatMinimize")}>{minimized ? <OpenInFullIcon fontSize="small" /> : <MinimizeIcon fontSize="small" />}</IconButton>
        </Tooltip>
        <Tooltip title={t("chatClose")}>
          <IconButton size="small" onClick={() => setChatOpen(false)} aria-label={t("chatClose")}><CloseIcon fontSize="small" /></IconButton>
        </Tooltip>
      </Box>
    </Box>
  );

  return (
    <Paper elevation={6} sx={{ position: "fixed", bottom: 16, right: 16, width: { xs: "calc(100% - 32px)", sm: 380 }, p: 2, display: "flex", flexDirection: "column", maxHeight: "75vh", zIndex: 1300 }}>
      {header}
      {!minimized && (
        <>
          <Typography variant="caption" color="text.secondary">{t("chatDisclaimer")}</Typography>
          {usedFallback && <Alert severity="info" sx={{ mt: 1, py: 0 }}>{t("chatFallback")}</Alert>}
          <Box sx={{ flex: 1, overflowY: "auto", my: 2, display: "flex", flexDirection: "column", gap: 1, minHeight: 120 }}>
            {messages.map((m, i) => (
              <React.Fragment key={i}>
                <Box sx={{ alignSelf: m.from === "bot" ? "flex-start" : "flex-end", bgcolor: m.from === "bot" ? (th) => (th.palette.mode === "dark" ? "grey.800" : "grey.200") : "primary.main", color: m.from === "bot" ? "text.primary" : "primary.contrastText", px: 2, py: 1, borderRadius: 2, maxWidth: "88%", whiteSpace: "pre-wrap" }}>
                  {m.welcome ? t("welcomeBot") : m.text}
                </Box>
                {m.crisis && <CrisisCard crisis={m.crisis} compact />}
              </React.Fragment>
            ))}
            {sending && <Box sx={{ alignSelf: "flex-start", px: 2 }}><CircularProgress size={18} /></Box>}
            <div ref={endRef} />
          </Box>
          {(listening || micError) && <Typography variant="caption" color={micError ? "error" : "primary"} sx={{ mb: 0.5 }}>{micError || t("listening")}</Typography>}
          <Box sx={{ display: "flex", gap: 1, alignItems: "flex-end" }}>
            <TextField fullWidth size="small" value={input} multiline maxRows={4} inputProps={{ maxLength: 2000 }}
              onChange={(e) => setInput(e.target.value)} placeholder={t("chatPlaceholder")}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} />
            {SR && (
              <Tooltip title={listening ? t("micStop") : t("micStart")}>
                <IconButton color={listening ? "error" : "default"} onClick={toggleMic} aria-label={listening ? t("micStop") : t("micStart")}>{listening ? <MicOffIcon /> : <MicIcon />}</IconButton>
              </Tooltip>
            )}
            <IconButton color="primary" onClick={sendMessage} disabled={sending || !input.trim()} aria-label={t("send")}><SendIcon /></IconButton>
          </Box>
        </>
      )}
    </Paper>
  );
}
