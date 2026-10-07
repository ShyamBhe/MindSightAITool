import React from "react";
import { Alert, AlertTitle, Typography, Link } from "@mui/material";
import { useI18n } from "../i18n";

export default function CrisisCard({ crisis, compact }) {
  const { t } = useI18n();
  if (!crisis) return null;
  return (
    <Alert severity="error" sx={{ my: compact ? 0 : 2 }}>
      <AlertTitle>{t("emergency")} ({crisis.country})</AlertTitle>
      {crisis.lines.map((l) => (
        <Typography key={l.name} variant="body2" sx={{ mb: 0.5 }}>
          <strong>{l.name}</strong>
          {l.phone && <>: <Link href={`tel:${l.phone.replace(/[^\d+]/g, "")}`}>{l.phone}</Link></>}
          {" "}— {l.note} {l.url && <Link href={l.url} target="_blank" rel="noreferrer">{l.url.replace("https://", "")}</Link>}
        </Typography>
      ))}
    </Alert>
  );
}
