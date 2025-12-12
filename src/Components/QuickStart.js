import React from "react";
import { Paper, Typography, Box, Button } from "@mui/material";

export default function QuickStart({ runQuickScreening, setView }) {
  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>Quick Start</Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Run a 1-minute screening in chat to detect risk patterns, get tailored self-care actions, and choose to connect with a clinician.
      </Typography>
      <Box sx={{ mt: 2, display: "flex", gap: 2 }}>
        <Button variant="outlined" onClick={runQuickScreening}>See Results</Button>
      </Box>
    </Paper>
  );
}
