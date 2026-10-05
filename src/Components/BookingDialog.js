import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Typography, Button, Box, TextField, Alert, FormControlLabel, Checkbox, CircularProgress } from "@mui/material";
import { api } from "../api";
import { browserTz } from "../format";

export default function BookingDialog({ clinician, onClose, user, onNeedLogin, hasScreening, onBooked }) {
  const [detail, setDetail] = useState(null);
  const [slot, setSlot] = useState(null);
  const [reason, setReason] = useState("");
  const [share, setShare] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    setDetail(null); setSlot(null); setError(""); setDone(null); setReason(""); setShare(false);
    if (clinician) api(`/clinicians/${clinician.id}`).then((d) => setDetail(d.clinician)).catch((e) => setError(e.message));
  }, [clinician]);

  const byDay = useMemo(() => {
    const m = new Map();
    (detail?.slots || []).forEach((iso) => {
      const day = new Date(iso).toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" });
      m.set(day, [...(m.get(day) || []), iso]);
    });
    return [...m.entries()];
  }, [detail]);

  if (!clinician) return null;

  async function confirm() {
    setBusy(true); setError("");
    try {
      const r = await api("/appointments", { method: "POST", body: { clinicianId: clinician.id, startUtc: slot, reason, shareSummary: share, tz: browserTz() } });
      setDone(r.appointment); onBooked?.();
    } catch (e) {
      setError(e.message);
      if (e.status === 409) api(`/clinicians/${clinician.id}`).then((d) => { setDetail(d.clinician); setSlot(null); });
    } finally { setBusy(false); }
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Book with {clinician.name}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {clinician.professionLabel} • {clinician.sessionMinutes} min • times shown in your timezone ({browserTz()})
        </Typography>
        {done ? (
          <Alert severity="success" sx={{ mt: 2 }}>
            Booked for {new Date(done.startUtc).toLocaleString([], { dateStyle: "full", timeStyle: "short" })}. A confirmation was emailed to you and {clinician.name} has been notified.
          </Alert>
        ) : !user ? (
          <Alert severity="info" sx={{ mt: 2 }} action={<Button color="inherit" size="small" onClick={onNeedLogin}>Log in / Sign up</Button>}>Please log in to book an appointment.</Alert>
        ) : user.role !== "patient" ? (
          <Alert severity="warning" sx={{ mt: 2 }}>Only patient accounts can book appointments.</Alert>
        ) : !detail ? <Box sx={{ mt: 2 }}><CircularProgress size={24} /></Box> : byDay.length === 0 ? (
          <Alert severity="info" sx={{ mt: 2 }}>No openings in the next 2 weeks.</Alert>
        ) : (
          <Box sx={{ mt: 2 }}>
            {byDay.map(([day, slots]) => (
              <Box key={day} sx={{ mb: 1.5 }}>
                <Typography variant="subtitle2">{day}</Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 0.5 }}>
                  {slots.map((iso) => (
                    <Button key={iso} size="small" variant={slot === iso ? "contained" : "outlined"} onClick={() => setSlot(iso)}>
                      {new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Button>
                  ))}
                </Box>
              </Box>
            ))}
            <TextField fullWidth multiline minRows={2} sx={{ mt: 2 }} label="What would you like help with? (optional)" value={reason} onChange={(e) => setReason(e.target.value)} inputProps={{ maxLength: 1000 }} />
            {hasScreening && (
              <FormControlLabel sx={{ mt: 1 }} control={<Checkbox checked={share} onChange={(e) => setShare(e.target.checked)} />}
                label="Share a short summary of my screening result with this clinician (your chat messages are never shared)" />
            )}
          </Box>
        )}
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{done ? "Close" : "Cancel"}</Button>
        {!done && user?.role === "patient" && <Button variant="contained" disabled={!slot || busy} onClick={confirm}>Confirm booking</Button>}
      </DialogActions>
    </Dialog>
  );
}
