// server.js — FastResume backend using Groq (Llama 3)

require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Node 18+ has fetch built-in
// If Node < 18, install node-fetch and uncomment:
// const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // serve index.html + assets

// ======================
// ENV + GROQ CONFIG
// ======================
const API_KEY = process.env.GROQ_API_KEY;
if (!API_KEY) {
  console.error('❌ GROQ_API_KEY missing in environment');
  process.exit(1);
}

const MODEL = 'llama-3.3-70b-versatile';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// ======================
// GROQ CALL
// ======================
async function callGroq(text, experienceLevel) {
  const level = experienceLevel || 'fresher';

  const levelDescription =
    level === 'fresher'
      ? 'a student / fresher with 0 years of full-time experience'
      : level === 'junior'
      ? 'a junior engineer with 0–2 years of professional experience'
      : 'an experienced engineer with 2+ years of professional experience';

  const levelRules =
    level === 'fresher'
      ? `
Fresher rules:
- Do NOT invent internships, jobs, companies, or job titles.
- If no real work experience exists, set "experience": "".
- Emphasise EDUCATION, PROJECTS, and SKILLS.
`
      : `
Experienced rules:
- Use experience ONLY if explicitly mentioned.
- Group roles by company.
- Focus on responsibilities, technologies, and measurable impact.
- Do NOT invent dates, metrics, or companies.
`;

  const userPrompt = `
You are an ATS-optimised resume generator.

Candidate profile:
- ${levelDescription}

TASK:
- Read the user text carefully.
- Extract ONLY real information stated or clearly implied.
- Rephrase into clean, professional resume wording.
- Output ONE valid JSON object ONLY.

JSON SCHEMA (ALL keys must exist):

{
  "name": "",
  "email": "",
  "phone": "",
  "location": "",
  "headline": "",
  "summary": "",
  "education": "",
  "experience": "",
  "projects": "",
  "skillsProgramming": "",
  "skillsFrontend": "",
  "skillsDatabase": "",
  "skillsOther": "",
  "skillsSoft": "",
  "languages": "",
  "certifications": "",
  "interests": ""
}

GLOBAL RULES:
- Resume tone only (not first-person).
- If data is missing, return "" (empty string).
- NEVER invent companies, dates, roles, degrees, or achievements.
- Use bullet formatting with "•" and line breaks for projects & experience.
- Skills fields should be comma-separated.
- Summary = 2–4 concise lines.
- Headline examples: "CS Student", "Frontend Developer", "Software Engineer".

${levelRules}

USER TEXT:
"""${text}"""
`.trim();

  const body = {
    model: MODEL,
    temperature: 0.25,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You are a strict ATS resume engine. Respond ONLY with a valid JSON object matching the exact schema.'
      },
      {
        role: 'user',
        content: userPrompt
      }
    ]
  };

  const resp = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Groq HTTP ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty Groq response');

  try {
    return JSON.parse(content);
  } catch (e) {
    console.error('❌ Non-JSON Groq output:', content);
    throw new Error('Groq returned invalid JSON');
  }
}

// ======================
// CLEANER
// ======================
function cleanSection(str) {
  const s = String(str || '').trim();
  if (!s) return '';
  if (['na', 'n/a', 'none', 'nil'].includes(s.toLowerCase())) return '';
  return s;
}

// ======================
// API ENDPOINT
// ======================
app.post('/api/build', async (req, res) => {
  try {
    const { text, experienceLevel } = req.body || {};

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'No text provided' });
    }

    const raw = await callGroq(text, experienceLevel);

    const safe = {
      name: cleanSection(raw.name),
      email: cleanSection(raw.email),
      phone: cleanSection(raw.phone),
      location: cleanSection(raw.location),
      headline: cleanSection(raw.headline),
      summary: cleanSection(raw.summary),
      education: cleanSection(raw.education),
      experience: cleanSection(raw.experience),
      projects: cleanSection(raw.projects),
      skillsProgramming: cleanSection(raw.skillsProgramming),
      skillsFrontend: cleanSection(raw.skillsFrontend),
      skillsDatabase: cleanSection(raw.skillsDatabase),
      skillsOther: cleanSection(raw.skillsOther),
      skillsSoft: cleanSection(raw.skillsSoft),
      languages: cleanSection(raw.languages),
      certifications: cleanSection(raw.certifications),
      interests: cleanSection(raw.interests)
    };

    res.json(safe);
  } catch (err) {
    console.error('❌ /api/build error:', err);
    res.status(500).json({ error: err.message || 'Resume build failed' });
  }
});

// ======================
// START SERVER
// ======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ FastResume running at http://localhost:${PORT}`);
  console.log(`✅ Groq model: ${MODEL}`);
});
