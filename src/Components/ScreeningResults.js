import React from "react";
import { Paper, Typography, Box, Chip, Divider, Button, CircularProgress } from "@mui/material";
import ClinicianList from "./ClinicianList";
import CrisisCard from "./CrisisCard";
import { titleCase, severityColor } from "../format";
import { useI18n } from "../i18n";

const FOCUS_TO_TOPIC = { anxiety: "anxiety", depression: "depression", sleep: "sleep", burnout: "stress" };
const CATEGORY_FOCUS = { panic_attack: "anxiety", severe_anxiety: "anxiety", anxiety: "anxiety", severe_depression: "depression", depression: "depression", social_isolation: "depression", sleep_problem: "sleep", burnout_overwhelm: "burnout" };

export default function ScreeningResults({ result, clinicians, loadingClinicians, onBook, onOpenGuides }) {
  const { t } = useI18n();
  if (!result) {
    return <Paper sx={{ p: 3 }}><Typography color="text.secondary">{t("noResult")}</Typography></Paper>;
  }
  const { score, category, severity, matches, advice, crisis } = result;
  const topics = [...new Set(matches.map((m) => FOCUS_TO_TOPIC[CATEGORY_FOCUS[m.category]]).filter(Boolean))];

  return (
    <Paper sx={{ p: 3, borderRadius: 2 }}>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>{t("resultsTitle")}</Typography>
      <CrisisCard crisis={crisis} />
      <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 2, mb: 1 }}>
        <Chip label={severity === "none" ? t("noConcern") : t("concern", { s: titleCase(severity) })} color={severityColor(severity)} />
        <Typography variant="h6">{category === "no_detected_rule" ? t("noPattern") : titleCase(category)}</Typography>
      </Box>
      <Typography variant="caption" color="text.secondary">
        {t("screeningNote", { score, src: result.source === "rules" ? t("srcRules") : t("srcAi") })}
      </Typography>
      <Divider sx={{ my: 3 }} />

      {matches.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>{t("patterns")}</Typography>
          {matches.map((m) => (
            <Box key={m.category} sx={{ display: "flex", gap: 1, alignItems: "center", mb: 0.5, flexWrap: "wrap" }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{titleCase(m.category)}</Typography>
              <Chip size="small" variant="outlined" label={titleCase(m.severity)} />
              {m.matchedKeywords?.length > 0 && <Typography variant="caption" color="text.secondary">{t("matched")}: {m.matchedKeywords.join(", ")}</Typography>}
            </Box>
          ))}
        </Box>
      )}

      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>{t("nextSteps")}</Typography>
      {advice.map((a, i) => <Typography key={i} variant="body2" sx={{ mb: 1, pl: 1 }}>• {a}</Typography>)}
      {topics.length > 0 && (
        <Box sx={{ mt: 1, display: "flex", gap: 1, flexWrap: "wrap" }}>
          {topics.map((tp) => <Button key={tp} size="small" variant="outlined" onClick={() => onOpenGuides(tp)}>{t("selfHelpTopic", { t: titleCase(tp) })}</Button>)}
        </Box>
      )}

      <Divider sx={{ my: 3 }} />
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        {severity === "none" || severity === "low" ? t("cliniciansLow") : t("cliniciansRec")}
      </Typography>
      <Typography variant="caption" color="text.secondary">{t("cliniciansRank")}</Typography>
      {loadingClinicians ? <Box sx={{ p: 2 }}><CircularProgress size={24} /></Box> : <ClinicianList clinicians={clinicians} onBook={onBook} />}
    </Paper>
  );
}
