import React, { useEffect, useState } from "react";
import { Paper, Typography, Accordion, AccordionSummary, AccordionDetails, Alert, Chip, Box, TextField } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { api } from "../api";

const List = ({ title, items }) => (
  <Box sx={{ mb: 1.5 }}>
    <Typography variant="subtitle2">{title}</Typography>
    <ul style={{ margin: 0, paddingLeft: 20 }}>{items.map((x, i) => <li key={i}><Typography variant="body2">{x}</Typography></li>)}</ul>
  </Box>
);

export default function Medicines() {
  const [data, setData] = useState(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { api("/medicines").then(setData).catch((e) => setError(e.message)); }, []);
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return null;
  const needle = q.trim().toLowerCase();
  const classes = data.classes.filter((c) => !needle || JSON.stringify(c).toLowerCase().includes(needle));

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>Medicines for mental health: information</Typography>
      <Alert severity="warning" sx={{ mb: 2 }}>{data.disclaimer}</Alert>
      <TextField size="small" fullWidth placeholder="Search by medicine name or condition (e.g. sertraline, anxiety)" value={q} onChange={(e) => setQ(e.target.value)} sx={{ mb: 2 }} />
      {classes.length === 0 && <Typography color="text.secondary">Nothing found. Ask your pharmacist or doctor.</Typography>}
      {classes.map((c) => (
        <Accordion key={c.id} disableGutters>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box>
              <Typography sx={{ fontWeight: 600 }}>{c.name}</Typography>
              <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 0.5 }}>{c.examples.map((e) => <Chip key={e} size="small" label={e} />)}</Box>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <List title="Often used for" items={c.usedFor} />
            <Typography variant="subtitle2">How it works</Typography><Typography variant="body2" sx={{ mb: 1.5 }}>{c.howItWorks}</Typography>
            <Typography variant="subtitle2">What to expect</Typography><Typography variant="body2" sx={{ mb: 1.5 }}>{c.whatToExpect}</Typography>
            <List title="Common side effects" items={c.commonSideEffects} />
            <List title="Important warnings" items={c.importantWarnings} />
          </AccordionDetails>
        </Accordion>
      ))}
      <Box sx={{ mt: 3 }}><List title="General safety" items={data.generalSafety} /></Box>
    </Paper>
  );
}
