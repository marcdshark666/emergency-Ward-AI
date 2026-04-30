const STORAGE_VERSION = "emergency-ward-ai-v1";
const ACCOUNT_KEY = `${STORAGE_VERSION}:active-account`;
const DEMO_ACCOUNT = "demo@akut.local";
const todayKey = new Date().toISOString().slice(0, 10);

const riskOrder = { green: 1, yellow: 2, orange: 3, red: 4 };

const riskMeta = {
  green: { label: "Grön", tone: "Stabil", monitor: "Basal observation", zone: "monitoring" },
  yellow: { label: "Gul", tone: "Behöver monitorering", monitor: "Nya vitalparametrar inom 60 min", zone: "monitoring" },
  orange: { label: "Orange", tone: "Potentiellt instabil", monitor: "Tät monitorering och läkarkontroll", zone: "acute" },
  red: { label: "Röd", tone: "Akut/instabil", monitor: "Akut monitorering, överväg IVA/MIVA/HIA", zone: "acute" },
};

const flowStatuses = [
  { id: "acute", label: "Akut monitorering", zone: "acute" },
  { id: "monitoring", label: "Monitoreras", zone: "monitoring" },
  { id: "near", label: "Närakut", zone: "near" },
  { id: "admitted", label: "Inlagd", zone: "monitoring" },
  { id: "consulted", label: "Remitterad/konsulterad", zone: "monitoring" },
  { id: "home", label: "Skickad hem", zone: "home" },
  { id: "closed", label: "Avslutad", zone: "home" },
];

const labLabels = {
  hb: "Hb",
  wbc: "LPK",
  platelets: "TPK",
  crp: "CRP",
  na: "Na",
  k: "K",
  creatinine: "Kreatinin",
  egfr: "eGFR",
  glucose: "Glukos",
  lactate: "Laktat",
  troponin: "Troponin",
  ddimer: "D-dimer",
  liver: "Leverprover",
  bloodGas: "Blodgas",
  urine: "Urinsticka",
  otherLab: "Annat labb",
};

const elements = {
  accountForm: document.querySelector("#accountForm"),
  emailInput: document.querySelector("#emailInput"),
  accountLabel: document.querySelector("#accountLabel"),
  todayLabel: document.querySelector("#todayLabel"),
  activeCount: document.querySelector("#activeCount"),
  overdueCount: document.querySelector("#overdueCount"),
  hospitalMap: document.querySelector("#hospitalMap"),
  avatarLayer: document.querySelector("#avatarLayer"),
  patientGrid: document.querySelector("#patientGrid"),
  patientModal: document.querySelector("#patientModal"),
  patientForm: document.querySelector("#patientForm"),
  openAddPatient: document.querySelector("#openAddPatient"),
  closePatientModal: document.querySelector("#closePatientModal"),
  cancelPatient: document.querySelector("#cancelPatient"),
  detailDrawer: document.querySelector("#detailDrawer"),
  closeDrawer: document.querySelector("#closeDrawer"),
  patientDetail: document.querySelector("#patientDetail"),
  riskFilter: document.querySelector("#riskFilter"),
  sceneLegend: document.querySelector("#sceneLegend"),
  seedButton: document.querySelector("#seedButton"),
};

const state = {
  account: localStorage.getItem(ACCOUNT_KEY) || DEMO_ACCOUNT,
  patients: [],
  selectedPatientId: "",
  riskFilter: "all",
  now: Date.now(),
  recognition: null,
  listeningField: null,
};

function storageKey(account = state.account) {
  return `${STORAGE_VERSION}:patients:${account}:${todayKey}`;
}

function draftKey(account = state.account) {
  return `${STORAGE_VERSION}:patient-form-draft:${account}:${todayKey}`;
}

function generateId(prefix = "p") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function parseNumber(value) {
  const number = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function normalize(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDateTimeLocal(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatClock(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Ingen tid";
  return new Intl.DateTimeFormat("sv-SE", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function minutesUntil(timestamp) {
  return Math.round((timestamp - state.now) / 60000);
}

function getFlowStatus(flowStatus) {
  return flowStatuses.find((item) => item.id === flowStatus) || flowStatuses[1];
}

function getPatientZone(patient) {
  if (patient.flowStatus) return getFlowStatus(patient.flowStatus).zone;
  return riskMeta[patient.analysis?.risk || "green"].zone;
}

function scoreRespiration(rr) {
  if (rr === null) return 0;
  if (rr <= 8) return 3;
  if (rr <= 11) return 1;
  if (rr <= 20) return 0;
  if (rr <= 24) return 2;
  return 3;
}

function scoreSaturation(sat) {
  if (sat === null) return 0;
  if (sat <= 91) return 3;
  if (sat <= 93) return 2;
  if (sat <= 95) return 1;
  return 0;
}

function scoreTemperature(temp) {
  if (temp === null) return 0;
  if (temp <= 35) return 3;
  if (temp <= 36) return 1;
  if (temp <= 38) return 0;
  if (temp <= 39) return 1;
  return 2;
}

function scoreSbp(sbp) {
  if (sbp === null) return 0;
  if (sbp <= 90) return 3;
  if (sbp <= 100) return 2;
  if (sbp <= 110) return 1;
  if (sbp <= 219) return 0;
  return 3;
}

function scorePulse(pulse) {
  if (pulse === null) return 0;
  if (pulse <= 40) return 3;
  if (pulse <= 50) return 1;
  if (pulse <= 90) return 0;
  if (pulse <= 110) return 1;
  if (pulse <= 130) return 2;
  return 3;
}

function scoreConsciousness(consciousness = "Alert") {
  return normalize(consciousness) === "alert" ? 0 : 3;
}

function calculateNews(vitals) {
  const parts = [
    { id: "AF", value: vitals.rr, score: scoreRespiration(vitals.rr) },
    { id: "Sat", value: vitals.sat, score: scoreSaturation(vitals.sat) },
    { id: "Syrgas", value: vitals.oxygen ? "Ja" : "Nej", score: vitals.oxygen ? 2 : 0 },
    { id: "Temp", value: vitals.temp, score: scoreTemperature(vitals.temp) },
    { id: "SBT", value: vitals.sbp, score: scoreSbp(vitals.sbp) },
    { id: "Puls", value: vitals.pulse, score: scorePulse(vitals.pulse) },
    { id: "Medvetande", value: vitals.consciousness, score: scoreConsciousness(vitals.consciousness) },
  ];

  return {
    total: parts.reduce((sum, item) => sum + item.score, 0),
    highestSingle: Math.max(...parts.map((item) => item.score)),
    parts,
  };
}

function collectLabAbnormalities(labs = {}) {
  const values = {
    hb: parseNumber(labs.hb),
    wbc: parseNumber(labs.wbc),
    platelets: parseNumber(labs.platelets),
    crp: parseNumber(labs.crp),
    na: parseNumber(labs.na),
    k: parseNumber(labs.k),
    creatinine: parseNumber(labs.creatinine),
    egfr: parseNumber(labs.egfr),
    glucose: parseNumber(labs.glucose),
    lactate: parseNumber(labs.lactate),
    troponin: parseNumber(labs.troponin),
    ddimer: parseNumber(labs.ddimer),
  };

  const abnormalities = [];
  const add = (key, value, severity, note) => {
    abnormalities.push({ key, label: labLabels[key], value, severity, note });
  };

  if (values.hb !== null && values.hb < 90) add("hb", values.hb, "high", "anemi");
  if (values.wbc !== null && (values.wbc > 15 || values.wbc < 3)) add("wbc", values.wbc, "medium", "infektion/inflammation eller cytopeni");
  if (values.platelets !== null && values.platelets < 100) add("platelets", values.platelets, "medium", "trombocytopeni");
  if (values.crp !== null && values.crp > 80) add("crp", values.crp, values.crp > 180 ? "high" : "medium", "inflammation/infektion");
  if (values.na !== null && (values.na < 130 || values.na > 150)) add("na", values.na, "high", "natriumavvikelse");
  if (values.k !== null && (values.k < 3 || values.k > 5.8)) add("k", values.k, "high", "kaliumavvikelse");
  if (values.creatinine !== null && values.creatinine > 150) add("creatinine", values.creatinine, "medium", "njurpåverkan");
  if (values.egfr !== null && values.egfr < 45) add("egfr", values.egfr, "medium", "sänkt eGFR");
  if (values.glucose !== null && (values.glucose < 3.5 || values.glucose > 18)) add("glucose", values.glucose, "medium", "glukosavvikelse");
  if (values.lactate !== null && values.lactate >= 2.5) add("lactate", values.lactate, values.lactate >= 4 ? "high" : "medium", "laktatstegring");
  if (values.troponin !== null && values.troponin > 40) add("troponin", values.troponin, "high", "myokardskada möjlig");
  if (values.ddimer !== null && values.ddimer > 1) add("ddimer", values.ddimer, "medium", "förhöjd D-dimer");

  if (labs.bloodGas && /ph\s*7\.(0|1|2)|be\s*-\d{2}|pco2/i.test(labs.bloodGas)) {
    add("bloodGas", labs.bloodGas, "high", "avvikande blodgas");
  }

  return abnormalities;
}

function symptomFlags(patient) {
  const text = normalize(
    [
      patient.complaint,
      patient.history,
      patient.statusFindings?.at,
      patient.statusFindings?.heart,
      patient.statusFindings?.lungs,
      patient.statusFindings?.abdomen,
      patient.statusFindings?.neuro,
      patient.statusFindings?.pain,
      patient.statusFindings?.otherStatus,
    ].join(" ")
  );

  return {
    chestPain: /brost|bröst|tryck over brost|chest|infarkt/.test(text),
    dyspnea: /dyspne|andfadd|andn[oö]d|saturation|hypoxi|hosta/.test(text),
    infection: /feber|sepsis|frossa|infektion|pneumoni|uvi|rodnad/.test(text),
    abdomen: /buk|magsmarta|krak|ileus|appendicit|gall|melena/.test(text),
    neuro: /svaghet|stroke|pares|yrsel|forvirr|kramp|huvudvark|neurolog/.test(text),
    trauma: /trauma|fall|fraktur|olycka|sår|sar/.test(text),
  };
}

function buildDifferentials(patient, abnormalities, news) {
  const flags = symptomFlags(patient);
  const labs = patient.labs || {};
  const differentials = [];
  const add = (name, probability, reason) => {
    if (!differentials.some((item) => item.name === name)) {
      differentials.push({ name, probability, reason });
    }
  };

  if (flags.chestPain || parseNumber(labs.troponin) > 40) {
    add("Akut koronart syndrom", parseNumber(labs.troponin) > 40 ? 48 : 34, "bröstsmärta/troponin kräver EKG-serier och klinisk korrelation");
    add("Lungemboli", parseNumber(labs.ddimer) > 1 ? 28 : 18, "dyspné/bröstsmärta och D-dimer kan tala för emboli");
  }

  if (flags.infection || parseNumber(labs.crp) > 80 || parseNumber(labs.lactate) >= 2.5) {
    add("Infektion/sepsis", parseNumber(labs.lactate) >= 4 || news.total >= 7 ? 55 : 42, "CRP/LPK, feber eller laktatstegring ger infektionsmisstanke");
    add("Pneumoni", flags.dyspnea ? 32 : 22, "andningssymtom och inflammation kan passa pneumoni");
  }

  if (flags.abdomen) {
    add("Akut buk/kirurgisk genes", 38, "bukstatus och smärta behöver kirurgisk värdering vid varningsflaggor");
    add("Gastroenterit/dehydrering", 24, "anamnes och vätskestatus kan passa men allvarliga orsaker måste uteslutas");
  }

  if (flags.neuro || normalize(patient.vitals?.consciousness) !== "alert") {
    add("Stroke/TIA eller neurologisk akutgenes", 42, "neurologiska symtom eller påverkat medvetande kräver snabb strukturerad bedömning");
    add("Metabol/toxisk påverkan", parseNumber(labs.glucose) > 18 || parseNumber(labs.na) < 130 ? 32 : 22, "glukos/natrium och medvetandegrad behöver följas");
  }

  if (flags.dyspnea && !flags.chestPain) {
    add("Astma/KOL-exacerbation eller respiratorisk svikt", 36, "AF, saturation och syrgasbehov styr monitorering");
  }

  if (flags.trauma) {
    add("Traumaskada/fraktur", 36, "smärta, status och funktionspåverkan behöver riktad undersökning");
  }

  if (!differentials.length && abnormalities.length) {
    add("Metabol eller inflammatorisk avvikelse", 34, "labbavvikelser behöver korreleras mot status och anamnes");
    add("Dehydrering/njurpåverkan", 24, "kreatinin/eGFR och vätskestatus kan behöva följas");
  }

  if (!differentials.length) {
    add("Ospecifik akutmedicinsk sökorsak", 35, "stabil patient men fortsatt klinisk omvärdering behövs");
    add("Smärttillstånd utan tydlig alarmsignal", 25, "status och vitalparametrar talar inte ensamma för hög risk");
  }

  add("Annan viktig differentialdiagnos", Math.max(12, 100 - differentials.slice(0, 2).reduce((sum, item) => sum + item.probability, 0)), "komplettera anamnes, status och provsvar");

  return differentials
    .slice(0, 3)
    .map((item, index, list) => {
      const total = list.reduce((sum, candidate) => sum + candidate.probability, 0);
      return {
        ...item,
        probability: Math.max(8, Math.round((item.probability / total) * 100)),
      };
    });
}

function determineRisk(patient, news, abnormalities) {
  const highLabs = abnormalities.some((item) => item.severity === "high");
  const mediumLabs = abnormalities.some((item) => item.severity === "medium");
  const flags = symptomFlags(patient);
  let risk = "green";

  if (news.total >= 7 || news.highestSingle === 3 || highLabs) {
    risk = "red";
  } else if (news.total >= 5 || flags.chestPain || flags.neuro || mediumLabs) {
    risk = "orange";
  } else if (news.total >= 3 || flags.infection || flags.dyspnea) {
    risk = "yellow";
  }

  if (patient.manualRisk && riskOrder[patient.manualRisk] >= riskOrder[risk]) {
    risk = patient.manualRisk;
  }

  return risk;
}

function recommendedDisposition(patient, risk, differentials) {
  const flags = symptomFlags(patient);
  const dxText = normalize(differentials.map((item) => item.name).join(" "));

  if (risk === "red") return "Akut monitorering och överväg IVA/MIVA/HIA beroende på organsystem.";
  if (dxText.includes("koronar")) return "Kardiolog/HIA-spår vid EKG/troponin-dynamik.";
  if (dxText.includes("sepsis")) return "Medicin/infektion, sepsisåtgärder och ställningstagande till inläggning.";
  if (flags.abdomen) return "Kirurgkonsult vid peritonit, ileusmisstanke eller tilltagande smärta.";
  if (flags.neuro) return "Neurolog/strokelarm vid akut fokalneurologi eller medvetandepåverkan.";
  if (risk === "orange") return "Akut monitorering eller inläggning efter ny läkarbedömning.";
  if (risk === "yellow") return "Monitorering/närakut beroende på svar på behandling och omkontroll.";
  return "Hem eller närakut kan övervägas efter fullständig bedömning och säker uppföljning.";
}

function nextAction(patient, risk, abnormalities) {
  const flags = symptomFlags(patient);
  if (risk === "red") return "Larma ansvarig läkare, koppla monitor, säkra ABCDE och ta nya vitalparametrar nu.";
  if (abnormalities.some((item) => item.key === "lactate")) return "Upprepa laktat, bedöm vätska och infektionstecken.";
  if (flags.chestPain) return "Beställ/upprepa EKG, följ troponin och smärtskala.";
  if (flags.dyspnea) return "Sätt saturation/AF-trend, överväg blodgas och lungröntgen.";
  if (flags.abdomen) return "Bukstatus igen, smärtlindra och överväg kirurg/CT.";
  if (risk === "yellow") return "Nya vitalparametrar och NEWS inom 60 minuter.";
  return "Slutför anamnes/status, följ checklistan och planera disposition.";
}

function recommendationTemplates(patient, analysis) {
  const flags = symptomFlags(patient);
  const now = Date.now();
  const urgent = analysis.risk === "red";
  const high = analysis.risk === "orange";
  const minutes = urgent ? 15 : high ? 30 : analysis.risk === "yellow" ? 60 : 120;
  const base = [
    { text: "Ta nya vitalparametrar och räkna om NEWS2", dueMinutes: minutes },
    { text: "Gör ny läkarbedömning", dueMinutes: urgent ? 15 : high ? 45 : 120 },
    { text: "Sätt PVK och verifiera läkemedelslista", dueMinutes: urgent || high ? 20 : 90 },
    { text: "Beställ baslabb enligt akutmall", dueMinutes: high || urgent ? 20 : 90 },
  ];

  if (flags.chestPain) base.push({ text: "Beställ EKG och planera troponinserie", dueMinutes: 10 });
  if (flags.dyspnea) base.push({ text: "Bedöm syrgasbehov, blodgas och lungröntgen", dueMinutes: urgent ? 10 : 30 });
  if (flags.infection) base.push({ text: "Överväg blododling, antibiotika och vätskebedömning", dueMinutes: urgent ? 15 : 45 });
  if (flags.abdomen) base.push({ text: "Kontakta kirurg vid varningsflaggor eller peritonit", dueMinutes: high || urgent ? 30 : 90 });
  if (flags.neuro) base.push({ text: "Gör strukturerat neurologstatus och överväg stroke-/neurologkontakt", dueMinutes: 15 });
  if (analysis.risk === "green") base.push({ text: "Planera hemgång/närakut med säkerhetsnät", dueMinutes: 180 });

  return base.slice(0, 7).map((item) => ({
    id: generateId("rec"),
    text: item.text,
    status: "Ej påbörjad",
    completed: false,
    dueAt: now + item.dueMinutes * 60000,
  }));
}

function analyzePatient(patient) {
  const news = calculateNews(patient.vitals || {});
  const abnormalities = collectLabAbnormalities(patient.labs || {});
  const risk = determineRisk(patient, news, abnormalities);
  const differentials = buildDifferentials(patient, abnormalities, news);

  return {
    news,
    abnormalities,
    risk,
    differentials,
    nextAction: nextAction(patient, risk, abnormalities),
    monitorLevel: riskMeta[risk].monitor,
    disposition: recommendedDisposition(patient, risk, differentials),
  };
}

function createDemoPatients() {
  const now = Date.now();
  const patients = [
    {
      id: "demo_akut_1",
      name: "Patient A-104",
      sex: "Man",
      age: 68,
      complaint: "Bröstsmärta och illamående",
      history: "Tryck över bröstet sedan 45 minuter. Hypertoni. Kallsvettig vid ankomst.",
      vitals: { rr: 24, sat: 94, oxygen: false, temp: 37.2, sbp: 102, pulse: 118, consciousness: "Alert" },
      statusFindings: {
        at: "Smärtpåverkad, blek",
        heart: "Takykard, regelbunden rytm",
        lungs: "Vesikulära andningsljud",
        abdomen: "Mjuk",
        neuro: "Ingen fokalneurologi",
        skin: "Kallsvettig",
        pain: "VAS 7",
        otherStatus: "",
      },
      labs: { hb: 138, wbc: 10.2, platelets: 240, crp: 8, na: 138, k: 4.3, creatinine: 94, egfr: 72, glucose: 8.8, lactate: 1.8, troponin: 72, ddimer: 0.4, liver: "", bloodGas: "", urine: "", otherLab: "" },
      manualRisk: "",
      flowStatus: "acute",
      createdAt: now - 32 * 60000,
    },
    {
      id: "demo_sepsis_2",
      name: "Patient B-219",
      sex: "Kvinna",
      age: 81,
      complaint: "Feber, förvirring och misstänkt UVI",
      history: "Tilltagande trötthet, frossa och nytillkommen konfusion. Bor på SÄBO.",
      vitals: { rr: 26, sat: 92, oxygen: true, temp: 39.3, sbp: 91, pulse: 124, consciousness: "Ny konfusion" },
      statusFindings: {
        at: "Allmänpåverkad",
        heart: "Takykard",
        lungs: "Basala rassel bilateralt",
        abdomen: "Diffust öm suprapubiskt",
        neuro: "Konfusorisk men rör alla extremiteter",
        skin: "Varm, torr",
        pain: "Svårbedömt",
        otherStatus: "Kapillär återfyllnad 4 sek",
      },
      labs: { hb: 119, wbc: 18.4, platelets: 156, crp: 226, na: 132, k: 4.9, creatinine: 168, egfr: 31, glucose: 12.4, lactate: 4.6, troponin: 31, ddimer: 1.2, liver: "ALAT lätt förhöjt", bloodGas: "pH 7.29, BE -8", urine: "Nitrit+, LPK++", otherLab: "" },
      manualRisk: "",
      flowStatus: "acute",
      createdAt: now - 68 * 60000,
    },
    {
      id: "demo_buk_3",
      name: "Patient C-033",
      sex: "Kvinna",
      age: 42,
      complaint: "Buksmärta höger fossa och kräkningar",
      history: "Smärta sedan igår kväll, tilltagande. Ingen graviditet enligt anamnes.",
      vitals: { rr: 18, sat: 98, oxygen: false, temp: 38.1, sbp: 126, pulse: 98, consciousness: "Alert" },
      statusFindings: {
        at: "Måttligt smärtpåverkad",
        heart: "Regelbunden",
        lungs: "Utan anmärkning",
        abdomen: "Öm höger fossa, släppömhet",
        neuro: "Utan anmärkning",
        skin: "Normal",
        pain: "VAS 6",
        otherStatus: "",
      },
      labs: { hb: 131, wbc: 14.8, platelets: 311, crp: 62, na: 137, k: 3.7, creatinine: 70, egfr: 90, glucose: 6.2, lactate: 1.4, troponin: 3, ddimer: 0.5, liver: "", bloodGas: "", urine: "Ketoner+", otherLab: "U-hCG negativ" },
      manualRisk: "",
      flowStatus: "consulted",
      createdAt: now - 108 * 60000,
    },
    {
      id: "demo_dyspne_4",
      name: "Patient D-510",
      sex: "Man",
      age: 57,
      complaint: "Andfåddhet och hosta",
      history: "KOL, försämrad hosta tre dygn. Ingen bröstsmärta.",
      vitals: { rr: 22, sat: 90, oxygen: true, temp: 37.8, sbp: 144, pulse: 104, consciousness: "Alert" },
      statusFindings: {
        at: "Trött men kontaktbar",
        heart: "Takykard",
        lungs: "Ronki, förlängt expirium",
        abdomen: "Mjuk",
        neuro: "Utan anmärkning",
        skin: "Normal perifer cirkulation",
        pain: "Ingen",
        otherStatus: "",
      },
      labs: { hb: 151, wbc: 12.1, platelets: 288, crp: 48, na: 139, k: 4.1, creatinine: 82, egfr: 83, glucose: 7.1, lactate: 2.1, troponin: 9, ddimer: 0.8, liver: "", bloodGas: "pH 7.35, pCO2 6.4", urine: "", otherLab: "" },
      manualRisk: "",
      flowStatus: "monitoring",
      createdAt: now - 44 * 60000,
    },
    {
      id: "demo_home_5",
      name: "Patient E-902",
      sex: "Annat/okänt",
      age: 29,
      complaint: "Fotledsdistorsion efter idrott",
      history: "Vrickat fotled, kan belasta med smärta. Inga alarmsymtom.",
      vitals: { rr: 14, sat: 99, oxygen: false, temp: 36.8, sbp: 121, pulse: 76, consciousness: "Alert" },
      statusFindings: {
        at: "Gott allmäntillstånd",
        heart: "Utan anmärkning",
        lungs: "Utan anmärkning",
        abdomen: "Utan anmärkning",
        neuro: "Distalstatus intakt",
        skin: "Lätt svullnad lateralt",
        pain: "VAS 4",
        otherStatus: "Ottawa ankle rules uppfylls ej",
      },
      labs: { hb: "", wbc: "", platelets: "", crp: "", na: "", k: "", creatinine: "", egfr: "", glucose: "", lactate: "", troponin: "", ddimer: "", liver: "", bloodGas: "", urine: "", otherLab: "Inga labb indicerade" },
      manualRisk: "",
      flowStatus: "near",
      createdAt: now - 12 * 60000,
    },
  ];

  return patients.map((patient) => {
    const analysis = analyzePatient(patient);
    return {
      ...patient,
      analysis,
      recommendations: recommendationTemplates(patient, analysis),
    };
  });
}

function persist() {
  localStorage.setItem(ACCOUNT_KEY, state.account);
  localStorage.setItem(storageKey(), JSON.stringify(state.patients));
}

function loadPatients() {
  const raw = localStorage.getItem(storageKey());
  if (!raw) {
    state.patients = createDemoPatients();
    persist();
    return;
  }

  try {
    state.patients = JSON.parse(raw).map((patient) => {
      const analysis = analyzePatient(patient);
      return {
        ...patient,
        analysis,
        recommendations: patient.recommendations?.length
          ? patient.recommendations
          : recommendationTemplates(patient, analysis),
      };
    });
  } catch {
    state.patients = createDemoPatients();
    persist();
  }
}

function resetDemoData() {
  state.patients = createDemoPatients();
  state.selectedPatientId = "";
  persist();
  render();
}

function getTimerState(recommendation) {
  if (recommendation.completed || recommendation.status === "Klar") return "done";
  if (recommendation.dueAt <= state.now) return "overdue";
  if (minutesUntil(recommendation.dueAt) <= 15) return "soon";
  return "active";
}

function patientHasOverdue(patient) {
  return (patient.recommendations || []).some((item) => getTimerState(item) === "overdue");
}

function updatePatient(patientId, updater) {
  state.patients = state.patients.map((patient) => {
    if (patient.id !== patientId) return patient;
    const next = updater({ ...patient });
    return { ...next, analysis: analyzePatient(next) };
  });
  persist();
  render();
}

function serializeForm(form) {
  const data = new FormData(form);
  return Object.fromEntries(data.entries());
}

function fillFormFromDraft() {
  const raw = localStorage.getItem(draftKey());
  if (!raw) return;
  try {
    const draft = JSON.parse(raw);
    Object.entries(draft).forEach(([name, value]) => {
      const field = elements.patientForm.elements[name];
      if (field) field.value = value;
    });
  } catch {
    localStorage.removeItem(draftKey());
  }
}

function saveFormDraft() {
  const values = serializeForm(elements.patientForm);
  localStorage.setItem(draftKey(), JSON.stringify(values));
}

function clearFormDraft() {
  localStorage.removeItem(draftKey());
}

function patientFromForm(form) {
  const data = serializeForm(form);
  return {
    id: generateId("patient"),
    name: data.name?.trim() || "Ny patient",
    sex: data.sex,
    age: parseNumber(data.age) || 0,
    complaint: data.complaint?.trim() || "Ej angivet",
    history: data.history?.trim() || "",
    vitals: {
      rr: parseNumber(data.rr),
      sat: parseNumber(data.sat),
      oxygen: data.oxygen === "true",
      temp: parseNumber(data.temp),
      sbp: parseNumber(data.sbp),
      pulse: parseNumber(data.pulse),
      consciousness: data.consciousness || "Alert",
    },
    statusFindings: {
      at: data.at || "",
      heart: data.heart || "",
      lungs: data.lungs || "",
      abdomen: data.abdomen || "",
      neuro: data.neuro || "",
      skin: data.skin || "",
      pain: data.pain || "",
      otherStatus: data.otherStatus || "",
    },
    labs: {
      hb: data.hb || "",
      wbc: data.wbc || "",
      platelets: data.platelets || "",
      crp: data.crp || "",
      na: data.na || "",
      k: data.k || "",
      creatinine: data.creatinine || "",
      egfr: data.egfr || "",
      glucose: data.glucose || "",
      lactate: data.lactate || "",
      troponin: data.troponin || "",
      ddimer: data.ddimer || "",
      liver: data.liver || "",
      bloodGas: data.bloodGas || "",
      urine: data.urine || "",
      otherLab: data.otherLab || "",
    },
    manualRisk: data.manualRisk,
    flowStatus: "monitoring",
    createdAt: Date.now(),
  };
}

function addPatientFromForm(form) {
  const patient = patientFromForm(form);
  const analysis = analyzePatient(patient);
  const flowStatus = analysis.risk === "red" || analysis.risk === "orange" ? "acute" : analysis.risk === "green" ? "near" : "monitoring";
  const nextPatient = {
    ...patient,
    flowStatus,
    analysis,
    recommendations: recommendationTemplates(patient, analysis),
  };

  state.patients = [nextPatient, ...state.patients];
  state.selectedPatientId = nextPatient.id;
  clearFormDraft();
  form.reset();
  persist();
  render();
  openPatientDetail(nextPatient.id);
}

function renderLegend() {
  elements.sceneLegend.innerHTML = [
    ["red", "Röd akut"],
    ["orange", "Orange hög risk"],
    ["yellow", "Gul observation"],
    ["green", "Grön stabil"],
    ["blue", "Blå närakut"],
    ["gray", "Hem/avslutad"],
  ]
    .map(([color, label]) => `<span class="legend-item ${color}"><i></i>${label}</span>`)
    .join("");
}

function renderStats() {
  const active = state.patients.filter((patient) => !["home", "closed"].includes(patient.flowStatus)).length;
  const overdue = state.patients.filter(patientHasOverdue).length;
  elements.todayLabel.textContent = new Intl.DateTimeFormat("sv-SE", { dateStyle: "full" }).format(new Date());
  elements.accountLabel.textContent = state.account === DEMO_ACCOUNT ? "Demo-läge" : state.account;
  elements.emailInput.value = state.account === DEMO_ACCOUNT ? "" : state.account;
  elements.activeCount.textContent = active;
  elements.overdueCount.textContent = overdue;
}

function avatarPosition(patient, zoneIndex, zoneCount) {
  const zone = getPatientZone(patient);
  const index = zoneIndex + 1;
  const jitter = (patient.id.charCodeAt(patient.id.length - 1) % 7) - 3;

  if (zone === "acute") return { x: 18 + (index % 3) * 8 + jitter, y: 32 + Math.floor(index / 3) * 17 };
  if (zone === "monitoring") return { x: 46 + (index % 4) * 7 + jitter, y: 28 + Math.floor(index / 4) * 16 };
  if (zone === "near") return { x: 75 + (index % 3) * 7 + jitter, y: 34 + Math.floor(index / 3) * 17 };
  return { x: 83 + (index % 3) * 5 + jitter, y: 78 + Math.floor(index / 3) * 8 };
}

function renderAvatars() {
  const zoneIndexes = { acute: 0, monitoring: 0, near: 0, home: 0 };
  elements.avatarLayer.innerHTML = state.patients
    .map((patient) => {
      const zone = getPatientZone(patient);
      const position = avatarPosition(patient, zoneIndexes[zone] || 0, state.patients.length);
      zoneIndexes[zone] = (zoneIndexes[zone] || 0) + 1;
      const risk = patient.analysis.risk;
      const overdue = patientHasOverdue(patient);
      const selected = state.selectedPatientId === patient.id ? " selected" : "";
      return `
        <button
          class="patient-avatar risk-${risk}${overdue ? " overdue" : ""}${selected}"
          data-patient-id="${patient.id}"
          style="left:${position.x}%; top:${position.y}%;"
          title="${escapeHtml(patient.name)} - NEWS ${patient.analysis.news.total}"
          type="button"
        >
          <span class="avatar-head"></span>
          <span class="avatar-body"></span>
          <span class="avatar-shadow"></span>
          <small>${escapeHtml(patient.name.replace(/^Patient\s*/i, ""))}</small>
        </button>
      `;
    })
    .join("");

  elements.avatarLayer.querySelectorAll("[data-patient-id]").forEach((button) => {
    button.addEventListener("click", () => {
      openPatientDetail(button.dataset.patientId);
      focusPatient(button.dataset.patientId);
    });
  });
}

function focusPatient(patientId) {
  state.selectedPatientId = patientId;
  const avatar = elements.avatarLayer.querySelector(`[data-patient-id="${CSS.escape(patientId)}"]`);
  if (!avatar) return;
  const x = avatar.style.left || "50%";
  const y = avatar.style.top || "50%";
  elements.hospitalMap.style.setProperty("--focus-x", x);
  elements.hospitalMap.style.setProperty("--focus-y", y);
  elements.hospitalMap.classList.add("is-focused");
  window.setTimeout(() => elements.hospitalMap.classList.remove("is-focused"), 1100);
}

function labBadges(patient, limit = 3) {
  const abnormalities = patient.analysis.abnormalities || [];
  if (!abnormalities.length) return `<span class="quiet">Inga tydliga labbavvikelser</span>`;
  return abnormalities
    .slice(0, limit)
    .map((item) => `<span class="lab-badge severity-${item.severity}">${escapeHtml(item.label)} ${escapeHtml(item.value)}</span>`)
    .join("");
}

function timerBadges(patient, limit = 3) {
  const active = (patient.recommendations || []).filter((item) => !item.completed && item.status !== "Klar");
  if (!active.length) return `<span class="quiet">Inga aktiva timers</span>`;
  return active
    .sort((a, b) => a.dueAt - b.dueAt)
    .slice(0, limit)
    .map((item) => {
      const timerState = getTimerState(item);
      const minutes = minutesUntil(item.dueAt);
      const label = timerState === "overdue" ? `${Math.abs(minutes)} min sen` : `${minutes} min`;
      return `<span class="timer-badge ${timerState}">${escapeHtml(label)}</span>`;
    })
    .join("");
}

function activeRecommendations(patient, limit = 2) {
  const active = (patient.recommendations || []).filter((item) => !item.completed && item.status !== "Klar").slice(0, limit);
  if (!active.length) return `<span class="quiet">Checklistan klar</span>`;
  return active.map((item) => `<li>${escapeHtml(item.text)}</li>`).join("");
}

function renderPatients() {
  const visible = state.patients.filter((patient) => state.riskFilter === "all" || patient.analysis.risk === state.riskFilter);
  elements.patientGrid.innerHTML = visible
    .map((patient) => {
      const risk = patient.analysis.risk;
      const flow = getFlowStatus(patient.flowStatus);
      return `
        <article class="patient-card risk-${risk}${patientHasOverdue(patient) ? " has-overdue" : ""}${state.selectedPatientId === patient.id ? " selected" : ""}" data-patient-id="${patient.id}">
          <div class="card-topline">
            <span class="risk-pill">${riskMeta[risk].label}</span>
            <span class="flow-chip">${escapeHtml(flow.label)}</span>
          </div>
          <div class="patient-card-main">
            <div>
              <h3>${escapeHtml(patient.name)}</h3>
              <p>${escapeHtml(patient.age)} år · ${escapeHtml(patient.sex)} · ${escapeHtml(patient.complaint)}</p>
            </div>
            <div class="news-score">
              <span>NEWS2</span>
              <strong>${patient.analysis.news.total}</strong>
            </div>
          </div>
          <div class="card-strip">
            <div>
              <span class="label">Risk</span>
              <strong>${riskMeta[risk].tone}</strong>
            </div>
            <div>
              <span class="label">Timers</span>
              <div class="inline-badges">${timerBadges(patient)}</div>
            </div>
          </div>
          <div class="card-labs">${labBadges(patient)}</div>
          <ul class="mini-actions">${activeRecommendations(patient)}</ul>
        </article>
      `;
    })
    .join("");

  if (!visible.length) {
    elements.patientGrid.innerHTML = `<div class="empty-state">Inga patienter matchar filtret.</div>`;
  }

  elements.patientGrid.querySelectorAll("[data-patient-id]").forEach((card) => {
    card.addEventListener("click", () => {
      openPatientDetail(card.dataset.patientId);
      focusPatient(card.dataset.patientId);
    });
  });
}

function renderNewsBreakdown(patient) {
  return patient.analysis.news.parts
    .map((part) => `
      <div class="news-part">
        <span>${escapeHtml(part.id)}</span>
        <strong>${escapeHtml(part.value ?? "-")}</strong>
        <i>${part.score} p</i>
      </div>
    `)
    .join("");
}

function renderDifferentials(patient) {
  return patient.analysis.differentials
    .map((item) => `
      <li>
        <strong>${escapeHtml(item.name)}</strong>
        <span>${item.probability}%</span>
        <p>${escapeHtml(item.reason)}</p>
      </li>
    `)
    .join("");
}

function renderRecommendationRows(patient) {
  return (patient.recommendations || [])
    .map((item) => {
      const timerState = getTimerState(item);
      return `
        <div class="recommendation-row ${timerState}" data-rec-id="${item.id}">
          <label class="checkline">
            <input type="checkbox" ${item.completed ? "checked" : ""} data-action="toggle-rec" />
            <span>${escapeHtml(item.text)}</span>
          </label>
          <select data-action="rec-status">
            ${["Ej påbörjad", "Pågår", "Klar", "Försenad"].map((status) => `<option ${item.status === status ? "selected" : ""}>${status}</option>`).join("")}
          </select>
          <label class="timer-edit">
            Timer
            <input type="datetime-local" value="${formatDateTimeLocal(item.dueAt)}" data-action="rec-due" />
          </label>
          <span class="due-label">${timerState === "overdue" ? "Försenad" : formatClock(item.dueAt)}</span>
        </div>
      `;
    })
    .join("");
}

function renderPatientDetail(patient) {
  const risk = patient.analysis.risk;
  elements.patientDetail.innerHTML = `
    <div class="detail-head risk-${risk}">
      <div>
        <span class="risk-pill">${riskMeta[risk].label}</span>
        <h2>${escapeHtml(patient.name)}</h2>
        <p>${escapeHtml(patient.age)} år · ${escapeHtml(patient.sex)} · ${escapeHtml(patient.complaint)}</p>
      </div>
      <div class="detail-news">
        <span>NEWS2</span>
        <strong>${patient.analysis.news.total}</strong>
      </div>
    </div>

    <section class="detail-section">
      <div class="section-title">
        <h3>Status i flödet</h3>
        <span>Sparas automatiskt</span>
      </div>
      <select class="wide-select" id="flowStatusSelect">
        ${flowStatuses.map((item) => `<option value="${item.id}" ${patient.flowStatus === item.id ? "selected" : ""}>${item.label}</option>`).join("")}
      </select>
    </section>

    <section class="detail-section">
      <div class="section-title">
        <h3>Preliminär analys</h3>
        <span>Beslutsstöd, ej diagnos</span>
      </div>
      <div class="analysis-callout">
        <strong>${escapeHtml(patient.analysis.nextAction)}</strong>
        <p>${escapeHtml(patient.analysis.disposition)}</p>
      </div>
      <ul class="differential-list">${renderDifferentials(patient)}</ul>
      <p class="monitor-level">${escapeHtml(patient.analysis.monitorLevel)}</p>
    </section>

    <section class="detail-section">
      <div class="section-title">
        <h3>NEWS2-parametrar</h3>
        <span>${patient.analysis.news.highestSingle >= 3 ? "Enskild 3-poängare finns" : "Ingen enskild 3-poängare"}</span>
      </div>
      <div class="news-grid">${renderNewsBreakdown(patient)}</div>
    </section>

    <section class="detail-section">
      <div class="section-title">
        <h3>Viktigaste labbavvikelser</h3>
        <span>${patient.analysis.abnormalities.length} flaggor</span>
      </div>
      <div class="detail-badges">${labBadges(patient, 8)}</div>
    </section>

    <section class="detail-section">
      <div class="section-title">
        <h3>Rekommendationer och timers</h3>
        <span>Kryssa, ändra status eller justera tid</span>
      </div>
      <div class="recommendation-list">${renderRecommendationRows(patient)}</div>
    </section>

    <section class="detail-section">
      <div class="section-title">
        <h3>Anamnes och status</h3>
        <span>Sammanfattning</span>
      </div>
      <p class="plain-text">${escapeHtml(patient.history || "Ingen anamnes angiven.")}</p>
      <div class="status-grid">
        ${Object.entries(patient.statusFindings || {})
          .filter(([, value]) => value)
          .map(([key, value]) => `<div><span>${escapeHtml(key)}</span><strong>${escapeHtml(value)}</strong></div>`)
          .join("")}
      </div>
    </section>
  `;

  elements.patientDetail.querySelector("#flowStatusSelect").addEventListener("change", (event) => {
    updatePatient(patient.id, (next) => ({ ...next, flowStatus: event.target.value }));
  });

  elements.patientDetail.querySelectorAll(".recommendation-row").forEach((row) => {
    const recId = row.dataset.recId;
    row.querySelector('[data-action="toggle-rec"]').addEventListener("change", (event) => {
      updateRecommendation(patient.id, recId, { completed: event.target.checked, status: event.target.checked ? "Klar" : "Pågår" });
    });
    row.querySelector('[data-action="rec-status"]').addEventListener("change", (event) => {
      updateRecommendation(patient.id, recId, { status: event.target.value, completed: event.target.value === "Klar" });
    });
    row.querySelector('[data-action="rec-due"]').addEventListener("change", (event) => {
      const dueAt = new Date(event.target.value).getTime();
      if (Number.isFinite(dueAt)) updateRecommendation(patient.id, recId, { dueAt });
    });
  });
}

function updateRecommendation(patientId, recId, changes) {
  updatePatient(patientId, (patient) => ({
    ...patient,
    recommendations: patient.recommendations.map((item) => (item.id === recId ? { ...item, ...changes } : item)),
  }));
}

function openPatientDetail(patientId) {
  const patient = state.patients.find((item) => item.id === patientId);
  if (!patient) return;
  state.selectedPatientId = patientId;
  renderPatientDetail(patient);
  elements.detailDrawer.setAttribute("aria-hidden", "false");
  renderAvatars();
  renderPatients();
}

function closePatientDetail() {
  elements.detailDrawer.setAttribute("aria-hidden", "true");
}

function mapTranscriptToSelect(field, transcript) {
  const spoken = normalize(transcript);
  const options = Array.from(field.options);
  const direct = options.find((option) => normalize(option.textContent) === spoken || spoken.includes(normalize(option.textContent)));
  if (direct) return direct.value;

  const aliases = {
    kvinna: "Kvinna",
    man: "Man",
    annat: "Annat/okänt",
    okant: "Annat/okänt",
    ja: "true",
    nej: "false",
    automatisk: "",
    gron: "green",
    gul: "yellow",
    orange: "orange",
    rod: "red",
    alert: "Alert",
    vaken: "Alert",
    konfusion: "Ny konfusion",
    tilltal: "Reagerar på tilltal",
    smarta: "Reagerar på smärta",
    okontaktbar: "Ej kontaktbar",
  };

  const alias = Object.entries(aliases).find(([key]) => spoken.includes(key));
  if (!alias) return field.value;
  const aliasValue = alias[1];
  const match = options.find((option) => option.value === aliasValue || option.textContent === aliasValue);
  return match ? match.value : field.value;
}

function insertTranscript(field, transcript) {
  if (field.tagName === "SELECT") {
    field.value = mapTranscriptToSelect(field, transcript);
  } else if (field.type === "number") {
    const match = transcript.replace(",", ".").match(/-?\d+(\.\d+)?/);
    if (match) field.value = match[0];
  } else {
    const separator = field.value && !field.value.endsWith(" ") ? " " : "";
    field.value = `${field.value}${separator}${transcript}`.trim();
  }

  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.dispatchEvent(new Event("change", { bubbles: true }));
}

function startVoiceInput(field, button) {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    button.classList.add("voice-error");
    button.title = "Din webbläsare stödjer inte röstinmatning här. Prova Chrome eller Edge.";
    return;
  }

  if (state.recognition) {
    state.recognition.abort();
    state.recognition = null;
  }

  const recognition = new Recognition();
  state.recognition = recognition;
  state.listeningField = field;
  recognition.lang = "sv-SE";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  button.classList.add("is-listening");
  button.title = "Lyssnar...";

  recognition.addEventListener("result", (event) => {
    const transcript = event.results?.[0]?.[0]?.transcript || "";
    if (transcript) insertTranscript(field, transcript);
  });

  recognition.addEventListener("end", () => {
    button.classList.remove("is-listening");
    button.title = "Diktera till detta fält";
    state.recognition = null;
    state.listeningField = null;
  });

  recognition.addEventListener("error", () => {
    button.classList.remove("is-listening");
    button.classList.add("voice-error");
    window.setTimeout(() => button.classList.remove("voice-error"), 1600);
  });

  recognition.start();
}

function enhanceVoiceInputs() {
  const fields = elements.patientForm.querySelectorAll("input[name], textarea[name], select[name]");
  fields.forEach((field) => {
    if (field.closest(".voice-field")) return;
    const wrapper = document.createElement("div");
    wrapper.className = "voice-field";
    field.parentNode.insertBefore(wrapper, field);
    wrapper.appendChild(field);

    const button = document.createElement("button");
    button.className = "voice-button";
    button.type = "button";
    button.title = "Diktera till detta fält";
    button.setAttribute("aria-label", "Diktera till detta fält");
    button.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z"></path>
        <path d="M6 10v1a6 6 0 0 0 12 0v-1"></path>
        <path d="M12 17v4"></path>
        <path d="M8 21h8"></path>
      </svg>
    `;
    button.addEventListener("click", () => startVoiceInput(field, button));
    wrapper.appendChild(button);
  });
}

function render() {
  state.now = Date.now();
  renderStats();
  renderLegend();
  renderAvatars();
  renderPatients();

  if (state.selectedPatientId && elements.detailDrawer.getAttribute("aria-hidden") === "false") {
    const patient = state.patients.find((item) => item.id === state.selectedPatientId);
    if (patient) renderPatientDetail(patient);
  }
}

function bindEvents() {
  elements.accountForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = elements.emailInput.value.trim().toLowerCase();
    state.account = email || DEMO_ACCOUNT;
    loadPatients();
    render();
  });

  elements.seedButton.addEventListener("click", resetDemoData);

  elements.openAddPatient.addEventListener("click", () => {
    elements.patientForm.reset();
    fillFormFromDraft();
    elements.patientModal.showModal();
  });

  elements.closePatientModal.addEventListener("click", () => elements.patientModal.close());
  elements.cancelPatient.addEventListener("click", () => elements.patientModal.close());
  elements.closeDrawer.addEventListener("click", closePatientDetail);
  elements.detailDrawer.addEventListener("click", (event) => {
    if (event.target === elements.detailDrawer) closePatientDetail();
  });

  elements.riskFilter.addEventListener("change", (event) => {
    state.riskFilter = event.target.value;
    renderPatients();
  });

  elements.patientForm.addEventListener("input", saveFormDraft);
  elements.patientForm.addEventListener("change", saveFormDraft);
  elements.patientForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addPatientFromForm(elements.patientForm);
    elements.patientModal.close();
  });

  window.addEventListener("beforeunload", () => {
    persist();
    saveFormDraft();
  });
}

function init() {
  bindEvents();
  enhanceVoiceInputs();
  loadPatients();
  render();
  window.setInterval(() => {
    state.now = Date.now();
    renderStats();
    renderAvatars();
    renderPatients();
    if (state.selectedPatientId && elements.detailDrawer.getAttribute("aria-hidden") === "false") {
      const patient = state.patients.find((item) => item.id === state.selectedPatientId);
      if (patient) renderPatientDetail(patient);
    }
  }, 15000);
}

init();
