// server.js — FastResume backend using Groq (Llama 3)

require('dotenv').config();
const express = require('express');
const cors = require('cors');

// If your Node version < 18, uncomment and install node-fetch
// const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // serve index.html + assets

const API_KEY = process.env.GROQ_API_KEY;
if (!API_KEY) {
  console.error('❌ GROQ_API_KEY missing in .env file');
  process.exit(1);
}

// current Groq model
const MODEL = 'llama-3.3-70b-versatile';   // or 'llama3-70b-8192'
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

async function callGroq(text, experienceLevel) {
  const levelText =
    experienceLevel === 'fresher'
      ? 'fresher / student'
      : experienceLevel === 'junior'
      ? 'junior engineer (0–2 years)'
      : 'experienced engineer (2+ years)';

  const userPrompt = `
You are an ATS resume generator for ${levelText}.

The user gives one paragraph describing:
- education
- skills
- projects
- internships / work experience
- certifications
- achievements
- languages
- interests

Return a CLEAN JSON object with these EXACT keys (lowerCamelCase):

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

Rules:
- Use short, professional English in resume style.
- If something is not provided, use an empty string "".
- Do NOT invent fake companies or degrees, but you may lightly rewrite / clean sentences.
- For projects, combine all projects into one text block with bullets.
- For experience, combine all internships / jobs.

Student text:
"""${text}"""
`.trim();

  const body = {
    model: MODEL,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You are an expert ATS-friendly resume builder that returns ONLY valid JSON objects.'
      },
      { role: 'user', content: userPrompt }
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
    const errText = await resp.text();
    throw new Error(`Groq HTTP ${resp.status}: ${errText}`);
  }

  const data = await resp.json();
  const textOut = data?.choices?.[0]?.message?.content;
  if (!textOut) throw new Error('Empty response from Groq');

  let parsed;
  try {
    parsed = JSON.parse(textOut);
  } catch (e) {
    console.error('Groq raw content was not JSON:', textOut);
    throw new Error('Groq returned non-JSON: ' + e.message);
  }
  return parsed;
}

function cleanSection(str) {
  const s = String(str || '').trim();
  if (!s) return '';
  const lower = s.toLowerCase();
  if (['n/a', 'na', 'none', 'nil', 'no'].includes(lower)) return '';
  return s;
}

app.post('/api/build', async (req, res) => {
  try {
    const { text, experienceLevel } = req.body || {};
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'No text provided' });
    }

    const level = experienceLevel || 'fresher';
    const raw = await callGroq(text, level);

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ FastResume running at http://localhost:${PORT}`);
  console.log(`   Using Groq model: ${MODEL}`);
});
