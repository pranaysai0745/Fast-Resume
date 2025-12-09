// server.js — FastResume backend using Groq (Llama 3)

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path'); // ⬅️ for static HTML routes

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

/**
 * Call Groq and get a strict JSON resume back
 */
async function callGroq(text, experienceLevel) {
  const levelText =
    experienceLevel === 'fresher'
      ? 'fresher / student'
      : experienceLevel === 'junior'
      ? 'junior engineer (0–2 years)'
      : 'experienced engineer (2+ years)';

  const styleBlock =
    experienceLevel === 'fresher'
      ? `
- Prioritise education, academic projects, personal projects and internships.
- For "summary", write 3–4 lines max, focused on skills, technologies and what they are looking for.
- For "projects", give 2–4 bullets. Each bullet must start with a strong verb and mention tech stack.
  Example bullet: "• Built a responsive portfolio website using HTML, CSS, JS and deployed it on Render, improving load time by 30%."
- For "experience", keep it short (internships / part-time) and turn vague sentences into concrete bullet points.
- If they only have projects but no jobs, keep "experience" very small or empty.
`
      : `
- Prioritise professional experience: companies, job titles, impact and technologies.
- For "summary", write 3–4 lines max, focused on years of experience, main tech stack, and key strengths.
- For "experience", produce strong bullet points that show impact, metrics, and tools.
  Example bullet: "• Reduced API latency by 35% by refactoring Node.js services and optimising PostgreSQL queries."
- For "projects", only include 1–3 important projects, focused on real impact or impressive tech.
- Only include education details that matter (degree, college, year).
`;

  const userPrompt = `
You are an ATS-optimised resume generator for a ${levelText} candidate.

The user will give you a single block of text describing:
- education
- skills
- projects
- internships / work experience
- certifications
- achievements
- languages
- interests

Your job is to clean this information and return a JSON resume with short, professional English.

========== OUTPUT FORMAT (STRICT) ==========

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

Rules for ALL fields:
- Always return ALL keys above (never remove or rename any key).
- If the user does not mention a field, return an empty string "" for that field.
- Do NOT invent fake degrees, companies, durations, or numbers.
- You may gently clean grammar, shorten sentences, and make bullets more professional.
- Use plain text only. No markdown. Use "•" for bullets and newline characters between bullets.
- Keep content concise and ATS-friendly (no long paragraphs).

Extra style rules based on candidate level:
${styleBlock}

========== CANDIDATE TEXT ==========
${text}
====================================

Now return ONLY the JSON object. No explanation, no backticks.
`.trim();

  const body = {
    model: MODEL,
    temperature: 0.25,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You are an expert ATS-friendly resume builder. You ALWAYS return a single valid JSON object that exactly matches the requested schema.'
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

/**
 * Clean sections like "N/A" etc.
 */
function cleanSection(str) {
  const s = String(str || '').trim();
  if (!s) return '';
  const lower = s.toLowerCase();
  if (['n/a', 'na', 'none', 'nil', 'no'].includes(lower)) return '';
  return s;
}

/**
 * POST /api/build — main endpoint used by frontend
 */
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

/**
 * Static page routes
 */

// Home page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Builder page
app.get('/builder', (req, res) => {
  res.sendFile(path.join(__dirname, 'builder.html'));
});

// About page
app.get('/about', (req, res) => {
  res.sendFile(path.join(__dirname, 'about.html'));
});

// Privacy Policy page
app.get('/privacy', (req, res) => {
  res.sendFile(path.join(__dirname, 'privacy.html'));
});

// Contact page
app.get('/contact', (req, res) => {
  res.sendFile(path.join(__dirname, 'contact.html'));
});

/**
 * Start server
 */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ FastResume running at http://localhost:${PORT}`);
  console.log(`   Using Groq model: ${MODEL}`);
});
