import {
  Paper,
  Typography,
  Box,
  Chip,
  Divider,
} from "@mui/material";

import ClinicianList from "./ClinicianList";

export default function ScreeningResults({
  screeningScore,
  screeningCategory,
  screeningSeverity,
  matchedRules = [],
  advice = [],
  openReviewDoctor,
  setSelectedDoctor,
  toggleReviews,
}) {

  /*
  ---------------------------------------------------------
  FORMAT CATEGORY NAME
  ---------------------------------------------------------
  Example:
  severe_anxiety -> Severe Anxiety
  sleep_problem  -> Sleep Problem
  ---------------------------------------------------------
  */
  const formatCategory = (category) => {
    if (!category || category === "no_detected_rule") {
      return "No specific category detected";
    }

    return category
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      );
  };


  /*
  ---------------------------------------------------------
  FORMAT SEVERITY
  ---------------------------------------------------------
  Example:
  moderate_high -> Moderate High
  low_moderate  -> Low Moderate
  ---------------------------------------------------------
  */
  const formatSeverity = (severity) => {
    if (!severity || severity === "none") {
      return "None";
    }

    return severity
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      );
  };


  /*
  ---------------------------------------------------------
  SEVERITY BADGE
  ---------------------------------------------------------
  Uses the severity coming directly from JSON,
  rather than recreating severity from score.
  ---------------------------------------------------------
  */
  const renderSeverityBadge = () => {
    if (!screeningSeverity) {
      return null;
    }

    let color = "default";

    if (screeningSeverity === "critical") {
      color = "error";
    } else if (screeningSeverity === "high") {
      color = "error";
    } else if (screeningSeverity === "moderate_high") {
      color = "warning";
    } else if (screeningSeverity === "moderate") {
      color = "warning";
    } else if (
      screeningSeverity === "low_moderate"
    ) {
      color = "info";
    } else if (screeningSeverity === "low") {
      color = "success";
    }

    return (
      <Chip
        label={formatSeverity(screeningSeverity)}
        color={color}
        size="small"
      />
    );
  };


  return (
    <Paper
      sx={{
        p: 3,
        borderRadius: 2,
      }}
    >

      {/* ------------------------------------------------
          TITLE
      ------------------------------------------------ */}
      <Typography
        variant="h5"
        sx={{
          mb: 3,
          fontWeight: 600,
        }}
      >
        Screening Results
      </Typography>


      {/* ------------------------------------------------
          PRIMARY RESULT
      ------------------------------------------------ */}
      {screeningScore !== null ? (
        <Box>

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 2,
              mb: 2,
            }}
          >

            {/* SCORE */}
            <Box>
              <Typography
                variant="h3"
                sx={{
                  fontWeight: 600,
                }}
              >
                {screeningScore}
              </Typography>

              <Typography
                variant="caption"
                color="text.secondary"
              >
                Rule-based screening score
              </Typography>
            </Box>


            {/* SEVERITY */}
            {renderSeverityBadge()}

          </Box>


          {/* CATEGORY */}
          <Typography
            variant="h6"
            sx={{
              mb: 1,
            }}
          >
            {formatCategory(screeningCategory)}
          </Typography>


          <Typography
            variant="body2"
            color="text.secondary"
          >
            Detected severity:{" "}
            <strong>
              {formatSeverity(
                screeningSeverity
              )}
            </strong>
          </Typography>


          <Divider
            sx={{
              my: 3,
            }}
          />


          {/* ------------------------------------------------
              DETECTED CATEGORIES
          ------------------------------------------------ */}
          {matchedRules.length > 0 && (
            <Box sx={{ mb: 3 }}>

              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 600,
                  mb: 1.5,
                }}
              >
                Detected Patterns
              </Typography>


              {matchedRules.map(
                (rule, index) => (
                  <Box
                    key={`${rule.category}-${index}`}
                    sx={{
                      mb: 1.5,
                      p: 1.5,
                      bgcolor: "#f7f8fa",
                      borderRadius: 1,
                    }}
                  >

                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 1,
                        mb: 0.5,
                      }}
                    >

                      <Typography
                        variant="body1"
                        sx={{
                          fontWeight: 600,
                        }}
                      >
                        {formatCategory(
                          rule.category
                        )}
                      </Typography>


                      <Chip
                        label={
                          formatSeverity(
                            rule.severity
                          )
                        }
                        size="small"
                        variant="outlined"
                      />

                      <Chip
                        label={`Score ${rule.score}`}
                        size="small"
                        variant="outlined"
                      />

                    </Box>


                    {rule.matchedKeywords &&
                      rule.matchedKeywords.length >
                        0 && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                        >
                          Matched indicators:{" "}
                          {rule.matchedKeywords.join(
                            ", "
                          )}
                        </Typography>
                      )}

                  </Box>
                )
              )}

            </Box>
          )}


          {/* ------------------------------------------------
              RECOMMENDATIONS
          ------------------------------------------------ */}
          <Box sx={{ mb: 3 }}>

            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 600,
                mb: 1,
              }}
            >
              Suggested Next Steps
            </Typography>


            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mb: 1.5,
              }}
            >
              Based on the detected patterns,
              here are some suggested next steps:
            </Typography>


            {advice.map(
              (item, index) => (
                <Typography
                  key={index}
                  variant="body2"
                  sx={{
                    mb: 1,
                    pl: 1,
                  }}
                >
                  • {item}
                </Typography>
              )
            )}

          </Box>


          <Divider
            sx={{
              my: 3,
            }}
          />


          {/* ------------------------------------------------
              CLINICIANS
          ------------------------------------------------ */}
          <ClinicianList
            onBook={setSelectedDoctor}
            onReviewToggle={
              toggleReviews
            }
            openReviewDoctor={
              openReviewDoctor
            }
          />

        </Box>
      ) : (
        <Typography
          color="text.secondary"
        >
          No screening result is available yet.
          Please describe how you are feeling in
          the chat first.
        </Typography>
      )}

    </Paper>
  );
}