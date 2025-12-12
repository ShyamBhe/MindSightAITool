import React from "react";
import {
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Badge,
  Chip,
  Collapse,
  Divider,
  Box,
  Typography,
  Button,
  Tooltip,
} from "@mui/material";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";

const CLINICIANS = [
  { name: "Dr. Paavo Salo", specialty: "Clinical Psychologist", rating: 4.9, contact: "paavo.lu@clinic.org", status: "Online", reviews: ["Very compassionate and helpful.", "Helped me manage my anxiety effectively.", "Professional and kind."] },
  { name: "Dr. Amit Patel", specialty: "Psychiatrist", rating: 4.8, contact: "amit.vunen@mindcare.com", status: "Offline", reviews: ["Expert in mood disorders.", "Explains things clearly.", "Great listener."] },
  { name: "Dr. Lauri Koivunen", specialty: "Doctor", rating: 4.9, contact: "sarah.nguyen@clinic.org", status: "Online", reviews: ["Very compassionate and helpful.", "Helped me manage my anxiety effectively.", "Professional and kind."] },
  { name: "Dr. Sarah Nguyen", specialty: "Clinical Psychologist", rating: 4.9, contact: "sarah.nguyen@clinic.org", status: "Online", reviews: ["Very compassionate and helpful.", "Helped me manage my anxiety effectively.", "Professional and kind."] },
  { name: "Dr. Jukka Laine", specialty: "Psychiatrist", rating: 4.1, contact: "jukka.laine@mindcare.com", status: "Offline", reviews: ["Expert in mood disorders.", "Explains things clearly.", "Great listener."] },
  { name: "Dr. Lina Roberts", specialty: "Therapist (CBT Specialist)", rating: 4.7, contact: "lina.roberts@wellness.net", status: "Online", reviews: ["CBT sessions were life changing.", "She gives practical strategies.", "Warm and approachable."] }
];

export default function ClinicianList({ onBook, onReviewToggle, openReviewDoctor }) {
  return (
    <List>
      {CLINICIANS.map((c, i) => (
        <React.Fragment key={i}>
          <ListItem
            sx={{ alignItems: "flex-start" }}
            secondaryAction={
              c.status === "Online" ? (
                <Tooltip title="Book appointment" arrow>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<EventAvailableIcon />}
                    sx={{ borderRadius: 4, textTransform: "none", ml: 2 }}
                    onClick={() => onBook(c)}
                  >
                    Book
                  </Button>
                </Tooltip>
              ) : (
                <Chip label="Offline" color="default" size="small" />
              )
            }
          >
            <ListItemAvatar>
              <Badge color={c.status === "Online" ? "success" : "error"} variant="dot" overlap="circular">
                <Avatar>{c.name.charAt(0)}</Avatar>
              </Badge>
            </ListItemAvatar>
            <ListItemText
              primary={`${c.name} (${c.specialty})`}
              secondary={`Rating: ${c.rating} • Contact: ${c.contact}`}
              onClick={() => onReviewToggle(c)}
              sx={{ cursor: "pointer", pr: 8 }}
            />
          </ListItem>
          <Collapse in={openReviewDoctor?.name === c.name} timeout="auto" unmountOnExit>
            <Box sx={{ pl: 9, pb: 2 }}>
              <Typography variant="subtitle2">Patient Reviews:</Typography>
              {c.reviews.map((r, idx) => (
                <Typography key={idx} variant="body2" sx={{ color: "text.secondary" }}>• {r}</Typography>
              ))}
            </Box>
          </Collapse>
          <Divider />
        </React.Fragment>
      ))}
    </List>
  );
}
