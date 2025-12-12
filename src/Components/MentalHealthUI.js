import React, { useState, useEffect } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Container,
  Grid,
  Box,
} from "@mui/material";
import { MessageCircle } from "lucide-react";
import QuickStart from "./QuickStart";
import ScreeningResults from "./ScreeningResults";
import ChatHelper from "./ChatHelper";
import BookingDialog from "./BookingDialog";
import ClinicianList from "./ClinicianList";

export default function MentalHealthUI() {
  const [view, setView] = useState("home");
  const [screeningScore, setScreeningScore] = useState(null);
  const [advice, setAdvice] = useState([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([
    { from: "bot", text: "Hi — I'm your companion. How are you feeling today?" },
  ]);
  const [input, setInput] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [bookingTime, setBookingTime] = useState("");
  const [openReviewDoctor, setOpenReviewDoctor] = useState(null);
  const [scoringRules, setScoringRules] = useState([]);

  useEffect(() => {
    fetch("/data/scoringRules.json")
      .then(res => res.json())
      .then(data => setScoringRules(data.rules || []))
      .catch(err => console.error("Failed to load scoring rules", err));
  }, []);

  function levenshtein(a, b) {
    const matrix = Array(a.length + 1)
      .fill(null)
      .map(() => Array(b.length + 1).fill(null));

    for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    return matrix[a.length][b.length];
  }

  function fuzzyMatch(input, keyword) {
    const text = input.toLowerCase();
    const kw = keyword.toLowerCase();

    if (text.includes(kw)) return true;

    const dist = levenshtein(text, kw);
    const threshold = Math.floor(kw.length * 0.35);
    return dist <= threshold;
  }

  function analyzeTextForScore(text) {
    if (!scoringRules.length) return 20;

    const lower = text.toLowerCase();
    let finalScore = 0;
    let hits = 0;

    scoringRules.forEach(rule => {
      rule.keywords.forEach(keyword => {
        const kwLower = keyword.toLowerCase();

        const exact = lower.includes(kwLower);
        const fuzzy = fuzzyMatch(lower, kwLower);
        const tokenOverlap = lower
          .split(" ")
          .some(word => fuzzyMatch(word, kwLower));

        if (exact || fuzzy || tokenOverlap) {
          finalScore = Math.max(finalScore, rule.score);
          hits += 1;
        }
      });
    });

    if (hits > 2) finalScore += Math.min(hits * 5, 15);
    if (finalScore === 0) finalScore = 20;

    return Math.min(finalScore, 100);
  }

  function runQuickScreening() {
    const lastUserMessage = [...messages].reverse().find(m => m.from === "user");

    if (!lastUserMessage) {
      alert("Please send the symptoms from the chat first before running screening.");
      return;
    }

    const score = analyzeTextForScore(lastUserMessage.text);
    setScreeningScore(score);

    let newAdvice = [];
    if (score >= 90) {
      newAdvice = [
        "Please seek immediate professional support.",
        "Try grounding techniques such as slow breathing.",
        "Reach out to a trusted friend or crisis hotline.",
      ];
    } else if (score >= 70) {
      newAdvice = [
        "Practice deep breathing.",
        "Try journaling.",
        "Consider talking to a clinician.",
      ];
    } else {
      newAdvice = ["Maintain healthy routines.", "Try relaxation techniques."];
    }

    setAdvice(newAdvice);
    setView("results");
  }

  function sendMessage() {
    if (!input.trim()) return;
    const text = input.trim();

    setMessages(prev => [...prev, { from: "user", text }]);
    setInput("");

    setTimeout(() => {
      const score = analyzeTextForScore(text);
      setScreeningScore(score);

      let newAdvice = [];
      if (score >= 90) {
        newAdvice = [
          "Please seek immediate professional support.",
          "Try grounding techniques such as slow breathing.",
          "Reach out to a trusted friend or crisis hotline.",
        ];
      } else if (score >= 70) {
        newAdvice = [
          "Try journaling to express your emotions.",
          "Practice slow breathing to reduce anxiety.",
          "Consider speaking with a clinician.",
        ];
      } else if (score >= 40) {
        newAdvice = ["Take breaks and get enough rest.", "Practice mindfulness or light exercise."];
      } else {
        newAdvice = ["Maintain healthy routines.", "Stay connected with supportive people."];
      }

      setAdvice(newAdvice);

      setMessages(prev => [
        ...prev,
        {
          from: "bot",
          text: `Thanks for sharing. Your emotional intensity score is ${score}. I’ve updated your screening results.`,
        },
      ]);
    }, 600);
  }

  function toggleReviews(clinician) {
    setOpenReviewDoctor(prev =>
      prev?.name === clinician.name ? null : clinician
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh", bgcolor: "#f9fafb" }}>
      <AppBar position="static" color="primary">
        <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
          <Box>
            <Typography variant="h6">MindSight — AI-powered Mental Health Companion</Typography>
            <Typography variant="caption">Early detection • Personalized suggestions • Clinician handoff</Typography>
          </Box>

          <Box sx={{ display: "flex", gap: 1 }}>
            <Button color="inherit" onClick={() => setView("home")}>Home</Button>
            <Button color="inherit" onClick={runQuickScreening}>Results</Button>
            <Button color="inherit" onClick={() => setView("dashboard")}>Your Data</Button>
            <Button variant="contained" color="secondary" onClick={() => setChatOpen(true)} startIcon={<MessageCircle size={16} />}>Chat</Button>
          </Box>
        </Toolbar>
      </AppBar>

      <Container sx={{ flex: 1, mt: 4 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            {view === "home" && <QuickStart runQuickScreening={runQuickScreening} setView={setView} />}
            {view === "results" && (
              <ScreeningResults
                screeningScore={screeningScore}
                advice={advice}
                openReviewDoctor={openReviewDoctor}
                setSelectedDoctor={setSelectedDoctor}
                toggleReviews={toggleReviews}
              />
            )}
          </Grid>

          
        </Grid>
      </Container>

      <ChatHelper
        chatOpen={chatOpen}
        setChatOpen={setChatOpen}
        messages={messages}
        input={input}
        setInput={setInput}
        sendMessage={sendMessage}
      />

      <BookingDialog
        selectedDoctor={selectedDoctor}
        setSelectedDoctor={setSelectedDoctor}
        bookingTime={bookingTime}
        setBookingTime={setBookingTime}
      />

      <Box component="footer" sx={{ textAlign: "center", p: 2, color: "text.secondary", mt: "auto", bgcolor: "#f1f3f4" }}>
        Prototype UI — not for clinical use. Replace mock logic with validated clinical models and legal review before deployment.
      </Box>
    </Box>
  );
}
