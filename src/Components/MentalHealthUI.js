import React, { useEffect, useState } from "react";
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

export default function MentalHealthUI() {
  const [view, setView] = useState("home");

  const [screeningScore, setScreeningScore] = useState(null);
  const [screeningCategory, setScreeningCategory] = useState(null);
  const [screeningSeverity, setScreeningSeverity] = useState(null);
  const [matchedRules, setMatchedRules] = useState([]);

  const [advice, setAdvice] = useState([]);

  const [chatOpen, setChatOpen] = useState(false);

  const [messages, setMessages] = useState([
    {
      from: "bot",
      text: "Hi — I'm your companion. How are you feeling today?",
    },
  ]);

  const [input, setInput] = useState("");

  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [bookingTime, setBookingTime] = useState("");

  const [openReviewDoctor, setOpenReviewDoctor] = useState(null);

  const [scoringRules, setScoringRules] = useState([]);

  /*
  ---------------------------------------------------------
  LOAD SCORING RULES FROM JSON
  ---------------------------------------------------------
  */
  useEffect(() => {
    fetch("/Data/scoringRules.json")
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load scoring rules: ${res.status}`);
        }

        return res.json();
      })
      .then((data) => {
        setScoringRules(data.rules || []);
      })
      .catch((err) => {
        console.error("Failed to load scoring rules", err);
      });
  }, []);

  /*
  ---------------------------------------------------------
  NORMALIZE TEXT
  ---------------------------------------------------------
  */
  function normalizeText(text = "") {
    return text
      .toLowerCase()
      .replace(/[’]/g, "'")
      .replace(/[^\w\s'-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /*
  ---------------------------------------------------------
  LEVENSHTEIN DISTANCE
  ---------------------------------------------------------
  */
  function levenshtein(a, b) {
    const matrix = Array.from(
      { length: a.length + 1 },
      () => Array(b.length + 1).fill(0)
    );

    for (let i = 0; i <= a.length; i++) {
      matrix[i][0] = i;
    }

    for (let j = 0; j <= b.length; j++) {
      matrix[0][j] = j;
    }

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

  /*
  ---------------------------------------------------------
  CONTROLLED FUZZY WORD MATCHING
  ---------------------------------------------------------

  Used mainly for small spelling mistakes.

  Examples:
  anxius   -> anxious
  depresed -> depressed

  Very short words are deliberately excluded because
  fuzzy matching them can produce many false positives.
  ---------------------------------------------------------
  */
  function fuzzyWordMatch(word, keywordWord) {
    const a = normalizeText(word);
    const b = normalizeText(keywordWord);

    if (!a || !b) {
      return false;
    }

    if (a === b) {
      return true;
    }

    if (a.length < 5 || b.length < 5) {
      return false;
    }

    if (Math.abs(a.length - b.length) > 2) {
      return false;
    }

    const distance = levenshtein(a, b);

    const threshold = Math.min(
      2,
      Math.max(1, Math.floor(b.length * 0.2))
    );

    return distance <= threshold;
  }

  /*
  ---------------------------------------------------------
  MATCH ONE KEYWORD / PHRASE
  ---------------------------------------------------------
  */
  function matchesKeyword(text, keyword) {
    const normalizedText = normalizeText(text);
    const normalizedKeyword = normalizeText(keyword);

    if (!normalizedText || !normalizedKeyword) {
      return false;
    }

    /*
    -------------------------------------------------------
    1. EXACT PHRASE MATCH
    -------------------------------------------------------
    */
    if (normalizedText.includes(normalizedKeyword)) {
      return true;
    }

    const textWords = normalizedText.split(" ");
    const keywordWords = normalizedKeyword.split(" ");

    /*
    -------------------------------------------------------
    2. SINGLE WORD FUZZY MATCH
    -------------------------------------------------------
    */
    if (keywordWords.length === 1) {
      return textWords.some((word) =>
        fuzzyWordMatch(word, keywordWords[0])
      );
    }

    /*
    -------------------------------------------------------
    3. MULTI-WORD PHRASE MATCH

    Example:

    keyword:
    "can't stop worrying"

    input:
    "I cant stop worryng about everything"

    We compare sliding windows instead of comparing the
    entire sentence against the phrase.
    -------------------------------------------------------
    */
    for (
      let i = 0;
      i <= textWords.length - keywordWords.length;
      i++
    ) {
      const window = textWords.slice(
        i,
        i + keywordWords.length
      );

      const allWordsMatch = keywordWords.every(
        (keywordWord, index) => {
          return (
            window[index] === keywordWord ||
            fuzzyWordMatch(window[index], keywordWord)
          );
        }
      );

      if (allWordsMatch) {
        return true;
      }
    }

    return false;
  }

  /*
  ---------------------------------------------------------
  ANALYZE USER TEXT
  ---------------------------------------------------------

  Important design:

  The JSON remains the source of truth.

  We DO NOT increase score because multiple keywords matched.

  Example:

  "anxious very worried nervous"

  still receives the score assigned to "anxiety"
  in the JSON rather than adding extra points.
  ---------------------------------------------------------
  */
  function analyzeTextForScore(text) {
    if (!text?.trim()) {
      return {
        score: 0,
        category: null,
        severity: null,
        matchedKeywords: [],
        matches: [],
      };
    }

    if (!scoringRules.length) {
      return {
        score: 0,
        category: null,
        severity: null,
        matchedKeywords: [],
        matches: [],
      };
    }

    const detectedRules = [];

    scoringRules.forEach((rule) => {
      const matchedKeywords = rule.keywords.filter((keyword) =>
        matchesKeyword(text, keyword)
      );

      if (matchedKeywords.length > 0) {
        detectedRules.push({
          category: rule.category,
          severity: rule.severity,
          score: rule.score,
          matchedKeywords,
        });
      }
    });

    /*
    -------------------------------------------------------
    NOTHING MATCHED
    -------------------------------------------------------
    */
    if (detectedRules.length === 0) {
      return {
        score: 0,
        category: "no_detected_rule",
        severity: "none",
        matchedKeywords: [],
        matches: [],
      };
    }

    /*
    -------------------------------------------------------
    HIGHEST JSON SCORE BECOMES PRIMARY RESULT
    -------------------------------------------------------
    */
    detectedRules.sort((a, b) => b.score - a.score);

    const strongestMatch = detectedRules[0];

    return {
      score: strongestMatch.score,
      category: strongestMatch.category,
      severity: strongestMatch.severity,
      matchedKeywords: strongestMatch.matchedKeywords,
      matches: detectedRules,
    };
  }

  /*
  ---------------------------------------------------------
  CREATE ADVICE BASED ON SEVERITY
  ---------------------------------------------------------
  */
  function createAdvice(severity) {
    if (severity === "critical") {
      return [
        "The message contains indicators that may require urgent professional attention.",
        "Consider contacting an appropriate healthcare or emergency support service.",
        "If possible, stay connected with someone you trust.",
      ];
    }

    if (severity === "high") {
      return [
        "The message indicates a high level of distress.",
        "Consider speaking with a qualified healthcare professional.",
        "Try supportive grounding or slow breathing techniques.",
      ];
    }

    if (severity === "moderate_high") {
      return [
        "Consider discussing these feelings with a healthcare professional.",
        "Try relaxation, mindfulness, journaling, or light exercise.",
        "Stay connected with supportive people.",
      ];
    }

    if (severity === "moderate") {
      return [
        "Consider talking with someone you trust.",
        "Try journaling, mindfulness, or relaxation exercises.",
        "Consider professional support if these feelings continue.",
      ];
    }

    if (severity === "low_moderate") {
      return [
        "Pay attention to how these symptoms develop.",
        "Maintain adequate rest and healthy routines.",
        "Consider relaxation or light physical activity.",
      ];
    }

    if (severity === "low") {
      return [
        "Maintain healthy routines and adequate rest.",
        "Stay connected with supportive people.",
        "Continue monitoring how you are feeling.",
      ];
    }

    return [
      "No specific pattern from the current screening rules was detected.",
      "You can provide more information about how you are feeling.",
    ];
  }

  /*
  ---------------------------------------------------------
  SAVE ANALYSIS RESULT TO STATE
  ---------------------------------------------------------
  */
  function updateScreeningResult(analysis) {
    setScreeningScore(analysis.score);
    setScreeningCategory(analysis.category);
    setScreeningSeverity(analysis.severity);
    setMatchedRules(analysis.matches);

    const newAdvice = createAdvice(analysis.severity);

    setAdvice(newAdvice);
  }

  /*
  ---------------------------------------------------------
  QUICK SCREENING
  ---------------------------------------------------------
  */
  function runQuickScreening() {
    const lastUserMessage = [...messages]
      .reverse()
      .find((message) => message.from === "user");

    if (!lastUserMessage) {
      alert(
        "Please describe how you are feeling in the chat before running the screening."
      );

      return;
    }

    const analysis = analyzeTextForScore(
      lastUserMessage.text
    );

    updateScreeningResult(analysis);

    setView("results");
  }

  /*
  ---------------------------------------------------------
  SEND CHAT MESSAGE
  ---------------------------------------------------------
  */
  function sendMessage() {
    if (!input.trim()) {
      return;
    }

    const text = input.trim();

    /*
    Add user message
    */
    setMessages((prev) => [
      ...prev,
      {
        from: "user",
        text,
      },
    ]);

    setInput("");

    /*
    Prototype simulated bot delay
    */
    setTimeout(() => {
      const analysis = analyzeTextForScore(text);

      updateScreeningResult(analysis);

      const categoryText =
        analysis.category &&
        analysis.category !== "no_detected_rule"
          ? analysis.category.replaceAll("_", " ")
          : null;

      let botResponse;

      if (analysis.score > 0) {
        botResponse =
          `Thanks for sharing. ` +
          `The rule-based screening detected ${categoryText} ` +
          `with a score of ${analysis.score}/100. ` +
          `I've updated your screening results.`;
      } else {
        botResponse =
          "Thanks for sharing. I couldn't identify a specific pattern " +
          "from the current screening rules. You can describe how you're " +
          "feeling in more detail if you would like.";
      }

      setMessages((prev) => [
        ...prev,
        {
          from: "bot",
          text: botResponse,
        },
      ]);
    }, 600);
  }

  /*
  ---------------------------------------------------------
  CLINICIAN REVIEWS
  ---------------------------------------------------------
  */
  function toggleReviews(clinician) {
    setOpenReviewDoctor((prev) =>
      prev?.name === clinician.name
        ? null
        : clinician
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        bgcolor: "#f9fafb",
      }}
    >
      {/* ------------------------------------------------
          APP BAR
      ------------------------------------------------ */}
      <AppBar position="static">
        <Toolbar
          sx={{
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <Box>
            <Typography
              variant="h6"
              component="div"
            >
              MindSight — AI-powered Mental Health Companion
            </Typography>

            <Typography
              variant="caption"
              sx={{
                opacity: 0.85,
              }}
            >
              Early detection • Personalized suggestions •
              Clinician handoff
            </Typography>
          </Box>

          <Box
            sx={{
              display: "flex",
              gap: 1,
            }}
          >
            <Button
              color="inherit"
              onClick={() => setView("home")}
            >
              Home
            </Button>

            <Button
              color="inherit"
              onClick={runQuickScreening}
            >
              Results
            </Button>

            <Button
              color="inherit"
              onClick={() => setView("dashboard")}
            >
              Your Data
            </Button>

            <Button
              variant="contained"
              color="secondary"
              onClick={() => setChatOpen(true)}
              startIcon={
                <MessageCircle size={16} />
              }
            >
              Chat
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      {/* ------------------------------------------------
          MAIN CONTENT
      ------------------------------------------------ */}
      <Container
        sx={{
          flex: 1,
          mt: 4,
          mb: 4,
        }}
      >
        <Grid container spacing={3}>
          {/* --------------------------------------------
              HOME
          -------------------------------------------- */}
          {view === "home" && (
            <Grid item xs={12}>
              <QuickStart
                setChatOpen={setChatOpen}
                runQuickScreening={runQuickScreening}
              />
            </Grid>
          )}

          {/* --------------------------------------------
              RESULTS
          -------------------------------------------- */}
          {view === "results" && (
            <Grid item xs={12}>
              <ScreeningResults
                screeningScore={screeningScore}
                screeningCategory={screeningCategory}
                screeningSeverity={screeningSeverity}
                matchedRules={matchedRules}
                advice={advice}
                openReviewDoctor={openReviewDoctor}
                setSelectedDoctor={setSelectedDoctor}
                toggleReviews={toggleReviews}
              />

              <Box sx={{ mt: 3 }}>
                <Button
                  variant="outlined"
                  onClick={() => setView("home")}
                >
                  Back to Home
                </Button>
              </Box>
            </Grid>
          )}

          {/* --------------------------------------------
              DASHBOARD / YOUR DATA
          -------------------------------------------- */}
          {view === "dashboard" && (
            <Grid item xs={12}>
              <Box
                sx={{
                  p: 3,
                  bgcolor: "white",
                  borderRadius: 2,
                  boxShadow: 1,
                }}
              >
                <Typography
                  variant="h5"
                  gutterBottom
                >
                  Your Screening Data
                </Typography>

                {screeningScore !== null ? (
                  <>
                    <Typography sx={{ mb: 1 }}>
                      Rule-based score:{" "}
                      <strong>
                        {screeningScore}/100
                      </strong>
                    </Typography>

                    <Typography sx={{ mb: 1 }}>
                      Category:{" "}
                      <strong>
                        {screeningCategory
                          ? screeningCategory.replaceAll(
                              "_",
                              " "
                            )
                          : "Not available"}
                      </strong>
                    </Typography>

                    <Typography sx={{ mb: 2 }}>
                      Severity:{" "}
                      <strong>
                        {screeningSeverity || "Not available"}
                      </strong>
                    </Typography>

                    {matchedRules.length > 0 && (
                      <Box>
                        <Typography
                          variant="subtitle1"
                          sx={{ mb: 1 }}
                        >
                          Detected rule categories
                        </Typography>

                        {matchedRules.map(
                          (rule, index) => (
                            <Box
                              key={`${rule.category}-${index}`}
                              sx={{
                                mb: 1,
                                p: 1.5,
                                bgcolor: "#f5f5f5",
                                borderRadius: 1,
                              }}
                            >
                              <Typography>
                                <strong>
                                  {rule.category.replaceAll(
                                    "_",
                                    " "
                                  )}
                                </strong>
                              </Typography>

                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                Severity:{" "}
                                {rule.severity}
                              </Typography>

                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                Score: {rule.score}
                              </Typography>

                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                Matched:{" "}
                                {rule.matchedKeywords.join(
                                  ", "
                                )}
                              </Typography>
                            </Box>
                          )
                        )}
                      </Box>
                    )}
                  </>
                ) : (
                  <Typography color="text.secondary">
                    No screening has been completed yet.
                  </Typography>
                )}
              </Box>
            </Grid>
          )}
        </Grid>
      </Container>

      {/* ------------------------------------------------
          CHAT COMPONENT
      ------------------------------------------------ */}
      <ChatHelper
       chatOpen={chatOpen}
       setChatOpen={setChatOpen}
       messages={messages}
       input={input}
       setInput={setInput}
       sendMessage={sendMessage}
      />

      {/* ------------------------------------------------
          BOOKING DIALOG
      ------------------------------------------------ */}
      <BookingDialog
        selectedDoctor={selectedDoctor}
        setSelectedDoctor={setSelectedDoctor}
        bookingTime={bookingTime}
        setBookingTime={setBookingTime}
      />

      {/* ------------------------------------------------
          FOOTER
      ------------------------------------------------ */}
      <Box
        component="footer"
        sx={{
          textAlign: "center",
          p: 2,
          color: "text.secondary",
          mt: "auto",
          bgcolor: "#f1f3f4",
        }}
      >
        Prototype UI — not for clinical use. Under development.
      </Box>
    </Box>
  );
}