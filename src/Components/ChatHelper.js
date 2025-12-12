import React from "react";
import { Paper, Box, Typography, Button, TextField, IconButton } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";

export default function ChatHelper({ chatOpen, setChatOpen, messages, input, setInput, sendMessage }) {
  if (!chatOpen) return null;

  return (
    <Paper elevation={6} sx={{ position: "fixed", bottom: 16, right: 16, width: 360, p: 2, display: "flex", flexDirection: "column", maxHeight: "70vh" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="subtitle1">Companion</Typography>
        <Button size="small" onClick={() => setChatOpen(false)}>Close</Button>
      </Box>
      <Box sx={{ flex: 1, overflowY: "auto", my: 2, display: "flex", flexDirection: "column", gap: 1 }}>
        {messages.map((m, i) => (
          <Box key={i} sx={{ alignSelf: m.from === 'bot' ? 'flex-start' : 'flex-end', bgcolor: m.from === 'bot' ? 'grey.200' : 'primary.main', color: m.from === 'bot' ? 'black' : 'white', px: 2, py: 1, borderRadius: 2 }}>
            {m.text}
          </Box>
        ))}
      </Box>
      <Box sx={{ display: "flex", gap: 1 }}>
        <TextField fullWidth size="small" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type a message..." />
        <IconButton color="primary" onClick={sendMessage}><SendIcon /></IconButton>
      </Box>
    </Paper>
  );
}
