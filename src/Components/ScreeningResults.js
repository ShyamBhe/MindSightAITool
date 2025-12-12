import { Paper, Typography, Box, Chip } from "@mui/material";
import ClinicianList from "./ClinicianList";

export default function ScreeningResults({ screeningScore, advice, openReviewDoctor, setSelectedDoctor, toggleReviews }) {

  const renderSeverityBadge = (score) => {
    if (score === null) return null;
    if (score < 33) return <Chip label="Low" color="success" />;
    if (score < 66) return <Chip label="Moderate" color="warning" />;
    return <Chip label="High" color="error" />;
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>Screening Results</Typography>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <Typography variant="h4">{screeningScore}</Typography>
        {renderSeverityBadge(screeningScore)}
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        Based on your response, here are some suggested next steps:
      </Typography>
      <ul>
        {advice.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
      
      <ClinicianList onBook={setSelectedDoctor} onReviewToggle={toggleReviews} openReviewDoctor={openReviewDoctor} />
    </Paper>
  );
}
