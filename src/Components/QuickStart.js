import React from "react";
import { Paper, Typography, Box, Button } from "@mui/material";

export default function QuickStart({ openChat, goResults, goGuides, hasResult }) {
  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>Welcome</Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Talk to the companion about how you're feeling. It will gently screen for patterns, suggest next steps and self-help guides,
        and — if you'd like — match you with a clinician and let you book a time.
      </Typography>
      <Box sx={{ mt: 2, display: "flex", gap: 2, flexWrap: "wrap" }}>
        <Button variant="contained" onClick={openChat}>Start chatting</Button>
        <Button variant="outlined" onClick={goResults} disabled={!hasResult}>See my results</Button>
        <Button variant="outlined" onClick={goGuides}>Self-help guides</Button>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 3 }}>
        MindSight is a screening and support tool, not a diagnosis or emergency service. In an emergency call 112.
      </Typography>
    </Paper>
  );
}
