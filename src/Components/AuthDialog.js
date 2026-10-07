import React, { useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Tabs, Tab, TextField, Button, Alert, ToggleButtonGroup, ToggleButton, MenuItem, Box, Chip, Typography, LinearProgress } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import { useI18n } from "../i18n";
import { api } from "../api";
import { FOCUS_LABELS, PROFESSIONS, browserTz } from "../format";

// Mirrors the server rules in server/app.js (passwordProblem). The server is the real gatekeeper; this is just live feedback.
function pwChecks(pw, name, email) {
  const low = pw.toLowerCase(); const local = email.split("@")[0].toLowerCase(); const first = name.trim().split(/\s+/)[0].toLowerCase();
  return [
    ["pw12", pw.length >= 12],
    ["pwCase", /[a-z]/.test(pw) && /[A-Z]/.test(pw)],
    ["pwNum", /\d/.test(pw)],
    ["pwSym", /[^A-Za-z0-9]/.test(pw)],
    ["pwPersonal", !(local.length >= 4 && low.includes(local)) && !(first.length >= 4 && low.includes(first))],
  ];
}

export default function AuthDialog({ open, onClose, onAuthed, initialTab = 0 }) {
  const { t } = useI18n();
  const [tab, setTab] = useState(initialTab);
  const [role, setRole] = useState("patient");
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [p, setP] = useState({ profession: "clinical_psychologist", focus: [], languages: "English", licenseNo: "", timezone: browserTz(), bio: "", priceEur: "", sessionMinutes: 50 });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setProf = (k) => (e) => setP({ ...p, [k]: e.target.value });

  const checks = pwChecks(f.password, f.name, f.email);
  const pwOk = checks.every(([, ok]) => ok);

  async function submit() {
    if (tab === 1 && !pwOk) { setError(t("pwRules") + " " + checks.filter(([, ok]) => !ok).map(([k]) => t(k)).join("; ")); return; }
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
        <Tabs value={tab} onChange={(_, v) => { setTab(v); setError(""); }}><Tab label={t("login")} /><Tab label={t("signUp")} /></Tabs>
      </DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
        {tab === 1 && (
          <ToggleButtonGroup exclusive size="small" value={role} onChange={(_, v) => v && setRole(v)}>
            <ToggleButton value="patient">{t("imPatient")}</ToggleButton>
            <ToggleButton value="clinician">{t("imClinician")}</ToggleButton>
          </ToggleButtonGroup>
        )}
        {tab === 1 && <TextField label={t("fullName")} value={f.name} onChange={set("name")} />}
        <TextField label={t("email")} type="email" value={f.email} onChange={set("email")} autoComplete="email" />
        <TextField label={t("password")} type="password" value={f.password} onChange={set("password")} autoComplete={tab === 0 ? "current-password" : "new-password"} />
        {tab === 1 && (
          <Box>
            <LinearProgress variant="determinate" value={(checks.filter(([, ok]) => ok).length / checks.length) * 100} color={pwOk ? "success" : "warning"} sx={{ mb: 1, borderRadius: 1 }} />
            <Typography variant="caption" color="text.secondary">{t("pwRules")}</Typography>
            {checks.map(([k, ok]) => (
              <Typography key={k} variant="body2" sx={{ display: "flex", alignItems: "center", gap: 0.5, color: ok ? "success.main" : "text.secondary" }}>
                {ok ? <CheckCircleIcon fontSize="inherit" /> : <RadioButtonUncheckedIcon fontSize="inherit" />} {t(k)}
              </Typography>
            ))}
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>{t("pwTip")}</Typography>
          </Box>
        )}
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
        <Button onClick={onClose}>{t("cancel")}</Button>
        <Button variant="contained" onClick={submit} disabled={busy || (tab === 1 && !pwOk)}>{tab === 0 ? t("login") : t("create")}</Button>
      </DialogActions>
    </Dialog>
  );
}
