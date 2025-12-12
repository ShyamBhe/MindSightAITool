import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  Rating,
  Box,
  TextField
} from "@mui/material";
import { LocalizationProvider, DatePicker, TimePicker } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";

export default function BookingDialog({ selectedDoctor, setSelectedDoctor }) {
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [showSchedule, setShowSchedule] = useState(false);

  if (!selectedDoctor) return null;

  const handleConfirm = () => {
    if (selectedDoctor.status === "Online" && !showSchedule) {
      alert(`✅ Booked immediately with ${selectedDoctor.name}`);
      setSelectedDoctor(null);
      return;
    }

    if (!selectedDate || !selectedTime) {
      alert("Please select both date and time for booking.");
      return;
    }

    const appointment = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      selectedTime.getHours(),
      selectedTime.getMinutes()
    );

    alert(`✅ Booked appointment on ${appointment.toLocaleString()} with ${selectedDoctor.name}`);
    setSelectedDoctor(null);
  };

  return (
    <Dialog open={!!selectedDoctor} onClose={() => setSelectedDoctor(null)}>
      <DialogTitle>Book Appointment with {selectedDoctor.name}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" gutterBottom>{selectedDoctor.specialty}</Typography>
        <Rating value={selectedDoctor.rating} precision={0.1} readOnly />

        {selectedDoctor.status === "Online" && !showSchedule && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" sx={{ color: "green", mb: 1 }}>
              Doctor is online and available for immediate booking.
            </Typography>
            <Button variant="contained" sx={{ mr: 1 }} onClick={handleConfirm}>
              Book Now
            </Button>
            <Button variant="outlined" onClick={() => setShowSchedule(true)}>
              Schedule Appointment
            </Button>
          </Box>
        )}

        {showSchedule && (
          <Box sx={{ mt: 2, display: "flex", gap: 2, flexDirection: "column" }}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Select Date"
                value={selectedDate}
                onChange={(newDate) => setSelectedDate(newDate)}
                renderInput={(params) => <TextField {...params} fullWidth />}
              />
              <TimePicker
                label="Select Time"
                value={selectedTime}
                onChange={(newTime) => setSelectedTime(newTime)}
                renderInput={(params) => <TextField {...params} fullWidth />}
              />
            </LocalizationProvider>
          </Box>
        )}

        {selectedDoctor.status === "Offline" && (
          <Box sx={{ mt: 2, display: "flex", gap: 2, flexDirection: "column" }}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Select Date"
                value={selectedDate}
                onChange={(newDate) => setSelectedDate(newDate)}
                renderInput={(params) => <TextField {...params} fullWidth />}
              />
              <TimePicker
                label="Select Time"
                value={selectedTime}
                onChange={(newTime) => setSelectedTime(newTime)}
                renderInput={(params) => <TextField {...params} fullWidth />}
              />
            </LocalizationProvider>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={() => setSelectedDoctor(null)}>Cancel</Button>
        {showSchedule && (
          <Button variant="contained" onClick={handleConfirm}>
            Confirm
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
