import React, { useCallback, useEffect, useState } from "react";
import { Paper, Typography, Box, Chip, Button, Alert, Divider } from "@mui/material";
import { api } from "../api";
import { PROFESSIONS } from "../format";

export default function AdminPanel() {
  const [list, setList] = useState([]);
  const [error, setError] = useState("");
  const load = useCallback(() => api("/admin/clinicians").then((d) => setList(d.clinicians)).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);
  const set = async (id, verified) => { try { await api(`/admin/clinicians/${id}/verify`, { method: "POST", body: { verified } }); load(); } catch (e) { setError(e.message); } };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>Admin: clinician verification</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Check each licence number in the official national register (in Finland: Valvira's Terhikki) before verifying.</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {list.map((c) => (
        <Box key={c.id}>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", py: 1 }}>
            <Typography sx={{ fontWeight: 600, minWidth: 180 }}>{c.name}</Typography>
            <Typography variant="body2">{PROFESSIONS[c.profession]} • {c.email} • Licence: {c.licenseNo || "—"}</Typography>
            {c.isDemo && <Chip size="small" label="Demo" />}
            <Chip size="small" color={c.verified ? "success" : "warning"} label={c.verified ? "Verified" : "Pending"} />
            <Button size="small" onClick={() => set(c.id, !c.verified)}>{c.verified ? "Revoke" : "Verify"}</Button>
          </Box>
          <Divider />
        </Box>
      ))}
    </Paper>
  );
}
