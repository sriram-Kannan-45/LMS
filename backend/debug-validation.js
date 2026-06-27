// Simulate exactly what aiQuizRoutes.js does for training validation
const { Training } = require('./src/models');

async function simulateHandler(reqBody) {
  const { trainingId } = reqBody;
  const resolvedTrainingId = trainingId || null;
  console.log(`Handler received trainingId="${trainingId}" (type: ${typeof trainingId}), resolvedTrainingId="${resolvedTrainingId}" (type: ${typeof resolvedTrainingId})`);

  if (resolvedTrainingId) {
    const trainingExists = await Training.findByPk(resolvedTrainingId);
    console.log(`Training.findByPk(${JSON.stringify(resolvedTrainingId)}) returned:`, trainingExists ? `found (id=${trainingExists.id}, title="${trainingExists.title}")` : 'null');

    if (!trainingExists) {
      console.log('Result: TRAINING NOT FOUND (would return 400)');
      return { found: false, message: 'Training not found' };
    }
    console.log('Result: TRAINING FOUND (validation passes)');
    return { found: true };
  }
  console.log('Result: No trainingId provided (validation skipped)');
  return { found: null, message: 'No training selected' };
}

async function main() {
  try {
    // Test 1: trainingId as string "22" (multer sends strings)
    console.log('\n=== Test 1: trainingId="22" (string) ===');
    let result = await simulateHandler({ trainingId: '22' });

    // Test 2: trainingId as empty string (No Training option)
    console.log('\n=== Test 2: trainingId="" (empty string) ===');
    result = await simulateHandler({ trainingId: '' });

    // Test 3: trainingId as number 22 (in case it's not converted to string)
    console.log('\n=== Test 3: trainingId=22 (number) ===');
    result = await simulateHandler({ trainingId: 22 });

    // Test 4: trainingId as undefined (not sent at all)
    console.log('\n=== Test 4: no trainingId ===');
    result = await simulateHandler({});

    // Test 5: trainingId as "undefined" (string from a buggy frontend)
    console.log('\n=== Test 5: trainingId="undefined" (string) ===');
    result = await simulateHandler({ trainingId: 'undefined' });

    // Test 6: trainingId as "null" (string from a buggy frontend)
    console.log('\n=== Test 6: trainingId="null" (string) ===');
    result = await simulateHandler({ trainingId: 'null' });

    process.exit(0);
  } catch (e) {
    console.error('Fatal:', e.stack);
    process.exit(1);
  }
}

main();
