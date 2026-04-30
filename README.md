# Emergency Ward AI

En fungerande prototyp för akutflöde och patientmonitorering med:

- login/konto via e-post i lokal prototyplagring
- dagvis patientlista med 5 demo-patienter
- NEWS2-beräkning
- riskklassning grön/gul/orange/röd
- preliminärt kliniskt beslutsstöd med differentialdiagnoser
- rekommendationschecklistor och timers
- CSS-baserad top-down/3D sjukhusvy med akut-, monitorerings-, närakut- och hemgångszon
- patientkort, detaljpanel och formulär för nya patienter
- autospar av patientdata per e-postkonto och datum
- autosparat formulärutkast om sidan stängs mitt i registrering
- mikrofonknapp vid formulärfält för svensk röstinmatning via webbläsarens Web Speech API

## Kör lokalt

```powershell
npm start
```

Öppna sedan:

```text
http://localhost:3000
```

## Viktigt

Det här är en prototyp. Den ger beslutsstöd, inte definitiva diagnoser, och ersätter inte kliniskt omdöme. Använd inte riktiga personnummer eller riktiga patientuppgifter i prototypen.

Patientdata sparas i webbläsarens `localStorage` per konto och datum. Ingen extern databas eller molntjänst är kopplad, eftersom sådana tjänster kan innebära kostnad och ska godkännas först.

Röstinmatning kräver en webbläsare som stödjer `SpeechRecognition`, till exempel Chrome eller Edge. Mikrofonbehörighet ges i webbläsaren när du trycker på mikrofonknappen.
