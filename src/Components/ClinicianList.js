import React, { useState } from "react";
import { List, ListItem, ListItemAvatar, ListItemText, Avatar, Chip, Collapse, Divider, Box, Typography, Button, Rating, Stack } from "@mui/material";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import { api } from "../api";
import { fmtDateTime, titleCase } from "../format";

export default function ClinicianList({ clinicians, onBook }) {
  const [openId, setOpenId] = useState(null);
  const [reviews, setReviews] = useState({});

  async function toggle(c) {
    if (openId === c.id) return setOpenId(null);
    setOpenId(c.id);
    if (!reviews[c.id]) {
      try { const d = await api(`/clinicians/${c.id}`); setReviews((r) => ({ ...r, [c.id]: d.reviews })); } catch { /* ignore */ }
    }
  }
  if (!clinicians.length) return <Typography color="text.secondary">No clinicians are available yet.</Typography>;

  return (
    <List>
      {clinicians.map((c) => (
        <React.Fragment key={c.id}>
          <ListItem sx={{ alignItems: "flex-start", flexWrap: "wrap", gap: 1 }}>
            <ListItemAvatar><Avatar>{c.name.replace("Dr. ", "").charAt(0)}</Avatar></ListItemAvatar>
            <ListItemText sx={{ cursor: "pointer", minWidth: 220, flex: 1 }} onClick={() => toggle(c)}
              primary={<>{c.name} <Typography component="span" variant="body2" color="text.secondary">({c.professionLabel})</Typography> {c.isDemo && <Chip size="small" label="Demo" sx={{ ml: 1 }} />}</>}
              secondary={
                <>
                  <Stack direction="row" spacing={1} alignItems="center" component="span">
                    {c.rating ? <><Rating value={c.rating} precision={0.1} size="small" readOnly /><span>{c.rating} ({c.reviewCount})</span></> : <span>No reviews yet</span>}
                    {c.priceEur != null && <span>• €{c.priceEur} / {c.sessionMinutes} min</span>}
                  </Stack>
                  <Box component="span" sx={{ display: "block", mt: 0.5 }}>{c.languages.join(", ")}</Box>
                  {c.reasons?.length > 0 && <Box component="span" sx={{ display: "block", color: "success.main" }}>✓ {c.reasons.join(" • ")}</Box>}
                </>
              } />
            <Box sx={{ textAlign: "right" }}>
              {c.nextSlot ? (
                <>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>Next opening: {fmtDateTime(c.nextSlot)}</Typography>
                  <Button variant="contained" size="small" startIcon={<EventAvailableIcon />} sx={{ borderRadius: 4, textTransform: "none", mt: 0.5 }} onClick={() => onBook(c)}>Book</Button>
                </>
              ) : <Chip label="No openings" size="small" />}
            </Box>
          </ListItem>
          <Collapse in={openId === c.id} timeout="auto" unmountOnExit>
            <Box sx={{ pl: 9, pb: 2, pr: 2 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>{c.bio}</Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>Focus: {c.focus.map(titleCase).join(", ")}</Typography>
              <Typography variant="subtitle2">Patient reviews</Typography>
              {(reviews[c.id] || []).length === 0 && <Typography variant="body2" color="text.secondary">No written reviews yet.</Typography>}
              {(reviews[c.id] || []).map((r, i) => <Typography key={i} variant="body2" color="text.secondary">• {r.comment || "(rating only)"} — {r.author}, {r.rating}★</Typography>)}
            </Box>
          </Collapse>
          <Divider />
        </React.Fragment>
      ))}
    </List>
  );
}
