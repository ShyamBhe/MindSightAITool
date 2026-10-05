import React, { useCallback, useEffect, useState } from "react";
import { Paper, Typography, Tabs, Tab, Box, Button, TextField, Alert, Chip, MenuItem, IconButton, Divider } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import { api } from "../api";
import { FOCUS_LABELS, PROFESSIONS, fmtDateTime } from "../format";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function ClinicianDashboard() {
  const [tab, setTab] = useState(0);
  const [profile, setProfile] = useState(null);
  const [windows, setWindows] = useState([]);
  const [appts, setAppts] = useState([]);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    try {
      const p = await api("/clinician/profile");
      setProfile({ ...p.profile, languagesText: p.profile.languages.join(", ") });
      setWindows(p.availability);
      setAppts((await api("/appointments")).appointments);
    } catch (e) { setMsg({ type: "error", text: e.message }); }
  }, []);
  useEffect(() => { load(); }, [load]);
  if (!profile) return msg ? <Alert severity="error">{msg.text}</Alert> : null;

  const flash = (type, text) => { setMsg({ type, text }); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const saveAvail = async () => { try { await api("/clinician/availability", { method: "PUT", body: { windows } }); flash("success", "Availability saved. Patients can now book these times."); load(); } catch (e) { flash("error", e.message); } };
  const saveProfile = async () => {
    try {
      await api("/clinician/profile", { method: "PUT", body: { ...profile, languages: profile.languagesText.split(",").map((s) => s.trim()).filter(Boolean) } });
      flash("success", "Profile saved."); load();
    } catch (e) { flash("error", e.message); }
  };
  const apptAction = async (id, a) => { try { await api(`/appointments/${id}/${a}`, { method: "POST" }); load(); } catch (e) { flash("error", e.message); } };
  const upd = (i, k, v) => setWindows(windows.map((w, j) => (j === i ? { ...w, [k]: v } : w)));

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>Clinician area</Typography>
      {!profile.verified && <Alert severity="warning" sx={{ mb: 2 }}>Your registration is awaiting verification by an administrator. You will not appear to patients until then.</Alert>}
      {profile.verified && windows.length === 0 && <Alert severity="info" sx={{ mb: 2 }}>Add your weekly availability so patients can book you.</Alert>}
      {msg && <Alert severity={msg.type} sx={{ mb: 2 }} onClose={() => setMsg(null)}>{msg.text}</Alert>}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={`Appointments (${appts.filter((a) => a.status === "confirmed").length})`} /><Tab label="Availability" /><Tab label="Profile" />
      </Tabs>

      {tab === 0 && (appts.length === 0 ? <Typography color="text.secondary">No appointments yet. You'll get an email for each new booking.</Typography> :
        appts.map((a) => {
          const past = new Date(a.endUtc) < new Date();
          return (
            <Box key={a.id} sx={{ mb: 2 }}>
              <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                <Typography sx={{ fontWeight: 600 }}>{fmtDateTime(a.startUtc, profile.timezone)}</Typography>
                <Typography>{a.patient.name}</Typography>
                <Chip size="small" label={a.status} color={a.status === "confirmed" ? "success" : "default"} />
                {a.status === "confirmed" && past && <Button size="small" onClick={() => apptAction(a.id, "complete")}>Mark completed</Button>}
                {a.status === "confirmed" && !past && <Button size="small" color="error" onClick={() => apptAction(a.id, "cancel")}>Cancel</Button>}
              </Box>
              {a.reason && <Typography variant="body2" color="text.secondary">Reason: {a.reason}</Typography>}
              {a.sharedSummary && <Typography variant="body2" color="text.secondary">{a.sharedSummary}</Typography>}
              <Divider sx={{ mt: 1 }} />
            </Box>
          );
        }))}

      {tab === 1 && (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Weekly recurring windows in your timezone ({profile.timezone}). Slots of {profile.sessionMinutes} min (+10 min buffer) are generated automatically for the next 2 weeks.</Typography>
          {ORDER.map((d) => (
            <Box key={d} sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, flexWrap: "wrap" }}>
              <Typography sx={{ width: 100 }}>{DAYS[d]}</Typography>
              {windows.map((w, i) => w.weekday !== d ? null : (
                <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <TextField size="small" type="time" value={w.start} onChange={(e) => upd(i, "start", e.target.value)} />–
                  <TextField size="small" type="time" value={w.end} onChange={(e) => upd(i, "end", e.target.value)} />
                  <IconButton size="small" onClick={() => setWindows(windows.filter((_, j) => j !== i))} aria-label="remove"><DeleteIcon fontSize="small" /></IconButton>
                </Box>
              ))}
              <Button size="small" startIcon={<AddIcon />} onClick={() => setWindows([...windows, { weekday: d, start: "09:00", end: "12:00" }])}>Add</Button>
            </Box>
          ))}
          <Button variant="contained" sx={{ mt: 2 }} onClick={saveAvail}>Save availability</Button>
        </Box>
      )}

      {tab === 2 && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, maxWidth: 560 }}>
          <TextField label="Name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
          <TextField select label="Profession" value={profile.profession} onChange={(e) => setProfile({ ...profile, profession: e.target.value })}>
            {Object.entries(PROFESSIONS).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
          </TextField>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {Object.entries(FOCUS_LABELS).map(([k, v]) => <Chip key={k} label={v} color={profile.focus.includes(k) ? "primary" : "default"} onClick={() => setProfile({ ...profile, focus: profile.focus.includes(k) ? profile.focus.filter((x) => x !== k) : [...profile.focus, k] })} />)}
          </Box>
          <TextField label="Licence / registration number" value={profile.licenseNo} onChange={(e) => setProfile({ ...profile, licenseNo: e.target.value })} />
          <TextField label="Languages (comma separated)" value={profile.languagesText} onChange={(e) => setProfile({ ...profile, languagesText: e.target.value })} />
          <TextField label="Bio" multiline minRows={3} value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} inputProps={{ maxLength: 1500 }} />
          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField label="Session (min)" type="number" value={profile.sessionMinutes} onChange={(e) => setProfile({ ...profile, sessionMinutes: Number(e.target.value) })} />
            <TextField label="Price (€)" type="number" value={profile.priceEur ?? ""} onChange={(e) => setProfile({ ...profile, priceEur: e.target.value })} />
            <TextField label="Timezone" value={profile.timezone} onChange={(e) => setProfile({ ...profile, timezone: e.target.value })} />
          </Box>
          <TextField select label="Accepting new patients" value={profile.accepting ? "yes" : "no"} onChange={(e) => setProfile({ ...profile, accepting: e.target.value === "yes" })}>
            <MenuItem value="yes">Yes</MenuItem><MenuItem value="no">No (hide me from patients)</MenuItem>
          </TextField>
          <Button variant="contained" onClick={saveProfile}>Save profile</Button>
        </Box>
      )}
    </Paper>
  );
}
