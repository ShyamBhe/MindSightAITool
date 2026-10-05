import React, { useCallback, useEffect, useState } from "react";
import { Paper, Typography, Box, Chip, Button, Divider, Alert, Switch, FormControlLabel, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Rating } from "@mui/material";
import { api } from "../api";
import { fmtDateTime, severityColor, titleCase } from "../format";

export default function YourData({ user, onLogout, onUserChange }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [del, setDel] = useState(false);
  const [pw, setPw] = useState("");
  const [appts, setAppts] = useState([]);
  const [review, setReview] = useState(null);
  const [rv, setRv] = useState({ rating: 5, comment: "" });

  const load = useCallback(() => {
    api("/me/data").then(setData).catch((e) => setError(e.message));
    api("/appointments").then((d) => setAppts(d.appointments)).catch(() => {});
  }, []);
  useEffect(load, [load]);

  async function act(fn) { setError(""); try { await fn(); load(); } catch (e) { setError(e.message); } }

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>Your data</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Signed in as {user.name} ({user.email}). You control this data: view, export or delete it any time.</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Typography variant="h6">Appointments</Typography>
      {appts.length === 0 && <Typography color="text.secondary" sx={{ mb: 2 }}>No appointments yet.</Typography>}
      {appts.map((a) => {
        const past = new Date(a.endUtc) < new Date();
        return (
          <Box key={a.id} sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", my: 1 }}>
            <Typography variant="body2" sx={{ minWidth: 200 }}>{fmtDateTime(a.startUtc)} — {a.clinician.name}</Typography>
            <Chip size="small" label={a.status} color={a.status === "confirmed" ? "success" : "default"} />
            {a.status === "confirmed" && !past && <Button size="small" color="error" onClick={() => act(() => api(`/appointments/${a.id}/cancel`, { method: "POST" }))}>Cancel</Button>}
            {a.status !== "cancelled" && past && <Button size="small" onClick={() => setReview(a)}>Leave a review</Button>}
          </Box>
        );
      })}
      <Divider sx={{ my: 3 }} />

      <Typography variant="h6">Screening history</Typography>
      {data?.screenings.length === 0 && <Typography color="text.secondary">Nothing recorded yet. Results are saved when you chat while logged in.</Typography>}
      {data?.screenings.slice(0, 30).map((s) => (
        <Box key={s.id} sx={{ display: "flex", gap: 1, alignItems: "center", my: 0.5, flexWrap: "wrap" }}>
          <Typography variant="body2" sx={{ minWidth: 150 }}>{fmtDateTime(s.createdAt.replace(" ", "T") + "Z")}</Typography>
          <Chip size="small" label={titleCase(s.severity)} color={severityColor(s.severity)} />
          <Typography variant="body2">{titleCase(s.category || "")}</Typography>
        </Box>
      ))}
      <Divider sx={{ my: 3 }} />

      <Typography variant="h6">Privacy</Typography>
      <FormControlLabel control={<Switch checked={user.researchConsent} onChange={(e) => act(async () => onUserChange((await api("/me", { method: "PATCH", body: { researchConsent: e.target.checked } })).user))} />}
        label="Allow my anonymised data to be used to improve MindSight (off by default)" />
      <Box sx={{ display: "flex", gap: 1, mt: 2, flexWrap: "wrap" }}>
        <Button variant="outlined" component="a" href="/api/me/export" download>Download my data (JSON)</Button>
        <Button variant="outlined" onClick={() => act(() => api("/me/chat", { method: "DELETE" }))}>Delete my chat history</Button>
        <Button variant="outlined" color="error" onClick={() => setDel(true)}>Delete my account</Button>
      </Box>

      <Dialog open={del} onClose={() => setDel(false)}>
        <DialogTitle>Delete account permanently?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>This removes your profile, chat history, screenings and appointments. Upcoming appointments will be cancelled and the clinician notified. This cannot be undone.</Typography>
          <TextField fullWidth type="password" label="Confirm with your password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDel(false)}>Keep my account</Button>
          <Button color="error" onClick={() => act(async () => { await api("/me", { method: "DELETE", body: { password: pw } }); onLogout(); })}>Delete</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!review} onClose={() => setReview(null)} fullWidth maxWidth="xs">
        <DialogTitle>Review {review?.clinician.name}</DialogTitle>
        <DialogContent>
          <Rating value={rv.rating} onChange={(_, v) => setRv({ ...rv, rating: v || 1 })} sx={{ my: 1 }} />
          <TextField fullWidth multiline minRows={2} label="Comment (optional, shown with your first name)" value={rv.comment} onChange={(e) => setRv({ ...rv, comment: e.target.value })} inputProps={{ maxLength: 800 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReview(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => act(async () => { await api(`/clinicians/${review.clinician.id}/reviews`, { method: "POST", body: rv }); setReview(null); })}>Submit</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
