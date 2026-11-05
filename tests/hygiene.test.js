const test = require('node:test');
const assert = require('node:assert');
const { execSync } = require('node:child_process');

test('hygiene: BUILD_TOKEN and local artifacts are not tracked', () => {
  const tracked = execSync('git ls-files', { encoding: 'utf8' }).split('\n');
  const forbidden = [
    'BUILD_TOKEN',
    'Run',
    'In a separate terminal window, test if port 20128 responds',
    'booking.zip',
    'handoff-source.zip',
  ];
  for (const f of forbidden) {
    assert.strictEqual(tracked.includes(f), false, `${f} should not be tracked`);
  }
  const netlifyFiles = tracked.filter(f => f.startsWith('.netlify/'));
  assert.strictEqual(netlifyFiles.length, 0, '.netlify/ files should not be tracked');
});
