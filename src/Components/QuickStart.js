import React from "react";
import { Paper, Typography, Box, Button } from "@mui/material";
import { useI18n } from "../i18n";

export default function QuickStart({ openChat, goResults, goGuides, hasResult }) {
  const { t } = useI18n();
  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>{t("welcome")}</Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        {t("welcomeText")}
      </Typography>
      <Box sx={{ mt: 2, display: "flex", gap: 2, flexWrap: "wrap" }}>
        <Button variant="contained" onClick={openChat}>{t("startChat")}</Button>
        <Button variant="outlined" onClick={goResults} disabled={!hasResult}>{t("seeResults")}</Button>
        <Button variant="outlined" onClick={goGuides}>{t("selfHelpGuides")}</Button>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 3 }}>
        {t("notDiagnosis")}
      </Typography>
    </Paper>
  );
}
