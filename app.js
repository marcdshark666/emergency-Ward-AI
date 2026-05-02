const STORAGE_VERSION = "emergency-ward-ai-v1";
const ACCOUNT_KEY = `${STORAGE_VERSION}:active-account`;
const todayKey = new Date().toISOString().slice(0, 10);

const riskOrder = { green: 1, yellow: 2, orange: 3, red: 4 };

const riskMeta = {
  green: { label: "Grön", tone: "Stabil", monitor: "Basal observation", zone: "monitoring" },
  yellow: { label: "Gul", tone: "Behöver monitorering", monitor: "Nya vitalparametrar inom 60 min", zone: "monitoring" },
  orange: { label: "Orange", tone: "Potentiellt instabil", monitor: "Tät monitorering och läkarkontroll", zone: "acute" },
  red: { label: "Röd", tone: "Akut/instabil", monitor: "Akut monitorering, överväg IVA/MIVA/HIA", zone: "acute" },
};

const flowStatuses = [
  { id: "ambulance", label: "I ambulans", zone: "ambulance" },
  { id: "waiting", label: "Väntrum", zone: "waiting" },
  { id: "acute", label: "Akut monitorering", zone: "acute" },
  { id: "monitoring", label: "Monitoreras", zone: "monitoring" },
  { id: "near", label: "Närakut", zone: "near" },
  { id: "admitted", label: "Inlagd", zone: "monitoring" },
  { id: "consulted", label: "Remitterad/konsulterad", zone: "monitoring" },
  { id: "home", label: "Skickad hem", zone: "home" },
  { id: "closed", label: "Avslutad", zone: "home" },
];

const timerPresets = [
  { id: "vitals15", category: "Observation", label: "Nya vitalparametrar", minutes: 15 },
  { id: "news60", category: "Observation", label: "Ny NEWS2-bedömning", minutes: 60 },
  { id: "ekg10", category: "Undersökning", label: "Beställ/upprepa EKG", minutes: 10 },
  { id: "ct45", category: "Undersökning", label: "CT/röntgen-beslut", minutes: 45 },
  { id: "lactate120", category: "Labb", label: "Upprepa laktat", minutes: 120 },
  { id: "fluid20", category: "Behandling", label: "Vätskebedömning", minutes: 20 },
  { id: "pain30", category: "Behandling", label: "Smärtutvärdering", minutes: 30 },
  { id: "consult30", category: "Konsultation", label: "Kontakta konsult", minutes: 30 },
];

const staffTeam = [
  { id: "er_doctor", label: "Akutläkare", short: "AK", color: "#e5484d", timer: "Läkarkontroll", minutes: 15 },
  { id: "nurse", label: "Sjuksköterska", short: "SSK", color: "#2f80ed", timer: "Omvårdnad/nya vitalparametrar", minutes: 20 },
  { id: "surgeon", label: "Kirurg", short: "KIR", color: "#f97316", timer: "Kirurgkonsult", minutes: 30 },
  { id: "anesthesia", label: "Anestesiolog", short: "ANE", color: "#8b5cf6", timer: "Anestesi/IVA-bedömning", minutes: 15 },
  { id: "cardiology", label: "Kardiolog", short: "KAR", color: "#22a06b", timer: "Kardiolog/HIA-bedömning", minutes: 30 },
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

const parameterInfo = {
  age: {
    title: "Ålder",
    normal: "Ingen NEWS2-poäng, men hög/låg ålder påverkar klinisk risk.",
    danger: "Skör äldre patient, spädbarn eller kraftig åldersrelaterad risk kräver extra klinisk värdering.",
    meaning: "Patientens ålder används som kontext för prioritering, läkemedel och differentialdiagnoser.",
  },
  rr: {
    title: "AF - andningsfrekvens",
    normal: "12-20 andetag/min hos vuxen.",
    danger: "<=8 eller >=25/min ger NEWS2 3 poäng och kan tala för akut svikt.",
    meaning: "Snabb eller långsam andning kan spegla hypoxi, sepsis, smärta, acidos eller CNS-påverkan.",
  },
  sat: {
    title: "Saturation",
    normal: "Vanligen 96-100% utan syrgas, men mål kan vara lägre vid KOL/CO2-retention.",
    danger: "<=91% ger NEWS2 3 poäng. Ihållande hypoxi kräver snabb bedömning.",
    meaning: "Syremättnad visar hur väl blodet syresätts.",
  },
  oxygen: {
    title: "Syrgasbehov",
    normal: "Ingen tillförd syrgas vid stabil syresättning.",
    danger: "Nytt eller ökande syrgasbehov är en varningssignal och ger NEWS2 2 poäng.",
    meaning: "Visar om patienten behöver extra oxygen för att hålla acceptabel saturation.",
  },
  temp: {
    title: "Temperatur",
    normal: "Cirka 36.1-38.0 °C.",
    danger: "<=35.0 °C eller >39.0 °C är allvarliga avvikelser; feber med påverkan kan tala för infektion/sepsis.",
    meaning: "Temperatur hjälper att bedöma infektion, inflammation, hypotermi och behandlingssvar.",
  },
  sbp: {
    title: "Systoliskt blodtryck",
    normal: "Ofta cirka 111-219 mmHg i NEWS2-skalan.",
    danger: "<=90 mmHg eller >=220 mmHg ger NEWS2 3 poäng och kan kräva akut åtgärd.",
    meaning: "Speglar cirkulation, chockrisk, blödning, dehydrering eller hypertensiv kris.",
  },
  pulse: {
    title: "Puls",
    normal: "51-90 slag/min i NEWS2-skalan.",
    danger: "<=40 eller >=131/min ger NEWS2 3 poäng. Takykardi kan vara smärta, sepsis, blödning eller arytmi.",
    meaning: "Hjärtfrekvens och cirkulatorisk stress.",
  },
  consciousness: {
    title: "Medvetandegrad",
    normal: "Alert/vaken och orienterad.",
    danger: "Ny konfusion, reagerar på tilltal/smärta eller ej kontaktbar ger NEWS2 3 poäng.",
    meaning: "Påverkat medvetande kan signalera hypoxi, stroke, sepsis, metabol rubbning eller intoxikation.",
  },
  hb: {
    title: "Hb",
    normal: "Ungefär 120-160 g/L beroende på kön/lab.",
    danger: "<90 g/L eller snabb Hb-sänkning kan tala för blödning eller allvarlig anemi.",
    meaning: "Mängd hemoglobin och syrebärande kapacitet.",
  },
  wbc: {
    title: "LPK",
    normal: "Cirka 3.5-8.8 x10^9/L.",
    danger: ">15 eller <3 kan vara varningssignal vid infektion, sepsis eller benmärgspåverkan.",
    meaning: "Vita blodkroppar, ofta kopplat till infektion/inflammation.",
  },
  platelets: {
    title: "TPK",
    normal: "Cirka 150-400 x10^9/L.",
    danger: "<100 ökar blödnings-/sjukdomsmisstanke; mycket höga värden kan vara trombosrisk i rätt kontext.",
    meaning: "Trombocyter/blodplättar, viktiga för koagulation.",
  },
  crp: {
    title: "CRP",
    normal: "Ofta <5 mg/L.",
    danger: ">80 är tydligt förhöjt; >180 kan tala för kraftig inflammation/infektion.",
    meaning: "Inflammationsmarkör, måste tolkas med symtom och tidförlopp.",
  },
  na: {
    title: "Natrium",
    normal: "135-145 mmol/L.",
    danger: "<130 eller >150 kan ge neurologiska symtom och kräver aktiv bedömning.",
    meaning: "Viktig elektrolyt för vätske- och nervfunktion.",
  },
  k: {
    title: "Kalium",
    normal: "3.5-5.0 mmol/L.",
    danger: "<3.0 eller >5.8 kan ge arytmirisk, särskilt med EKG-förändringar.",
    meaning: "Elektrolyt med stor betydelse för hjärtrytm och muskelfunktion.",
  },
  creatinine: {
    title: "Kreatinin",
    normal: "Varierar med kön/muskelmassa, ofta cirka 45-105 µmol/L.",
    danger: ">150 eller snabb stegring talar för njurpåverkan/dehydrering/chockrisk.",
    meaning: "Njurfunktion och vätskestatus.",
  },
  egfr: {
    title: "eGFR",
    normal: ">60 ml/min/1.73 m² är oftast acceptabelt, beroende på ålder.",
    danger: "<45 talar för nedsatt njurfunktion; <30 påverkar läkemedel/kontrast och inläggningsbeslut.",
    meaning: "Beräknad njurfiltration.",
  },
  glucose: {
    title: "Glukos",
    normal: "Cirka 4-8 mmol/L akut, beroende på situation.",
    danger: "<3.5 eller >18 mmol/L kräver åtgärd/uppföljning.",
    meaning: "Blodsocker, viktigt vid medvetandepåverkan, infektion och diabetes.",
  },
  lactate: {
    title: "Laktat",
    normal: "Ofta <2.0 mmol/L.",
    danger: ">=2.5 är varningssignal; >=4 är allvarligt och kan tala för chock/sepsis/hypoperfusion.",
    meaning: "Markör för vävnadsstress och otillräcklig perfusion.",
  },
  troponin: {
    title: "Troponin",
    normal: "Beror på metod, ofta lågt/under beslutsgräns.",
    danger: "Förhöjt eller stigande/fallande troponin kan tala för myokardskada/AKS.",
    meaning: "Hjärtmuskelmarkör som måste tolkas med EKG, symtom och dynamik.",
  },
  ddimer: {
    title: "D-dimer",
    normal: "Ofta <0.5 mg/L FEU, åldersjustering kan användas.",
    danger: "Förhöjt är ospecifikt men kan stödja utredning för trombos/lungemboli i rätt riskprofil.",
    meaning: "Nedbrytningsprodukt från koagel/fibrin.",
  },
  liver: {
    title: "Leverprover",
    normal: "ALAT/ASAT/ALP/bilirubin enligt lokalt labb.",
    danger: "Kraftig stegring, ikterus eller koagulationspåverkan kräver snabb bedömning.",
    meaning: "Tecken på lever-/gallpåverkan eller systemisk sjukdom.",
  },
  bloodGas: {
    title: "Blodgas",
    normal: "pH cirka 7.35-7.45; övrigt beror på artär/venös gas.",
    danger: "pH <7.30, högt pCO2, kraftigt BE-underskott eller laktatstegring är varningssignaler.",
    meaning: "Syra-bas, ventilation, oxygenation och perfusion.",
  },
  urine: {
    title: "Urinsticka",
    normal: "Ofta negativ för nitrit, leukocyter, blod och ketoner.",
    danger: "Nitrit/LPK med påverkan kan stödja UVI/sepsis; ketoner/glukos kan tala för metabol påverkan.",
    meaning: "Snabb screening för UVI, blod, protein, glukos och ketoner.",
  },
  otherLab: {
    title: "Annat labb",
    normal: "Beror på provet.",
    danger: "Markera särskilt värden som påverkar akut handläggning.",
    meaning: "Fritt fält för övriga prover som behöver följas.",
  },
};

const elements = {
  accountForm: document.querySelector("#accountForm"),
  emailInput: document.querySelector("#emailInput"),
  accountLabel: document.querySelector("#accountLabel"),
  todayLabel: document.querySelector("#todayLabel"),
  activeCount: document.querySelector("#activeCount"),
  nearCount: document.querySelector("#nearCount"),
  timerCount: document.querySelector("#timerCount"),
  highNewsCount: document.querySelector("#highNewsCount"),
  overdueCount: document.querySelector("#overdueCount"),
  hospitalMap: document.querySelector("#hospitalMap"),
  avatarLayer: document.querySelector("#avatarLayer"),
  staffDock: document.querySelector("#staffDock"),
  patientGrid: document.querySelector("#patientGrid"),
  loginGate: document.querySelector("#loginGate"),
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
  signOutButton: document.querySelector("#signOutButton"),
};

const savedAccount = localStorage.getItem(ACCOUNT_KEY) || "";

const state = {
  account: savedAccount === "demo@akut.local" ? "" : savedAccount,
  patients: [],
  selectedPatientId: "",
  editingPatientId: "",
  riskFilter: "all",
  now: Date.now(),
  recognition: null,
  listeningField: null,
  activeStaffId: "",
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

function parameterTooltip(key) {
  const info = parameterInfo[key];
  if (!info) return "";
  return `${info.title}\nVad: ${info.meaning}\nNormalintervall: ${info.normal}\nFarligt/akut: ${info.danger}`;
}

function infoIcon(key) {
  const text = parameterTooltip(key);
  if (!text) return "";
  return `<button class="info-dot" type="button" title="${escapeHtml(text)}" aria-label="Information om ${escapeHtml(parameterInfo[key].title)}">i</button>`;
}

function editIcon(fieldName) {
  return `<button class="mini-edit" type="button" data-edit-field="${escapeHtml(fieldName)}" title="Redigera detta fält" aria-label="Redigera detta fält">✎</button>`;
}

function newsInfoKey(partId) {
  const lookup = {
    AF: "rr",
    Sat: "sat",
    Syrgas: "oxygen",
    Temp: "temp",
    SBT: "sbp",
    Puls: "pulse",
    Medvetande: "consciousness",
  };
  return lookup[partId] || "";
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

function getZoneFromPosition(position) {
  if (!position) return "";
  const { x, y } = position;
  if (x >= 38 && x <= 55 && y >= 58 && y <= 75) return "ambulance";
  if (x >= 77 && x <= 96 && y >= 47 && y <= 70) return "waiting";
  if (x >= 79 && x <= 98 && y >= 49 && y <= 76) return "home";
  if (x >= 2 && x <= 35 && y >= 28 && y <= 82) return "acute";
  if (x >= 65 && x <= 98 && y >= 3 && y <= 48) return "near";
  if (x >= 27 && x <= 71 && y >= 5 && y <= 64) return "monitoring";
  if (x >= 35 && x <= 82 && y >= 56 && y <= 90) return "monitoring";
  return "monitoring";
}

function flowStatusFromZone(zone) {
  if (zone === "ambulance") return "ambulance";
  if (zone === "waiting") return "waiting";
  if (zone === "acute") return "acute";
  if (zone === "near") return "near";
  if (zone === "home") return "home";
  return "monitoring";
}

function staffRoleClass(staffId = "") {
  return `staff-role-${String(staffId).replace(/_/g, "-")}`;
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
  if (!state.account) return;
  localStorage.setItem(ACCOUNT_KEY, state.account);
  localStorage.setItem(storageKey(), JSON.stringify(state.patients));
}

function loadPatients() {
  if (!state.account) {
    state.patients = [];
    return;
  }

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
  if (!state.account) {
    showLoginRequired();
    return;
  }
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

function activeTimers(patient) {
  return (patient.recommendations || [])
    .filter((item) => !item.completed && item.status !== "Klar")
    .sort((a, b) => a.dueAt - b.dueAt);
}

function nextTimerInfo(patient) {
  const [timer] = activeTimers(patient);
  if (!timer) return null;
  const timerState = getTimerState(timer);
  const minutes = minutesUntil(timer.dueAt);
  return {
    ...timer,
    timerState,
    label: timerState === "overdue" ? `${Math.abs(minutes)} min sen` : `${Math.max(minutes, 0)} min`,
  };
}

function patientHasOverdue(patient) {
  return activeTimers(patient).some((item) => getTimerState(item) === "overdue");
}

function updatePatient(patientId, updater) {
  if (!state.account) {
    showLoginRequired();
    return;
  }

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
  if (!state.account) return;
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

function patientPatchFromData(data) {
  return {
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
  };
}

function addPatientFromForm(form) {
  if (!state.account) {
    showLoginRequired();
    return;
  }

  if (state.editingPatientId) {
    const data = serializeForm(form);
    const patch = patientPatchFromData(data);
    const editedId = state.editingPatientId;
    state.editingPatientId = "";
    updatePatient(editedId, (patient) => ({
      ...patient,
      ...patch,
      flowStatus: patient.flowStatus,
      mapPosition: patient.mapPosition,
      recommendations: patient.recommendations || [],
      staffInteractions: patient.staffInteractions || [],
    }));
    form.reset();
    openPatientDetail(editedId);
    return;
  }

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

function setFormValue(name, value) {
  const field = elements.patientForm.elements[name];
  if (field) field.value = value ?? "";
}

function fillPatientFormForEdit(patient) {
  const vitals = patient.vitals || {};
  const status = patient.statusFindings || {};
  const labs = patient.labs || {};
  setFormValue("name", patient.name);
  setFormValue("sex", patient.sex);
  setFormValue("age", patient.age);
  setFormValue("complaint", patient.complaint);
  setFormValue("history", patient.history);
  setFormValue("manualRisk", patient.manualRisk || "");
  setFormValue("rr", vitals.rr ?? "");
  setFormValue("sat", vitals.sat ?? "");
  setFormValue("oxygen", vitals.oxygen ? "true" : "false");
  setFormValue("temp", vitals.temp ?? "");
  setFormValue("sbp", vitals.sbp ?? "");
  setFormValue("pulse", vitals.pulse ?? "");
  setFormValue("consciousness", vitals.consciousness || "Alert");
  setFormValue("at", status.at);
  setFormValue("heart", status.heart);
  setFormValue("lungs", status.lungs);
  setFormValue("abdomen", status.abdomen);
  setFormValue("neuro", status.neuro);
  setFormValue("skin", status.skin);
  setFormValue("pain", status.pain);
  setFormValue("otherStatus", status.otherStatus);
  setFormValue("hb", labs.hb);
  setFormValue("wbc", labs.wbc);
  setFormValue("platelets", labs.platelets);
  setFormValue("crp", labs.crp);
  setFormValue("na", labs.na);
  setFormValue("k", labs.k);
  setFormValue("creatinine", labs.creatinine);
  setFormValue("egfr", labs.egfr);
  setFormValue("glucose", labs.glucose);
  setFormValue("lactate", labs.lactate);
  setFormValue("troponin", labs.troponin);
  setFormValue("ddimer", labs.ddimer);
  setFormValue("liver", labs.liver);
  setFormValue("bloodGas", labs.bloodGas);
  setFormValue("urine", labs.urine);
  setFormValue("otherLab", labs.otherLab);
}

function openEditPatient(patientId) {
  const patient = state.patients.find((item) => item.id === patientId);
  if (!patient) return;
  state.editingPatientId = patientId;
  elements.patientForm.reset();
  fillPatientFormForEdit(patient);
  elements.patientModal.showModal();
}

function openEditPatientField(patientId, fieldName) {
  openEditPatient(patientId);
  window.setTimeout(() => {
    const field = elements.patientForm.elements[fieldName];
    if (!field) return;
    field.focus();
    field.scrollIntoView({ block: "center", behavior: "smooth" });
  }, 80);
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
  const near = state.patients.filter((patient) => patient.flowStatus === "near").length;
  const timers = state.patients.reduce((sum, patient) => sum + activeTimers(patient).length, 0);
  const highNews = state.patients.filter((patient) => (patient.analysis?.news?.total || 0) >= 5).length;
  const isLoggedIn = Boolean(state.account);
  document.body.classList.toggle("is-locked", !isLoggedIn);
  elements.loginGate.hidden = isLoggedIn;
  elements.seedButton.disabled = !isLoggedIn;
  elements.signOutButton.hidden = !isLoggedIn;
  elements.todayLabel.textContent = new Intl.DateTimeFormat("sv-SE", { dateStyle: "full" }).format(new Date());
  elements.accountLabel.textContent = isLoggedIn ? state.account : "Logga in krävs";
  elements.emailInput.value = isLoggedIn ? state.account : "";
  elements.activeCount.textContent = active;
  if (elements.nearCount) elements.nearCount.textContent = near;
  if (elements.timerCount) elements.timerCount.textContent = timers;
  if (elements.highNewsCount) elements.highNewsCount.textContent = highNews;
  if (elements.overdueCount) elements.overdueCount.textContent = overdue;
  document.body.classList.toggle("has-overdue", overdue > 0);
}

function avatarPosition(patient, zoneIndex, zoneCount) {
  if (patient.mapPosition) return patient.mapPosition;

  const zone = getPatientZone(patient);
  const index = zoneIndex + 1;
  const jitter = (patient.id.charCodeAt(patient.id.length - 1) % 7) - 3;

  if (zone === "ambulance") return { x: 43 + (index % 2) * 7 + jitter * 0.35, y: 66 + Math.floor(index / 2) * 4 };
  if (zone === "waiting") return { x: 83 + (index % 3) * 5 + jitter * 0.3, y: 57 + Math.floor(index / 3) * 6 };
  if (zone === "acute") return { x: 12 + (index % 3) * 7 + jitter * 0.35, y: 48 + Math.floor(index / 3) * 12 };
  if (zone === "monitoring") return { x: 39 + (index % 4) * 7 + jitter * 0.35, y: 28 + Math.floor(index / 4) * 10 };
  if (zone === "near") return { x: 76 + (index % 3) * 7 + jitter * 0.3, y: 20 + Math.floor(index / 3) * 10 };
  return { x: 86 + (index % 3) * 4 + jitter * 0.25, y: 63 + Math.floor(index / 3) * 5 };
}

function patientDisplayCode(patient) {
  const prefix = normalize(patient.name || patient.complaint || "p").replace(/[^a-z0-9]/g, "").slice(0, 1).toUpperCase() || "P";
  const seed = patient.id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return `${prefix}-${100 + (seed % 900)}`;
}

function patientAvatarProfile(patient) {
  const age = parseNumber(patient.age);
  const sex = normalize(patient.sex || "");
  const lifeStage = age !== null && age < 13 ? "child" : age !== null && age < 18 ? "teen" : age !== null && age >= 75 ? "elderly" : "adult";
  const gender = sex === "kvinna" ? "woman" : sex === "man" ? "man" : "neutral";

  const scrubByStage = {
    child: "#34d399",
    teen: "#38bdf8",
    adult: "#2f80ed",
    elderly: "#a3a3a3",
  };
  const accentByGender = {
    woman: "#f472b6",
    man: "#2563eb",
    neutral: "#22a06b",
  };

  return {
    lifeStage,
    gender,
    scale: lifeStage === "child" ? 0.76 : lifeStage === "teen" ? 0.9 : lifeStage === "elderly" ? 0.94 : 1,
    scrub: gender === "woman" ? "#ec4899" : scrubByStage[lifeStage],
    accent: accentByGender[gender],
  };
}

function patientConditionTheme(patient, flags = symptomFlags(patient)) {
  const labs = patient.labs || {};
  const vitals = patient.vitals || {};
  const text = normalize([patient.complaint, patient.history, patient.statusFindings?.abdomen, patient.statusFindings?.otherStatus].join(" "));
  const sat = parseNumber(vitals.sat);
  const creatinine = parseNumber(labs.creatinine);
  const egfr = parseNumber(labs.egfr);
  const hb = parseNumber(labs.hb);
  const platelets = parseNumber(labs.platelets);

  const pregnancyMentioned = /gravid|pregnan/.test(text) && !/(ej|inte|icke)\s+gravid/.test(text);
  if (pregnancyMentioned) return "pregnant";
  if (flags.chestPain || parseNumber(labs.troponin) > 40) return "cardiac";
  if (flags.dyspnea || (sat !== null && sat <= 94)) return "respiratory";
  if (flags.neuro || (vitals.consciousness && normalize(vitals.consciousness) !== "alert")) return "neuro";
  if (flags.abdomen) return "abdominal";
  if (flags.trauma) return "trauma";
  if ((creatinine !== null && creatinine > 150) || (egfr !== null && egfr < 45)) return "renal";
  if ((hb !== null && hb < 90) || (platelets !== null && platelets < 100)) return "blood";
  if (flags.infection || parseNumber(labs.crp) > 80 || parseNumber(labs.lactate) >= 2.5) return "infection";
  if (/allerg|anafyl/.test(text)) return "allergy";
  if (/intox|overdos|gift/.test(text)) return "toxic";
  return "general";
}

function avatarStyle(patient) {
  const palettes = [
    ["#ffcf70", "#2f80ed", "#16324f"],
    ["#f4a261", "#22a06b", "#123b2a"],
    ["#ffd6a5", "#e5484d", "#5b171c"],
    ["#e8c39e", "#8b5cf6", "#31215f"],
    ["#f6d1bd", "#f97316", "#58270a"],
  ];
  const seed = patient.id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const [skin, scrub, dark] = palettes[seed % palettes.length];
  const visual = clinicalVisual(patient);
  const profile = patientAvatarProfile(patient);
  return `--avatar-skin:${visual.skin || skin}; --avatar-scrub:${profile.scrub || scrub}; --avatar-dark:${dark}; --avatar-accent:${profile.accent}; --avatar-scale:${profile.scale}; --wellness:${visual.wellness}%;`;
}

function clinicalVisual(patient) {
  const flags = symptomFlags(patient);
  const labs = patient.labs || {};
  const vitals = patient.vitals || {};
  const risk = patient.analysis?.risk || "green";
  const sat = parseNumber(vitals.sat);
  const temp = parseNumber(vitals.temp);
  const crp = parseNumber(labs.crp);
  const lactate = parseNumber(labs.lactate);
  const troponin = parseNumber(labs.troponin);
  const flow = patient.flowStatus || "";
  let symptom = "&#129658;";
  let condition = `condition-${risk}`;
  let skin = "";
  let posture = "standing";

  if (flags.chestPain || troponin > 40) symptom = "&#10084;&#65039;";
  if (flags.abdomen) symptom = "&#129314;";
  if (flags.dyspnea || (sat !== null && sat <= 94)) symptom = "&#129729;";
  if (flags.infection || (temp !== null && temp >= 38) || crp > 80) symptom = "&#128293;";
  if (flags.neuro) symptom = "&#129504;";
  if (flags.trauma) symptom = "&#129460;";
  const theme = patientConditionTheme(patient, flags);
  const symptomByTheme = {
    cardiac: "❤️",
    respiratory: "🫁",
    abdominal: "🤢",
    infection: "🔥",
    neuro: "🧠",
    trauma: "🦴",
    renal: "💧",
    blood: "🩸",
    allergy: "⚠️",
    toxic: "💊",
    pregnant: "🤰",
    general: "🩺",
  };
  symptom = symptomByTheme[theme] || symptom;

  if (sat !== null && sat <= 92) {
    condition = "condition-cyanotic";
    skin = "#9db7d7";
  } else if ((temp !== null && temp >= 38.5) || crp > 120) {
    condition = "condition-febrile";
    skin = "#ffb199";
  } else if (lactate >= 2.5 || risk === "red") {
    condition = "condition-shock";
    skin = "#d8c4ad";
  }

  if (flow === "ambulance") posture = "bed";
  else if (flow === "waiting") posture = "waiting";
  else if (flow === "acute" || risk === "red") posture = "bed";
  else if (flow === "near" || flow === "consulted") posture = "chair";
  else if (flow === "home" || flow === "closed") posture = "home";
  else if (risk === "yellow") posture = "waiting";

  const wellnessByRisk = { green: 24, yellow: 48, orange: 72, red: 96 };
  const wellness = Math.min(100, Math.max(12, wellnessByRisk[risk] + (sat !== null && sat <= 92 ? 12 : 0) + (temp !== null && temp >= 38.5 ? 10 : 0)));
  return { symptom, condition, skin, posture, wellness, theme };
}

function renderStaffDock() {
  elements.staffDock.innerHTML = staffTeam
    .map((staff) => `
      <button
        class="staff-token ${staffRoleClass(staff.id)} ${state.activeStaffId === staff.id ? "selected" : ""}"
        data-staff-id="${staff.id}"
        style="--staff-color:${staff.color};"
        type="button"
        title="Klicka för att välja eller dra till patient: ${escapeHtml(staff.label)}"
      >
        <span class="staff-head"></span>
        <span class="staff-body"></span>
        <span class="staff-tool"></span>
        <strong>${escapeHtml(staff.short)}</strong>
        <small>${escapeHtml(staff.label)}</small>
      </button>
    `)
    .join("");

  elements.staffDock.querySelectorAll("[data-staff-id]").forEach((button) => bindStaffToken(button));
}

function renderMapStaffAssignments(placements) {
  const byPatientId = new Map(placements.map((item) => [item.patient.id, item.position]));
  return state.patients
    .flatMap((patient) => {
      const position = byPatientId.get(patient.id);
      if (!position) return [];
      return (patient.staffInteractions || [])
        .filter((item) => !item.completed)
        .slice(0, 2)
        .map((item, index) => {
          const staff = staffTeam.find((member) => member.id === item.staffId);
          if (!staff) return "";
          const x = Math.min(96, Math.max(5, position.x + 5 + index * 4));
          const y = Math.min(96, Math.max(5, position.y - 8 - index * 5));
          const isReviewDue = item.reviewDueAt && item.reviewDueAt <= state.now;
          return `
            <button
              class="map-staff-avatar ${staffRoleClass(staff.id)} ${isReviewDue ? "needs-review" : "en-route"}"
              data-map-staff-id="${item.id}"
              data-staff-patient-id="${patient.id}"
              style="left:${x}%; top:${y}%; --target-x:${x}%; --target-y:${y}%; --staff-color:${staff.color};"
              type="button"
              title="${escapeHtml(staff.label)}: ${escapeHtml(item.task || staff.timer)}"
            >
              <span class="staff-head"></span>
              <span class="staff-body"></span>
              <span class="staff-tool"></span>
              <small>${escapeHtml(staff.short)}</small>
              ${isReviewDue ? `<b>Stäm av</b>` : ""}
            </button>
          `;
        });
    })
    .join("");
}

function renderAvatars() {
  const zoneIndexes = { ambulance: 0, waiting: 0, acute: 0, monitoring: 0, near: 0, home: 0 };
  const placements = state.patients.map((patient) => {
      const zone = getPatientZone(patient);
      const position = avatarPosition(patient, zoneIndexes[zone] || 0, state.patients.length);
      zoneIndexes[zone] = (zoneIndexes[zone] || 0) + 1;
      return { patient, zone, position };
    });

  const patientMarkup = placements
    .map(({ patient, position }) => {
      const risk = patient.analysis.risk;
      const overdue = patientHasOverdue(patient);
      const nextTimer = nextTimerInfo(patient);
      const visual = clinicalVisual(patient);
      const profile = patientAvatarProfile(patient);
      const selected = state.selectedPatientId === patient.id ? " selected" : "";
      return `
        <button
          class="patient-avatar risk-${risk} avatar-${profile.lifeStage} avatar-${profile.gender} theme-${visual.theme} posture-${visual.posture} ${visual.condition}${overdue ? " overdue" : ""}${selected}"
          data-patient-id="${patient.id}"
          style="left:${position.x}%; top:${position.y}%; ${avatarStyle(patient)}"
          title="${escapeHtml(patient.name)} - NEWS ${patient.analysis.news.total}"
          type="button"
        >
          <span class="patient-callout">
            <span class="callout-top">
              <strong>${escapeHtml(patientDisplayCode(patient))}</strong>
              ${nextTimer ? `<em>${escapeHtml(nextTimer.label)}</em>` : ""}
            </span>
            <span>${escapeHtml(patient.age)} år</span>
            <p><i>${visual.symptom}</i>${escapeHtml(patient.complaint || "Ej angivet")}</p>
          </span>
          ${nextTimer ? `<span class="avatar-timer ${nextTimer.timerState}">${escapeHtml(nextTimer.label)}</span>` : ""}
          <span class="avatar-symptom">${visual.symptom}</span>
          <span class="avatar-clinical-meter"><i></i></span>
          <span class="avatar-support"><i></i></span>
          <span class="avatar-alert-ring"></span>
          <span class="avatar-head voxel-cube">
            <i class="cube-top"></i>
            <i class="cube-side"></i>
            <b class="eye left"></b>
            <b class="eye right"></b>
          </span>
          <span class="avatar-hair voxel-cube"><i class="cube-top"></i><i class="cube-side"></i></span>
          <span class="avatar-body voxel-cube"><i class="cube-top"></i><i class="cube-side"></i><b class="chest-mark"></b></span>
          <span class="avatar-arm left voxel-limb"><i></i></span>
          <span class="avatar-arm right voxel-limb"><i></i></span>
          <span class="avatar-leg left voxel-limb"><i></i></span>
          <span class="avatar-leg right voxel-limb"><i></i></span>
          <span class="avatar-shadow"></span>
          <small>${escapeHtml(patient.name.replace(/^Patient\s*/i, ""))}</small>
        </button>
      `;
    })
    .join("");

  elements.avatarLayer.innerHTML = patientMarkup + renderMapStaffAssignments(placements);

  elements.avatarLayer.querySelectorAll(".patient-avatar[data-patient-id]").forEach((button) => {
    bindPatientAvatar(button);
  });

  elements.avatarLayer.querySelectorAll("[data-map-staff-id]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      openPatientDetail(button.dataset.staffPatientId);
      focusPatient(button.dataset.staffPatientId);
    });
  });
}

function parseTransformOrigin(originText, element) {
  const [rawX = "50%", rawY = "50%"] = originText.split(" ");
  const read = (value, size) => {
    if (value.endsWith("%")) return (parseFloat(value) / 100) * size;
    if (value === "left" || value === "top") return 0;
    if (value === "right" || value === "bottom") return size;
    if (value === "center") return size / 2;
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : size / 2;
  };

  return {
    x: read(rawX, element.offsetWidth),
    y: read(rawY, element.offsetHeight),
  };
}

function transformedLocalPoint(matrix, origin, x, y) {
  const point = new DOMPoint(x - origin.x, y - origin.y, 0, 1).matrixTransform(matrix);
  return { x: point.x + origin.x, y: point.y + origin.y };
}

function pointerToMapPosition(event) {
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const map = elements.hospitalMap;
  const rect = map.getBoundingClientRect();
  const style = getComputedStyle(map);
  const matrix = style.transform && style.transform !== "none" ? new DOMMatrixReadOnly(style.transform) : new DOMMatrixReadOnly();
  const origin = parseTransformOrigin(style.transformOrigin, map);

  try {
    const corners = [
      transformedLocalPoint(matrix, origin, 0, 0),
      transformedLocalPoint(matrix, origin, map.offsetWidth, 0),
      transformedLocalPoint(matrix, origin, 0, map.offsetHeight),
      transformedLocalPoint(matrix, origin, map.offsetWidth, map.offsetHeight),
    ];
    const minX = Math.min(...corners.map((point) => point.x));
    const minY = Math.min(...corners.map((point) => point.y));
    const layoutLeft = rect.left - minX;
    const layoutTop = rect.top - minY;
    const transformedX = event.clientX - layoutLeft;
    const transformedY = event.clientY - layoutTop;
    const inverted = matrix.inverse();
    const local = new DOMPoint(transformedX - origin.x, transformedY - origin.y, 0, 1).matrixTransform(inverted);
    const x = local.x + origin.x;
    const y = local.y + origin.y;
    return {
      x: clamp((x / map.offsetWidth) * 100, 2, 98),
      y: clamp((y / map.offsetHeight) * 100, 2, 98),
    };
  } catch {
    // Fallback for older mobile browsers that cannot invert a 3D CSS matrix.
  }

  return {
    x: clamp(((event.clientX - rect.left) / rect.width) * 100, 2, 98),
    y: clamp(((event.clientY - rect.top) / rect.height) * 100, 2, 98),
  };
}

function bindPatientAvatar(button) {
  let startX = 0;
  let startY = 0;
  let dragging = false;

  button.addEventListener("contextmenu", (event) => event.preventDefault());

  button.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 && event.button !== 2) return;
    event.preventDefault();
    startX = event.clientX;
    startY = event.clientY;
    dragging = false;
    button.setPointerCapture(event.pointerId);
  });

  button.addEventListener("pointermove", (event) => {
    if (!button.hasPointerCapture(event.pointerId)) return;
    event.preventDefault();
    const distance = Math.hypot(event.clientX - startX, event.clientY - startY);
    if (distance < 7 && !dragging) return;
    dragging = true;
    const position = pointerToMapPosition(event);
    button.classList.add("is-dragging");
    button.style.left = `${position.x}%`;
    button.style.top = `${position.y}%`;
  });

  button.addEventListener("pointerup", (event) => {
    event.preventDefault();
    if (button.hasPointerCapture(event.pointerId)) {
      button.releasePointerCapture(event.pointerId);
    }

    if (dragging) {
      const position = pointerToMapPosition(event);
      const zone = getZoneFromPosition(position);
      updatePatient(button.dataset.patientId, (patient) => ({
        ...patient,
        mapPosition: position,
        flowStatus: flowStatusFromZone(zone),
      }));
      return;
    }

    if (state.activeStaffId) {
      assignStaffToPatient(state.activeStaffId, button.dataset.patientId);
      return;
    }

    openPatientDetail(button.dataset.patientId);
    focusPatient(button.dataset.patientId);
  });

  button.addEventListener("pointercancel", () => button.classList.remove("is-dragging"));
}

function bindStaffToken(button) {
  let startX = 0;
  let startY = 0;
  let dragging = false;

  button.addEventListener("contextmenu", (event) => event.preventDefault());

  button.addEventListener("click", () => {
    if (button.dataset.dragged === "true") return;
    if (promptStaffAssignment(button.dataset.staffId)) return;
    state.activeStaffId = state.activeStaffId === button.dataset.staffId ? "" : button.dataset.staffId;
    renderStaffDock();
  });

  button.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 && event.button !== 2) return;
    event.preventDefault();
    startX = event.clientX;
    startY = event.clientY;
    dragging = false;
    button.setPointerCapture(event.pointerId);
  });

  button.addEventListener("pointermove", (event) => {
    if (!button.hasPointerCapture(event.pointerId)) return;
    event.preventDefault();
    const distance = Math.hypot(event.clientX - startX, event.clientY - startY);
    if (distance < 7 && !dragging) return;
    dragging = true;
    button.classList.add("is-dragging");
    button.style.setProperty("--drag-x", `${event.clientX - startX}px`);
    button.style.setProperty("--drag-y", `${event.clientY - startY}px`);
  });

  button.addEventListener("pointerup", (event) => {
    event.preventDefault();
    if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
    button.classList.remove("is-dragging");
    button.style.removeProperty("--drag-x");
    button.style.removeProperty("--drag-y");
    if (dragging) {
      button.dataset.dragged = "true";
      window.setTimeout(() => {
        delete button.dataset.dragged;
      }, 0);
      const patientId = nearestPatientFromPointer(event.clientX, event.clientY);
      if (patientId) assignStaffToPatient(button.dataset.staffId, patientId);
    }
  });
}

function promptStaffAssignment(staffId) {
  const staff = staffTeam.find((item) => item.id === staffId);
  if (!staff || !state.patients.length) return false;

  const options = state.patients
    .map((patient, index) => `${index + 1}. ${patientDisplayCode(patient)} ${patient.name} - ${patient.complaint}`)
    .join("\n");
  const choice = window.prompt(`${staff.label}: välj patientnummer för uppdrag.\n\n${options}\n\nAvbryt för att bara markera personalen och klicka/dra själv.`);
  if (!choice) return false;

  const selectedIndex = Number.parseInt(choice, 10) - 1;
  const patient = state.patients[selectedIndex];
  if (!patient) {
    window.alert("Hittade ingen patient med det numret.");
    return false;
  }

  const task = window.prompt(`Vad ska ${staff.label} göra hos ${patient.name}?`, staff.timer) || staff.timer;
  assignStaffToPatient(staff.id, patient.id, task);
  return true;
}

function nearestPatientFromPointer(clientX, clientY) {
  let best = { id: "", distance: Infinity };
  elements.avatarLayer.querySelectorAll("[data-patient-id]").forEach((avatar) => {
    const rect = avatar.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const distance = Math.hypot(clientX - centerX, clientY - centerY);
    if (distance < best.distance) best = { id: avatar.dataset.patientId, distance };
  });
  return best.distance < 130 ? best.id : "";
}

function assignStaffToPatient(staffId, patientId, taskText = "") {
  const staff = staffTeam.find((item) => item.id === staffId);
  if (!staff) return;
  const task = taskText.trim() || staff.timer;
  const interaction = {
    id: generateId("staff"),
    staffId: staff.id,
    label: staff.label,
    task,
    status: "På väg",
    completed: false,
    createdAt: Date.now(),
    reviewDueAt: Date.now() + staff.minutes * 60000,
    note: `${staff.label} är skickad till patienten för: ${task}. Stäm av när uppgiften är utförd.`,
  };
  const recommendation = {
    id: generateId("rec"),
    text: `Konsultation: ${task}`,
    category: "Konsultation",
    status: "Pågår",
    completed: false,
    dueAt: Date.now() + staff.minutes * 60000,
  };

  state.activeStaffId = "";
  updatePatient(patientId, (patient) => ({
    ...patient,
    staffInteractions: [interaction, ...(patient.staffInteractions || [])].slice(0, 8),
    recommendations: [recommendation, ...(patient.recommendations || [])],
    flowStatus: staff.id === "surgeon" ? "consulted" : patient.flowStatus,
  }));
  openPatientDetail(patientId);
}

function updateStaffInteraction(patientId, interactionId, result) {
  const isDone = result === "done";
  updatePatient(patientId, (patient) => {
    const interaction = (patient.staffInteractions || []).find((item) => item.id === interactionId);
    const followUp = !isDone && interaction
      ? {
          id: generateId("rec"),
          text: `Följ upp: ${interaction.label} kunde inte bekräfta ${interaction.task || "uppgiften"}`,
          category: "Konsultation",
          status: "Ej påbörjad",
          completed: false,
          dueAt: Date.now() + 10 * 60000,
        }
      : null;

    return {
      ...patient,
      staffInteractions: (patient.staffInteractions || []).map((item) =>
        item.id === interactionId
          ? {
              ...item,
              completed: true,
              status: isDone ? "Klar" : "Ej utförd",
              resolvedAt: Date.now(),
              note: `${item.note} Avstämt: ${isDone ? "utfört" : "ej utfört, behöver följas upp"}.`,
            }
          : item
      ),
      recommendations: followUp ? [followUp, ...(patient.recommendations || [])] : patient.recommendations || [],
    };
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
    .map((item) => `<span class="lab-badge severity-${item.severity}">${escapeHtml(item.label)} ${escapeHtml(item.value)}${infoIcon(item.key)}${editIcon(item.key)}</span>`)
    .join("");
}

function timerBadges(patient, limit = 3) {
  const active = activeTimers(patient);
  if (!active.length) return `<span class="quiet">Inga aktiva timers</span>`;
  return active
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
  const active = activeTimers(patient).slice(0, limit);
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
        <span>${escapeHtml(part.id)}${infoIcon(newsInfoKey(part.id))}${editIcon(newsInfoKey(part.id))}</span>
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

function renderTimerBuilder() {
  return `
    <div class="timer-builder">
      <label>
        Typ
        <select id="timerCategory">
          ${["Observation", "Undersökning", "Labb", "Bilddiagnostik", "Behandling", "Konsultation", "Övrigt"].map((item) => `<option>${item}</option>`).join("")}
        </select>
      </label>
      <label>
        Åtgärd
        <input id="timerLabel" placeholder="t.ex. invänta CT-svar" />
      </label>
      <label>
        Minuter
        <input id="timerMinutes" type="number" min="1" max="720" value="30" />
      </label>
      <button class="button primary" id="startTimerButton" type="button">Starta timer</button>
    </div>
    <div class="quick-timer-grid">
      ${timerPresets.map((preset) => `<button type="button" data-timer-preset="${preset.id}">${escapeHtml(preset.label)} <span>${preset.minutes} min</span></button>`).join("")}
    </div>
  `;
}

function renderStaffInteractions(patient) {
  const interactions = patient.staffInteractions || [];
  if (!interactions.length) {
    return `<p class="quiet">Ingen personal kopplad ännu. Dra en personalfigur till patienten, eller välj personal och klicka på patienten.</p>`;
  }

  return interactions
    .map((item) => `
      <div class="staff-interaction-row ${item.completed ? "completed" : "needs-review"}">
        <div>
          <strong>${escapeHtml(item.label)}</strong>
          <span>${escapeHtml(item.status || "Pågår")} · ${formatClock(item.createdAt)}</span>
        </div>
        <p>${escapeHtml(item.note)}</p>
        ${
          item.completed
            ? `<small>Avstämt ${item.resolvedAt ? formatClock(item.resolvedAt) : ""}</small>`
            : `<div class="staff-review-actions">
                <button type="button" data-staff-check="${item.id}" data-result="done">Utfört</button>
                <button type="button" data-staff-check="${item.id}" data-result="not-done">Ej utfört</button>
              </div>`
        }
      </div>
    `)
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
      <button class="button primary edit-patient-button" id="editPatientButton" type="button">Redigera patientdata</button>
    </section>

    <section class="detail-section">
      <div class="section-title">
        <h3>Redigerbara basuppgifter</h3>
        <span>Alla fält kan ändras</span>
      </div>
      <div class="editable-summary-grid">
        <div><span>Namn/ID ${editIcon("name")}</span><strong>${escapeHtml(patient.name)}</strong></div>
        <div><span>Kön ${editIcon("sex")}</span><strong>${escapeHtml(patient.sex || "Ej valt")}</strong></div>
        <div><span>Ålder ${infoIcon("age")}${editIcon("age")}</span><strong>${escapeHtml(patient.age)}</strong></div>
        <div><span>Sökorsak ${editIcon("complaint")}</span><strong>${escapeHtml(patient.complaint || "Ej angivet")}</strong></div>
        <div class="wide"><span>Kort anamnes ${editIcon("history")}</span><strong>${escapeHtml(patient.history || "Ingen anamnes angiven")}</strong></div>
      </div>
    </section>

    <section class="detail-section danger-section">
      <div class="section-title">
        <h3>Patientpost</h3>
        <span>Tar bort från dagens lista och 3D-vyn</span>
      </div>
      <button class="button danger" id="deletePatientButton" type="button">Ta bort patient</button>
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
      ${renderTimerBuilder()}
      <div class="recommendation-list">${renderRecommendationRows(patient)}</div>
    </section>

    <section class="detail-section">
      <div class="section-title">
        <h3>Personalinteraktioner</h3>
        <span>Dra personal till patienten i 3D-vyn</span>
      </div>
      <div class="staff-interactions">${renderStaffInteractions(patient)}</div>
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
          .map(([key, value]) => `<div><span>${escapeHtml(key)}${editIcon(key)}</span><strong>${escapeHtml(value)}</strong></div>`)
          .join("")}
      </div>
    </section>
  `;

  elements.patientDetail.querySelector("#flowStatusSelect").addEventListener("change", (event) => {
    updatePatient(patient.id, (next) => ({ ...next, flowStatus: event.target.value, mapPosition: null }));
  });

  elements.patientDetail.querySelector("#editPatientButton").addEventListener("click", () => {
    openEditPatient(patient.id);
  });

  elements.patientDetail.querySelectorAll("[data-edit-field]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      openEditPatientField(patient.id, button.dataset.editField);
    });
  });

  elements.patientDetail.querySelectorAll("[data-staff-check]").forEach((button) => {
    button.addEventListener("click", () => {
      updateStaffInteraction(patient.id, button.dataset.staffCheck, button.dataset.result);
    });
  });

  elements.patientDetail.querySelector("#deletePatientButton").addEventListener("click", () => {
    deletePatient(patient.id);
  });

  elements.patientDetail.querySelector("#startTimerButton").addEventListener("click", () => {
    const category = elements.patientDetail.querySelector("#timerCategory").value;
    const label = elements.patientDetail.querySelector("#timerLabel").value.trim() || "Egen åtgärd";
    const minutes = parseNumber(elements.patientDetail.querySelector("#timerMinutes").value) || 30;
    addCustomTimer(patient.id, { category, label, minutes });
  });

  elements.patientDetail.querySelectorAll("[data-timer-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      const preset = timerPresets.find((item) => item.id === button.dataset.timerPreset);
      if (preset) addCustomTimer(patient.id, preset);
    });
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

function deletePatient(patientId) {
  const patient = state.patients.find((item) => item.id === patientId);
  if (!patient) return;

  const confirmed = window.confirm(
    `Ta bort ${patient.name} från dagens patientlista för kontot ${state.account}? Detta tar också bort figuren i 3D-vyn.`
  );

  if (!confirmed) return;

  state.patients = state.patients.filter((item) => item.id !== patientId);
  if (state.selectedPatientId === patientId) {
    state.selectedPatientId = "";
  }
  persist();
  closePatientDetail();
  render();
}

function addCustomTimer(patientId, timer) {
  const recommendation = {
    id: generateId("rec"),
    text: `${timer.category}: ${timer.label}`,
    category: timer.category,
    status: "Pågår",
    completed: false,
    dueAt: Date.now() + Math.max(1, timer.minutes) * 60000,
  };

  updatePatient(patientId, (patient) => ({
    ...patient,
    recommendations: [recommendation, ...(patient.recommendations || [])],
  }));
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

function enhanceParameterInfo() {
  elements.patientForm.querySelectorAll("input[name], textarea[name], select[name]").forEach((field) => {
    const key = field.name;
    const label = field.closest("label");
    if (!label || !parameterInfo[key] || label.querySelector(":scope > .info-dot")) return;
    label.classList.add("has-info");
    label.insertAdjacentHTML("afterbegin", infoIcon(key));
  });
}

function render() {
  state.now = Date.now();
  renderStats();
  renderLegend();
  renderStaffDock();
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
    if (!email) {
      showLoginRequired();
      elements.emailInput.focus();
      return;
    }

    state.account = email;
    loadPatients();
    render();
  });

  elements.seedButton.addEventListener("click", resetDemoData);
  elements.signOutButton.addEventListener("click", () => {
    persist();
    state.account = "";
    state.patients = [];
    state.selectedPatientId = "";
    localStorage.removeItem(ACCOUNT_KEY);
    closePatientDetail();
    render();
  });

  elements.openAddPatient.addEventListener("click", () => {
    if (!state.account) {
      showLoginRequired();
      elements.emailInput.focus();
      return;
    }

    state.editingPatientId = "";
    elements.patientForm.reset();
    fillFormFromDraft();
    elements.patientModal.showModal();
  });

  elements.closePatientModal.addEventListener("click", () => {
    state.editingPatientId = "";
    elements.patientModal.close();
  });
  elements.cancelPatient.addEventListener("click", () => {
    state.editingPatientId = "";
    elements.patientModal.close();
  });
  elements.closeDrawer.addEventListener("click", closePatientDetail);
  elements.detailDrawer.addEventListener("click", (event) => {
    if (event.target === elements.detailDrawer) closePatientDetail();
  });

  elements.hospitalMap.addEventListener("click", (event) => {
    if (
      !state.selectedPatientId ||
      event.target.closest("[data-patient-id]") ||
      event.target.closest("[data-staff-id]") ||
      event.target.closest("[data-map-staff-id]")
    ) {
      return;
    }
    const position = pointerToMapPosition(event);
    const zone = getZoneFromPosition(position);
    updatePatient(state.selectedPatientId, (patient) => ({
      ...patient,
      mapPosition: position,
      flowStatus: flowStatusFromZone(zone),
    }));
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

function showLoginRequired() {
  elements.loginGate.hidden = false;
  elements.loginGate.classList.add("needs-attention");
  window.setTimeout(() => elements.loginGate.classList.remove("needs-attention"), 900);
}

function init() {
  bindEvents();
  enhanceVoiceInputs();
  enhanceParameterInfo();
  if (state.account) loadPatients();
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
