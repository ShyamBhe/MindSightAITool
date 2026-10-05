import React, { useEffect, useRef } from "react";
import { Paper, Box, Typography, Button, TextField, IconButton, CircularProgress, Alert } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import CrisisCard from "./CrisisCard";

export default function ChatHelper({ chatOpen, setChatOpen, messages, input, setInput, sendMessage, sending, usedFallback }) {
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, sending, chatOpen]);
  if (!chatOpen) return null;

  return (
    <Paper elevation={6} sx={{ position: "fixed", bottom: 16, right: 16, width: { xs: "calc(100% - 32px)", sm: 380 }, p: 2, display: "flex", flexDirection: "column", maxHeight: "75vh", zIndex: 1300 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="subtitle1">Companion</Typography>
        <Button size="small" onClick={() => setChatOpen(false)}>Close</Button>
      </Box>
      <Typography variant="caption" color="text.secondary">
        AI-assisted chat (Google Gemini). Not a doctor; it can make mistakes. Don't share anything you wouldn't want processed by an AI service.
      </Typography>
      {usedFallback && <Alert severity="info" sx={{ mt: 1, py: 0 }}>AI is temporarily unavailable, so I'm using simpler replies.</Alert>}
      <Box sx={{ flex: 1, overflowY: "auto", my: 2, display: "flex", flexDirection: "column", gap: 1 }}>
        {messages.map((m, i) => (
          <React.Fragment key={i}>
            <Box sx={{ alignSelf: m.from === "bot" ? "flex-start" : "flex-end", bgcolor: m.from === "bot" ? "grey.200" : "primary.main", color: m.from === "bot" ? "black" : "white", px: 2, py: 1, borderRadius: 2, maxWidth: "88%", whiteSpace: "pre-wrap" }}>
              {m.text}
            </Box>
            {m.crisis && <CrisisCard crisis={m.crisis} compact />}
          </React.Fragment>
        ))}
        {sending && <Box sx={{ alignSelf: "flex-start", px: 2 }}><CircularProgress size={18} /></Box>}
        <div ref={endRef} />
      </Box>
      <Box sx={{ display: "flex", gap: 1 }}>
        <TextField fullWidth size="small" value={input} multiline maxRows={4} inputProps={{ maxLength: 2000 }}
          onChange={(e) => setInput(e.target.value)} placeholder="Type a message..."
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} />
        <IconButton color="primary" onClick={sendMessage} disabled={sending || !input.trim()} aria-label="Send"><SendIcon /></IconButton>
      </Box>
    </Paper>
  );
}
