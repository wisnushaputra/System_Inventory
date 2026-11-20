import { parseCidr, validateHostIp, ipToInt, intToIp } from '../src/lib/ipam';
import assert from 'node:assert';

console.log('--- Testing IPAM Utility ---');

// 1. CIDR 192.168.10.0/24
const c24 = parseCidr('192.168.10.0/24');
assert.strictEqual(c24.networkAddress, '192.168.10.0');
assert.strictEqual(c24.broadcastAddress, '192.168.10.255');
assert.strictEqual(c24.netmask, '255.255.255.0');
assert.strictEqual(c24.totalAddresses, 256);
assert.strictEqual(c24.usableHosts, 254);
assert.strictEqual(c24.firstUsableIp, '192.168.10.1');
assert.strictEqual(c24.lastUsableIp, '192.168.10.254');
console.log('✓ parseCidr /24 passed');

// 2. Reject network address
const netCheck = validateHostIp('192.168.10.0', '192.168.10.0/24');
assert.strictEqual(netCheck.valid, false);
assert.ok(netCheck.error?.includes('Network Address'), `Expected Network Address error, got: ${netCheck.error}`);
console.log('✓ Network IP rejection passed');

// 3. Reject broadcast address
const bcastCheck = validateHostIp('192.168.10.255', '192.168.10.0/24');
assert.strictEqual(bcastCheck.valid, false);
assert.ok(bcastCheck.error?.includes('Broadcast Address'), `Expected Broadcast Address error, got: ${bcastCheck.error}`);
console.log('✓ Broadcast IP rejection passed');

// 4. Accept valid host
const validHostCheck = validateHostIp('192.168.10.50', '192.168.10.0/24');
assert.strictEqual(validHostCheck.valid, true);
console.log('✓ Valid host IP accepted passed');

// 5. Reject IP outside subnet
const outsideCheck = validateHostIp('192.168.11.1', '192.168.10.0/24');
assert.strictEqual(outsideCheck.valid, false);
assert.ok(outsideCheck.error?.includes('di luar rentang subnet'), `Expected outside subnet error, got: ${outsideCheck.error}`);
console.log('✓ Outside subnet IP rejection passed');

// 6. Test /30 subnet (e.g. 10.0.0.0/30 -> 10.0.0.0 net, 10.0.0.1 & 10.0.0.2 usable, 10.0.0.3 bcast)
const c30 = parseCidr('10.0.0.0/30');
assert.strictEqual(c30.usableHosts, 2);
assert.strictEqual(validateHostIp('10.0.0.0', '10.0.0.0/30').valid, false);
assert.strictEqual(validateHostIp('10.0.0.1', '10.0.0.0/30').valid, true);
assert.strictEqual(validateHostIp('10.0.0.2', '10.0.0.0/30').valid, true);
assert.strictEqual(validateHostIp('10.0.0.3', '10.0.0.0/30').valid, false);
console.log('✓ /30 subnet verification passed');

console.log('--- ALL IPAM TESTS PASSED ---');
