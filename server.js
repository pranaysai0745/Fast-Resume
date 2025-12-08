// server.js — FastResume backend using Groq (Improved Prompt)

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const API_KEY = process.env.GROQ_API_KEY;
if (!API_KEY) {
  console.error('❌ GROQ_API_KEY missing');
  process.exit(1);
}

const MODEL = 'llama-3.3-70b-versatile';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

/* =======================
   GROQ CALL
======================= */
async function callGroq(text, experienceLevel) {
  const levelGuide =
    experienceLevel === 'fresher'
      ? `
You are generating a resume for a COLLEGE STUDENT / FRESHER.
Focus on:
- Education
- Technical skills
- Academic & personal projects
- Internships
- Learning mindset
`
      : experienceLevel === 'junior'
      ? `
You are generating a resume for a JUNIOR ENGINEER (0–2 years).
Focus on:
- Practical experience
- Internships / entry-level work
- Projects with real impact
`
      : `
You are generating a resume for an EXPERIENCED ENGINEER (2+ years).
Focus on:
- Professional experience FIRST
- Measurable impact
- Tools, scale, leadership
`;

  const prompt = `
You are an EXPERT ATS-FRIENDLY RESUME WRITER.

${levelGuide}

The input is ONE PARAGRAPH written by the candidate.

Your task:
- Extract relevant information
- Rewrite it into strong, professional resume sections
- Use ATS-friendly language
- Use bullet points
- Be concise and impactful

IMPORTANT RULES:
• DO NOT invent companies, degrees, or fake details
• DO NOT add filler or buzzwords
• DO NOT mention "N/A"
• If not provided → return empty string ""
• Use action verbs (Built, Designed, Implemented, Developed, Optimized)
• Keep bullets short (1 line each)

------ FORMAT RULES ------

SUMMARY:
• 2–3 lines max
• Role-focused
• Skills + goal

EDUCATION:
• Degree – Institution – Year
• One clean block

EXPERIENCE:
• Company / Role
• 2–4 bullets max
• Impact-driven

PROJECTS:
For each project:
Project Name — Tech Stack
• What was built
• Key features / logic
• Outcome / learning

SKILLS:
Categorize properly.

LANGUAGES:
Comma-separated.

CERTIFICATIONS:
One per line.

--------------------------------

Return ONLY valid JSON with EXACT keys below:

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

CANDIDATE INPUT:
"""${text}"""
`;

  const body = {
    model: MODEL,
    temperature: 0.15,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You are a strict ATS resume generator. You ONLY output valid JSON.'
      },
      { role: 'user', content: prompt }
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
    throw new Error(await resp.text());
  }

  const data = await resp.json();
  const textOut = data?.choices?.[0]?.message?.content;
  if (!textOut) throw new Error('Empty Groq response');

  return JSON.parse(textOut);
}

/* =======================
   CLEANER
======================= */
function cleanSection(str) {
  const s = String(str || '').trim();
  if (!s) return '';
  if (['n/a','na','none','nil','no'].includes(s.toLowerCase())) return '';
  return s;
}

/* =======================
   API ROUTE
======================= */
app.post('/api/build', async (req, res) => {
  try {
    const { text, experienceLevel } = req.body;
    if (!text) return res.status(400).json({ error: 'No input text' });

    const raw = await callGroq(text, experienceLevel || 'fresher');

    const safe = {};
    for (const key in raw) {
      safe[key] = cleanSection(raw[key]);
    }

    res.json(safe);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/* =======================
   START
======================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ FastResume running at http://localhost:${PORT}`);
});
