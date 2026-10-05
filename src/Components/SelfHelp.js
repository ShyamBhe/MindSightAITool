import React, { useEffect, useState } from "react";
import { Paper, Typography, Tabs, Tab, Accordion, AccordionSummary, AccordionDetails, Alert, Box, Chip } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { api } from "../api";

export default function SelfHelp({ initialTopic = "anxiety" }) {
  const [data, setData] = useState(null);
  const [topic, setTopic] = useState(initialTopic);
  const [error, setError] = useState("");
  useEffect(() => { api("/guides").then(setData).catch((e) => setError(e.message)); }, []);
  useEffect(() => setTopic(initialTopic), [initialTopic]);
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return null;
  const t = data.topics.find((x) => x.id === topic) || data.topics[0];

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>Self-help guides</Typography>
      <Alert severity="info" sx={{ mb: 2 }}>{data.disclaimer}</Alert>
      <Tabs value={t.id} onChange={(_, v) => setTopic(v)} variant="scrollable" sx={{ mb: 2 }}>
        {data.topics.map((x) => <Tab key={x.id} value={x.id} label={x.title} />)}
      </Tabs>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t.intro}</Typography>
      {data.guides.filter((g) => g.topic === t.id).map((g) => (
        <Accordion key={g.id} disableGutters>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box>
              <Typography sx={{ fontWeight: 600 }}>{g.title} <Chip size="small" label={`${g.minutes} min`} sx={{ ml: 1 }} /></Typography>
              <Typography variant="body2" color="text.secondary">{g.summary}</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <ol style={{ margin: 0, paddingLeft: 20 }}>{g.steps.map((s, i) => <li key={i}><Typography variant="body2" sx={{ mb: 1 }}>{s}</Typography></li>)}</ol>
            {g.tip && <Alert severity="success" sx={{ mt: 1 }}>{g.tip}</Alert>}
          </AccordionDetails>
        </Accordion>
      ))}
    </Paper>
  );
}
