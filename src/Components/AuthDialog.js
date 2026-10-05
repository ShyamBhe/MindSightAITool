import React, { useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Tabs, Tab, TextField, Button, Alert, ToggleButtonGroup, ToggleButton, MenuItem, Box, Chip, Typography } from "@mui/material";
import { api } from "../api";
import { FOCUS_LABELS, PROFESSIONS, browserTz } from "../format";

export default function AuthDialog({ open, onClose, onAuthed, initialTab = 0 }) {
  const [tab, setTab] = useState(initialTab);
  const [role, setRole] = useState("patient");
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [p, setP] = useState({ profession: "clinical_psychologist", focus: [], languages: "English", licenseNo: "", timezone: browserTz(), bio: "", priceEur: "", sessionMinutes: 50 });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setProf = (k) => (e) => setP({ ...p, [k]: e.target.value });

  async function submit() {
    setBusy(true); setError("");
    try {
      const body = tab === 0 ? { email: f.email, password: f.password } : {
        ...f, role,
        ...(role === "clinician" ? { profile: { ...p, languages: p.languages.split(",").map((s) => s.trim()).filter(Boolean), priceEur: p.priceEur === "" ? null : Number(p.priceEur), sessionMinutes: Number(p.sessionMinutes) } } : {}),
      };
      const r = await api(tab === 0 ? "/auth/login" : "/auth/register", { method: "POST", body });
      onAuthed(r.user);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        <Tabs value={tab} onChange={(_, v) => { setTab(v); setError(""); }}><Tab label="Log in" /><Tab label="Sign up" /></Tabs>
      </DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
        {tab === 1 && (
          <ToggleButtonGroup exclusive size="small" value={role} onChange={(_, v) => v && setRole(v)}>
            <ToggleButton value="patient">I'm looking for support</ToggleButton>
            <ToggleButton value="clinician">I'm a clinician</ToggleButton>
          </ToggleButtonGroup>
        )}
        {tab === 1 && <TextField label="Full name" value={f.name} onChange={set("name")} />}
        <TextField label="Email" type="email" value={f.email} onChange={set("email")} autoComplete="email" />
        <TextField label="Password" type="password" value={f.password} onChange={set("password")} helperText={tab === 1 ? "At least 10 characters" : ""} autoComplete={tab === 0 ? "current-password" : "new-password"} />
        {tab === 1 && role === "clinician" && (
          <>
            <Typography variant="subtitle2">Professional profile</Typography>
            <TextField select label="Profession" value={p.profession} onChange={setProf("profession")}>
              {Object.entries(PROFESSIONS).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
            </TextField>
            <Box>
              <Typography variant="caption" color="text.secondary">Areas you work with (choose at least one)</Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
                {Object.entries(FOCUS_LABELS).map(([k, v]) => (
                  <Chip key={k} label={v} color={p.focus.includes(k) ? "primary" : "default"} onClick={() => setP({ ...p, focus: p.focus.includes(k) ? p.focus.filter((x) => x !== k) : [...p.focus, k] })} />
                ))}
              </Box>
            </Box>
            <TextField label="Licence / registration number" value={p.licenseNo} onChange={setProf("licenseNo")} helperText="Checked by an administrator before you appear to patients. Never shown publicly." />
            <TextField label="Languages (comma separated)" value={p.languages} onChange={setProf("languages")} />
            <TextField label="Short bio" multiline minRows={2} value={p.bio} onChange={setProf("bio")} inputProps={{ maxLength: 1500 }} />
            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField label="Session (min)" type="number" value={p.sessionMinutes} onChange={setProf("sessionMinutes")} />
              <TextField label="Price (€)" type="number" value={p.priceEur} onChange={setProf("priceEur")} />
              <TextField label="Timezone" value={p.timezone} onChange={setProf("timezone")} />
            </Box>
          </>
        )}
        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={busy}>{tab === 0 ? "Log in" : "Create account"}</Button>
      </DialogActions>
    </Dialog>
  );
}
