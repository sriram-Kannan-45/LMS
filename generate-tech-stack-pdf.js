// Generate TECH_STACK.pdf from the project's technology summary.
// Uses the pdfkit module already installed in node_modules.
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'TECH_STACK.pdf');
const doc = new PDFDocument({ size: 'A4', margin: 56, info: {
    Title: 'feedWeb — Technology Stack',
    Author: 'feedWeb project',
    Subject: 'Technology stack summary'
}});
doc.pipe(fs.createWriteStream(OUT));

// ---------- helpers ----------
const COLORS = {
    primary: '#1f4e79',
    accent:  '#2e7d32',
    sub:     '#4a4a4a',
    muted:   '#6b6b6b',
    rule:    '#cccccc',
};

function h1(text) {
    doc.moveDown(0.4);
    doc.fillColor(COLORS.primary).font('Helvetica-Bold').fontSize(22).text(text);
    const y = doc.y + 2;
    doc.moveTo(doc.page.margins.left, y)
       .lineTo(doc.page.width - doc.page.margins.right, y)
       .lineWidth(1).strokeColor(COLORS.primary).stroke();
    doc.moveDown(0.6);
}
function h2(text) {
    doc.moveDown(0.6);
    doc.fillColor(COLORS.accent).font('Helvetica-Bold').fontSize(14).text(text);
    doc.moveDown(0.2);
}
function p(text) {
    doc.fillColor(COLORS.sub).font('Helvetica').fontSize(10.5).text(text, { align: 'left' });
    doc.moveDown(0.25);
}
function bullets(items) {
    doc.fillColor(COLORS.sub).font('Helvetica').fontSize(10.5);
    items.forEach(it => {
        const [name, desc] = Array.isArray(it) ? it : [it, null];
        const bulletX = doc.page.margins.left;
        const textX   = bulletX + 14;
        const y       = doc.y;
        doc.circle(bulletX + 3, y + 5, 1.6).fillColor(COLORS.accent).fill();
        doc.fillColor(COLORS.sub).font('Helvetica-Bold').text(name, textX, y, { continued: !!desc, lineGap: 2 });
        if (desc) doc.font('Helvetica').fillColor(COLORS.sub).text(' — ' + desc);
    });
    doc.moveDown(0.3);
}
function code(text) {
    doc.font('Courier').fontSize(9.5).fillColor('#222').text(text, {
        indent: 8, lineGap: 1
    });
    doc.moveDown(0.4);
}
function note(text) {
    const x = doc.page.margins.left;
    const startY = doc.y;
    doc.font('Helvetica-Oblique').fontSize(10).fillColor(COLORS.muted)
       .text(text, x + 10, startY, { width: doc.page.width - x*2 - 10 });
    const endY = doc.y;
    doc.moveTo(x, startY - 2).lineTo(x, endY + 2)
       .lineWidth(2).strokeColor(COLORS.accent).stroke();
    doc.moveDown(0.5);
}

// ---------- Page 1: Title ----------
doc.fillColor(COLORS.primary).font('Helvetica-Bold').fontSize(28)
   .text('feedWeb — Technology Stack', { align: 'left' });
doc.moveDown(0.2);
doc.fillColor(COLORS.muted).font('Helvetica').fontSize(11)
   .text('Learning Management System with AI-powered quiz generation', { align: 'left' });
doc.moveDown(0.2);
doc.fillColor(COLORS.muted).fontSize(9.5)
   .text('Generated: ' + new Date().toLocaleString(), { align: 'left' });
doc.moveDown(1.0);

h2('Project Layout');
code(
`feedWeb/
├── frontend/      -> React SPA           (port 5173 dev)
├── backend/       -> Node.js REST API    (port 3001)
└── ai-service/    -> Python FastAPI      (port 8000)
`);
p('Frontend talks to the backend; the backend calls the AI microservice via AI_SERVICE_URL=http://localhost:8000.');

// ---------- Frontend ----------
h1('Frontend');
p('Path: frontend/  ·  Build tool: Vite 5  ·  Language: JavaScript (JSX)');
h2('Core');
bullets([
    ['React 18.2', 'UI framework'],
    ['Vite 5', 'Dev server and bundler'],
    ['Tailwind CSS 4', 'Utility-first styling (@tailwindcss/vite)'],
    ['React Router 6', 'Client-side routing'],
]);
h2('Networking & Real-time');
bullets([
    ['Axios', 'HTTP client to backend REST API'],
    ['Socket.IO Client 4.7', 'Real-time events / live updates'],
]);
h2('UX / Visualisation');
bullets([
    ['Framer Motion 12', 'Animations / transitions'],
    ['Lucide React', 'Icon set'],
    ['Tiptap (ProseMirror)', 'Rich-text WYSIWYG editor'],
    ['Chart.js + react-chartjs-2', 'Charts and dashboards'],
    ['Recharts 2', 'Additional charting'],
    ['react-hot-toast', 'Toast notifications'],
]);

// ---------- Backend ----------
doc.addPage();
h1('Backend');
p('Path: backend/  ·  Entry: src/app.js  ·  Runtime: Node.js + Express 4');
h2('Web & Real-time');
bullets([
    ['Express 4', 'REST API framework'],
    ['Socket.IO 4.7', 'WebSocket server'],
    ['@socket.io/redis-adapter', 'Horizontal scaling for Socket.IO'],
    ['Redis 4.6', 'Pub/sub backplane'],
    ['CORS', 'Cross-origin support'],
]);
h2('Database & ORM');
bullets([
    ['MySQL', 'Relational DB (training_db)'],
    ['mysql2', 'Native driver'],
    ['Sequelize 6', 'ORM, models, migrations'],
]);
h2('Auth & Validation');
bullets([
    ['JSON Web Tokens (jsonwebtoken)', 'Stateless authentication'],
    ['bcryptjs', 'Password hashing'],
    ['express-validator', 'Request validation'],
]);
h2('File Uploads & Documents');
bullets([
    ['Multer 2', 'Multipart upload middleware'],
    ['multer-storage-cloudinary + Cloudinary', 'Media CDN storage'],
    ['pdf-parse', 'Extract text from PDF uploads'],
    ['Mammoth', 'Extract text from DOCX uploads'],
]);
h2('Email / OTP');
bullets([
    ['Nodemailer (Gmail SMTP)', 'Transactional email and OTP delivery'],
]);
h2('AI Integration');
bullets([
    ['Axios', 'Calls the Python AI microservice'],
    ['OpenAI SDK', 'Optional direct LLM integration (currently placeholder key)'],
]);
h2('Operations');
bullets([
    ['Winston', 'Structured logging'],
    ['dotenv', 'Configuration loading'],
    ['Nodemon, Jest, Supertest, kill-port', 'Dev / testing tooling'],
]);
p('Layout: src/{routes, controllers, models, middleware, services, socket, jobs, helpers} + database/migrations/.');

// ---------- AI Service ----------
doc.addPage();
h1('AI Service');
p('Path: ai-service/  ·  Entry: main.py  ·  Runtime: Python 3.12 + FastAPI');
h2('Web Layer');
bullets([
    ['FastAPI 0.115', 'REST API: /generate-quiz, /evaluate, /health'],
    ['Uvicorn 0.34', 'ASGI server (port 8000)'],
    ['Pydantic 2', 'Request/response validation'],
    ['python-multipart', 'File-upload support'],
]);
h2('LLM Stack');
bullets([
    ['Google Gemini API', 'Primary LLM — gemini-2.5-flash with JSON mode'],
    ['langchain-google-genai', 'LangChain integration for Gemini'],
    ['Groq (llama-3.3-70b-versatile)', 'Fallback LLM via langchain-openai'],
    ['LangChain core + text-splitters', 'Prompt templates, chunked retrieval'],
]);
h2('Document Parsing & Robustness');
bullets([
    ['PyPDF2', 'PDF text extraction'],
    ['python-docx', 'DOCX text extraction'],
    ['json-repair', 'Auto-repair malformed LLM JSON output'],
    ['python-dotenv', 'Configuration loading'],
]);
note('The quiz generator uses Bloom\'s Taxonomy-aware prompts, in-memory caching with content-hash keys, and a 3-tier JSON parser (strict -> json-repair -> per-object brace extraction) for resilient output handling.');

// ---------- Infrastructure ----------
h1('Infrastructure & Tooling');
bullets([
    ['MySQL', 'Primary relational database'],
    ['Redis', 'Pub/sub for Socket.IO scaling, optional caching'],
    ['Cloudinary', 'Media CDN / file storage (CLOUD_NAME=dm9wlkpgc)'],
    ['Gmail SMTP', 'Transactional email provider'],
    ['Google Gemini API', 'AI quiz generation backend'],
    ['Git', 'Version control'],
    ['start-all.bat / start-all.ps1', 'Dev orchestration scripts (Windows)'],
    ['start-ai-service.bat', 'Standalone AI service launcher'],
]);

// ---------- Domain ----------
h1('Application Domain');
p('feedWeb is a Learning Management System / Training platform. Workflow files in the repo (QUIZ_WORKFLOW.txt, TRAINER_ADMIN_WORKFLOW.txt, CURRENT_WORKFLOW.txt) describe the following capabilities:');
bullets([
    ['AI quiz generation', 'Upload course material (PDF/DOCX/TXT) and generate MCQs via Gemini'],
    ['Role-based access', 'Trainer / Admin / Trainee'],
    ['Real-time collaboration', 'Socket.IO-driven live updates'],
    ['Online proctoring', 'frontend/src/proctoring/ module'],
    ['Course materials & feedback', 'Materials upload, trainee feedback collection'],
    ['Analytics dashboards', 'Chart.js / Recharts visualisations'],
]);

// ---------- Footer / Security note ----------
doc.addPage();
h1('Security Notes');
p('A few items observed during the tech-stack review that are worth addressing:');
bullets([
    ['backend/.env contains live secrets', 'DB password, JWT secret, Cloudinary API secret, Gmail app password, Groq API key — all in plaintext.'],
    ['Verify .gitignore', 'Ensure backend/.env, ai-service/.env, and frontend/.env are git-ignored.'],
    ['Rotate any shared keys', 'API keys that have been pasted in chat or committed to Git should be regenerated.'],
    ['JWT_SECRET placeholder', 'The default value contains the literal phrase "change-in-production" — update before any deployment.'],
]);
note('None of these are functional bugs — the project runs fine — but they should be tightened before any non-local deployment.');

doc.end();
console.log('Wrote ' + OUT);
