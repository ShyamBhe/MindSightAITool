import React, { createContext, useContext, useMemo, useState, useEffect, useCallback } from "react";

// Add a language by adding one more object here. Missing keys fall back to English, so you can translate gradually.
const STR = {
  en: {
    appTitle: "MindSight — AI-powered Mental Health Companion",
    appSubtitle: "Early detection • Personalized suggestions • Clinician handoff",
    navHome: "Home", navResults: "Results", navSelfHelp: "Self-help", navMedicines: "Medicines", navData: "Your data",
    navClinician: "Clinician area", navAdmin: "Admin", navChat: "Chat", logIn: "Log in", logOut: "Log out", signUp: "Sign up",
    themeLight: "Light mode", themeDark: "Dark mode", language: "Language",
    welcomeBot: "Hi, I'm your companion. How are you feeling today?",
    chatTitle: "Companion", chatDisclaimer: "AI-assisted chat (Google Gemini). Not a doctor; it can make mistakes. Don't share anything you wouldn't want processed by an AI service.",
    chatFallback: "AI is temporarily unavailable, so I'm using simpler replies.", chatPlaceholder: "Type a message...",
    chatMinimize: "Minimize", chatExpand: "Expand", chatClose: "Close", chatOpen: "Open chat", send: "Send",
    chatServerError: "Sorry, I couldn't reach the server. Please try again in a moment. If you are in danger, call 112 right now.",
    micStart: "Speak your message", micStop: "Stop listening", listening: "Listening…", speakOn: "Read replies aloud: on", speakOff: "Read replies aloud: off",
    micDenied: "Microphone not allowed. Check your browser permissions.",
    loginToSave: "Log in or sign up to save your results and book an appointment.",
    backHome: "Back to Home",
    footer: "MindSight is currently in an initial development phase and is intended for testing and demonstration purposes. The information and features provided by this application are not a substitute for professional medical or mental-health care. For real support, diagnosis, or treatment, please speak with a qualified clinician.",
    welcome: "Welcome",
    welcomeText: "Talk to the companion about how you're feeling. It will gently screen for patterns, suggest next steps and self-help guides, and — if you'd like — match you with a clinician and let you book a time.",
    startChat: "Start chatting", seeResults: "See my results", selfHelpGuides: "Self-help guides",
    notDiagnosis: "MindSight is a screening and support tool, not a diagnosis or emergency service. In an emergency call 112.",
    resultsTitle: "Screening results", noResult: "No screening result yet. Please describe how you are feeling in the chat first.",
    noConcern: "No concern detected", concern: "{s} concern", noPattern: "No specific pattern detected",
    screeningNote: "Automated screening based on your conversation (indicative score {score}/100). It is not a diagnosis. Analysis: {src}.",
    srcRules: "rule-based", srcAi: "AI + rule-based safety check",
    patterns: "Detected patterns", matched: "matched", nextSteps: "Suggested next steps", selfHelpTopic: "Self-help: {t}",
    cliniciansLow: "Professionals you can talk to", cliniciansRec: "Recommended clinicians for you",
    cliniciansRank: "Ranked by fit with your concerns, severity and availability.", noClinicians: "No clinicians are available yet.",
    book: "Book", noOpenings: "No openings", nextOpening: "Next opening", focus: "Focus", reviews: "Patient reviews", noReviews: "No written reviews yet.",
    demo: "Demo",
    emergency: "Immediate support",
    login: "Log in", create: "Create account", cancel: "Cancel", imPatient: "I'm looking for support", imClinician: "I'm a clinician",
    fullName: "Full name", email: "Email", password: "Password", pwRules: "Your password must have:",
    pw12: "At least 12 characters", pwCase: "Upper and lower case letters", pwNum: "A number", pwSym: "A symbol (! ? # % …)", pwPersonal: "No name or email in it",
    pwTip: "Tip: a few random words plus a number and symbol works well, e.g. Blue-Kettle-Mountain-47!",
  },
  fi: {
    appTitle: "MindSight — tekoälyavusteinen mielenterveyskumppani",
    appSubtitle: "Varhainen tunnistus • Yksilölliset ehdotukset • Siirto ammattilaiselle",
    navHome: "Etusivu", navResults: "Tulokset", navSelfHelp: "Omahoito", navMedicines: "Lääkkeet", navData: "Omat tiedot",
    navClinician: "Ammattilaisen alue", navAdmin: "Ylläpito", navChat: "Chat", logIn: "Kirjaudu", logOut: "Kirjaudu ulos", signUp: "Rekisteröidy",
    themeLight: "Vaalea tila", themeDark: "Tumma tila", language: "Kieli",
    welcomeBot: "Hei, olen kumppanisi. Miltä sinusta tuntuu tänään?",
    chatTitle: "Kumppani", chatDisclaimer: "Tekoälyavusteinen chat (Google Gemini). Ei lääkäri, ja se voi tehdä virheitä. Älä jaa mitään, mitä et haluaisi tekoälypalvelun käsittelevän.",
    chatFallback: "Tekoäly ei ole tilapäisesti käytettävissä, joten käytän yksinkertaisempia vastauksia.", chatPlaceholder: "Kirjoita viesti...",
    chatMinimize: "Pienennä", chatExpand: "Laajenna", chatClose: "Sulje", chatOpen: "Avaa chat", send: "Lähetä",
    chatServerError: "Pahoittelut, palvelimeen ei saatu yhteyttä. Yritä hetken päästä uudelleen. Jos olet vaarassa, soita heti 112.",
    micStart: "Sano viestisi", micStop: "Lopeta kuuntelu", listening: "Kuuntelen…", speakOn: "Lue vastaukset ääneen: päällä", speakOff: "Lue vastaukset ääneen: pois",
    micDenied: "Mikrofonin käyttö ei ole sallittu. Tarkista selaimen oikeudet.",
    loginToSave: "Kirjaudu tai rekisteröidy tallentaaksesi tulokset ja varataksesi ajan.",
    backHome: "Takaisin etusivulle",
    footer: "MindSight on alkuvaiheen kehitysversio, joka on tarkoitettu testaukseen ja esittelyyn. Sovelluksen tiedot ja toiminnot eivät korvaa ammattimaista lääketieteellistä tai mielenterveyshoitoa. Todellista tukea, diagnoosia tai hoitoa varten ota yhteyttä pätevään ammattilaiseen.",
    welcome: "Tervetuloa",
    welcomeText: "Keskustele kumppanin kanssa siitä, miltä sinusta tuntuu. Se tunnistaa varovasti oireiden piirteitä, ehdottaa seuraavia askeleita ja omahoito-oppaita sekä halutessasi etsii sinulle sopivan ammattilaisen ja antaa varata ajan.",
    startChat: "Aloita keskustelu", seeResults: "Näytä tulokseni", selfHelpGuides: "Omahoito-oppaat",
    notDiagnosis: "MindSight on seulonta- ja tukityökalu, ei diagnoosi eikä hätäpalvelu. Hätätilanteessa soita 112.",
    resultsTitle: "Seulontatulokset", noResult: "Ei vielä seulontatulosta. Kerro ensin chatissa, miltä sinusta tuntuu.",
    noConcern: "Ei havaittua huolta", concern: "{s} huoli", noPattern: "Erityistä piirrettä ei havaittu",
    screeningNote: "Automaattinen seulonta keskustelun perusteella (suuntaa antava pistemäärä {score}/100). Se ei ole diagnoosi. Analyysi: {src}.",
    srcRules: "sääntöpohjainen", srcAi: "tekoäly + sääntöpohjainen turvatarkistus",
    patterns: "Havaitut piirteet", matched: "osuma", nextSteps: "Ehdotetut seuraavat askeleet", selfHelpTopic: "Omahoito: {t}",
    cliniciansLow: "Ammattilaisia, joille voit puhua", cliniciansRec: "Sinulle suositellut ammattilaiset",
    cliniciansRank: "Järjestetty huolenaiheidesi, vakavuuden ja saatavuuden mukaan.", noClinicians: "Ammattilaisia ei ole vielä saatavilla.",
    book: "Varaa", noOpenings: "Ei vapaita aikoja", nextOpening: "Seuraava vapaa aika", focus: "Erikoisalat", reviews: "Potilasarvostelut", noReviews: "Ei vielä kirjallisia arvosteluja.",
    demo: "Demo",
    emergency: "Välitön apu",
    login: "Kirjaudu", create: "Luo tili", cancel: "Peruuta", imPatient: "Etsin tukea", imClinician: "Olen ammattilainen",
    fullName: "Koko nimi", email: "Sähköposti", password: "Salasana", pwRules: "Salasanassa on oltava:",
    pw12: "Vähintään 12 merkkiä", pwCase: "Isoja ja pieniä kirjaimia", pwNum: "Numero", pwSym: "Erikoismerkki (! ? # % …)", pwPersonal: "Ei nimeäsi tai sähköpostiasi",
    pwTip: "Vinkki: muutama satunnainen sana, numero ja erikoismerkki toimii hyvin, esim. Sininen-Kattila-Vuori-47!",
  },
};
const LOCALE = { en: "en-US", fi: "fi-FI" };
const Ctx = createContext(null);

function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } }

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    const saved = safeGet("ms_lang");
    if (saved && STR[saved]) return saved;
    return (navigator.language || "en").toLowerCase().startsWith("fi") ? "fi" : "en";
  });
  const setLang = useCallback((l) => { setLangState(l); safeSet("ms_lang", l); }, []);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const t = useCallback((key, vars) => {
    let s = STR[lang][key] ?? STR.en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
    return s;
  }, [lang]);
  const value = useMemo(() => ({ lang, setLang, t, locale: LOCALE[lang] }), [lang, setLang, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useI18n = () => useContext(Ctx);
export { safeGet, safeSet };
