const http = require('http');
function req(method, path, body, token) {
  return new Promise((resolve) => {
    const url = new URL(path, 'http://localhost:3001');
    const opts = {
      hostname: url.hostname, port: url.port,
      path: url.pathname + url.search, method,
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    };
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    const r = http.request(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, body: d }); }
      });
    });
    r.on('error', e => resolve({ status: 0, body: e.message }));
    r.on('timeout', () => { r.destroy(); resolve({ status: 0, body: 'timeout' }); });
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

let A='', T='', P='';
let programId, courseId, lessonId, quizId;

async function check(step, fn) {
  const r = await fn();
  const pass = r.status >= 200 && r.status < 300;
  console.log(`  ${pass?'✅':'❌'} ${step} → ${r.status}${!pass?'  '+(typeof r.body==='string'?r.body.slice(0,200):JSON.stringify(r.body).slice(0,200)):''}`);
  return r;
}

(async () => {
  console.log('\n═══════════════════════════════════════');
  console.log('   BACKEND WORKFLOW TESTS');
  console.log('═══════════════════════════════════════\n');

  // ─── 1. AUTH ───
  console.log('── 1. AUTH ──');
  let r;

  r = await check('Health', () => req('GET', '/health'));

  r = await check('Admin login', () => req('POST', '/api/auth/login', { email:'admin@test.com', password:'admin123' }));
  if (r.status === 200) A = r.body.token;

  // Approve existing participant or create then approve
  r = await check('List pending participants', () => req('GET', '/api/admin/participants?status=PENDING', null, A));
  let pId;
  if (r.status === 200 && r.body?.participants?.length) {
    pId = r.body.participants[0].id;
    r = await check('Approve participant', () => req('POST', `/api/admin/approve-participant/${pId}`, null, A));
  }

  r = await check('Participant login', () => req('POST', '/api/auth/login', { email:'participant@test.com', password:'Part123!' }));
  if (r.status === 200) P = r.body.token;

  r = await check('Trainer login', () => req('POST', '/api/auth/login', { email:'trainer@test.com', password:'Trainer123!' }));
  if (r.status === 200) T = r.body.token;

  // ─── 2. ADMIN ───
  console.log('\n── 2. ADMIN ──');
  r = await check('List trainers', () => req('GET', '/api/admin/trainers', null, A));
  r = await check('List participants', () => req('GET', '/api/admin/participants', null, A));

  r = await check('Create program', () => req('POST', '/api/admin/training-programs',
    { title:'Full Stack Program', description:'Test' }, A));
  if (r.status === 201) programId = r.body?.program?.id;

  if (T) await check('Create trainer profile', () => req('POST', '/api/profile/trainer/profile',
    { phone:'9999999999', qualification:'M.Tech', experience:'5 years' }, T));

  r = await check('Create course', () => req('POST', '/api/trainer/courses',
    { trainingProgramId: programId, title:'React Mastery', description:'Test', status:'PUBLISHED' }, T));
  if (r.status === 201) courseId = r.body?.course?.id || r.body?.data?.id;
  if (courseId) console.log(`     Course ID: ${courseId}`);

  // ─── 3. TRAINER ───
  console.log('\n── 3. TRAINER ──');
  r = await check('List courses', () => req('GET', '/api/trainer/courses', null, T));

  r = await check('Create lesson', () => req('POST', `/api/trainer/courses/${courseId}/lessons`,
    { title:'Intro to React', description:'Learn basics', content:'React is a JS library.', orderIndex:1 }, T));
  if (r.status === 201) lessonId = r.body?.id || r.body?.data?.id;

  if (lessonId) {
    await check('Create material', () => req('POST', `/api/trainer/lessons/${lessonId}/materials`,
      { title:'React Overview', materialType:'NOTE', content:'React uses virtual DOM.', orderIndex:1 }, T));
    await check('List materials', () => req('GET', `/api/trainer/lessons/${lessonId}/materials`, null, T));

    r = await check('Create quiz', () => req('POST', `/api/trainer/courses/${courseId}/quiz/manual`,
      { title:'React Quiz', description:'Test', timeLimit:15,
        questions:[{ questionText:'What is React?', questionType:'MCQ', options:['Library','Framework'], correctAnswer:'Library', difficulty:'EASY', order:1 }]
      }, T));
    if (r.status === 201) quizId = r.body?.id || r.body?.data?.id;

    if (quizId) {
      await check('Publish quiz', () => req('PUT', `/api/trainer/courses/${courseId}/quizzes/${quizId}/publish`, null, T));
      await check('Attach quiz', () => req('POST', `/api/lessons/${lessonId}/quizzes`, { quizId, isMandatory:true }, T));
    }

    await check('Lesson dashboard', () => req('GET', `/api/lessons/${lessonId}/dashboard`, null, T));
  }

  await check('Course participants', () => req('GET', `/api/trainer/courses/${courseId}/participants`, null, T));
  await check('Course analytics', () => req('GET', `/api/trainer/courses/${courseId}/analytics`, null, T));

  // ─── 4. PARTICIPANT ───
  console.log('\n── 4. PARTICIPANT ──');
  if (P) {
    // Enroll in training (creates ENROLLED for training-level features like feedback)
    await check('Enroll in training', () => req('POST', '/api/participant/enroll', { trainingId:programId }, P));
    // Enroll in course (creates PENDING course enrollment, needs trainer approval for course-level features)
    await check('Enroll in course', () => req('POST', '/api/participant/enroll', { courseId }, P));
    // Get participant ID from JWT (decode payload) or from admin list
    // JWT payload is base64url at index 1
    let pId = null;
    try {
      const b64 = P.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
      const payload = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
      pId = payload.id;
    } catch(e) { pId = null; }
    if (!pId) {
      const parts = await req('GET', '/api/admin/participants', null, A);
      if (parts.body?.participants?.length) pId = parts.body.participants[0].id;
    }
    if (pId) await check('Approve course enrollment', () => req('PUT', `/api/trainer/courses/${courseId}/participants/${pId}/approve`, null, T));
    else console.log('  ⚠️  Could not get participant ID to approve enrollment');

    await check('Explore courses', () => req('GET', '/api/participant/courses/explore', null, P));
    await check('My courses', () => req('GET', '/api/participant/courses', null, P));
    await check('Course overview', () => req('GET', `/api/participant/courses/${courseId}`, null, P));
    await check('Course lessons', () => req('GET', `/api/participant/courses/${courseId}/lessons`, null, P));
    if (lessonId) await check('View lesson', () => req('POST', `/api/participant/lessons/${lessonId}/view`, null, P));

    await check('Activity feed', () => req('GET', '/api/feed', null, P));
    await check('Notifications', () => req('GET', '/api/notifications', null, P));
    await check('Unread count', () => req('GET', '/api/notifications/unread/count', null, P));
    await check('Submit feedback', () => req('POST', '/api/feedback',
      { trainingId:programId, trainerRating:5, subjectRating:4, comments:'Great!', anonymous:false }, P));
  } else {
    console.log('  ⚠️  Skipping participant tests (no token)');
  }

  // ─── 5. OTHER ───
  console.log('\n── 5. OTHER ──');
  await check('Survey questions', () => req('GET', '/api/survey', null, A));
  await check('Trainer profile', () => req('GET', '/api/profile/trainer/profile', null, T));
  await check('AI health', () => req('GET', '/api/ai/health'));

  console.log('\n═══════════════════════════════════════');
  console.log('   TESTS COMPLETE');
  console.log('═══════════════════════════════════════\n');
})();
