import * as http from 'http';
import { createHandler } from './hcm.controller';

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const CHAOS_MODE = process.env.CHAOS_MODE === 'true';

const server = http.createServer(createHandler());

server.listen(PORT, () => {
  console.log(`\n🏢 Mock HCM Server running on http://localhost:${PORT}`);
  console.log(`   Chaos mode: ${CHAOS_MODE ? '⚡ ENABLED (20% 503 rate)' : '✅ disabled'}`);
  console.log(`\nEndpoints:`);
  console.log(`   GET  /hcm/balance?employeeId=&locationId=`);
  console.log(`   POST /hcm/time-off`);
  console.log(`   POST /hcm/time-off/cancel`);
  console.log(`   POST /hcm/batch`);
  console.log(`   POST /hcm/anniversary`);
  console.log(`   GET  /hcm/admin/balances  (all balances)\n`);
  console.log(`Seeded employees: EMP001 (LOC_NYC), EMP002 (LOC_LA), EMP003 (LOC_CHI)\n`);
});

server.on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\nShutting down mock HCM server...');
  server.close(() => process.exit(0));
});
