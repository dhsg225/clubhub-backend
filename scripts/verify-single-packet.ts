#!/usr/bin/env ts-node
/**
 * Verify packet_hash, input_hash, and output_hash for a single packet file.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { computePacketHash, verifyPacketHash } from '../src/pre/algorithms/sha256';
import { fnv1a32 } from '../src/pre/algorithms/fnv1a32';
import { canonicalizeJson } from '../src/pre/algorithms/canonicalize-json';

const filePath = process.argv[2] || join(__dirname, '../corpus/edge_cases/EDGE-001-v2.json');
console.log('Verifying:', filePath);

const raw = readFileSync(filePath, 'utf8');
const packet = JSON.parse(raw) as Record<string, unknown>;

const packetHashOk = verifyPacketHash(packet);
const recomputedPacketHash = computePacketHash(packet);
const computedInputHash = fnv1a32(canonicalizeJson(packet['input']));
const computedOutputHash = fnv1a32(canonicalizeJson(packet['expected_output']));

console.log('');
console.log('packet_hash stored:   ', packet['packet_hash']);
console.log('packet_hash computed: ', recomputedPacketHash);
console.log('packet_hash OK:       ', packetHashOk);
console.log('');
console.log('input_hash stored:    ', packet['input_hash']);
console.log('input_hash computed:  ', computedInputHash);
console.log('input_hash OK:        ', packet['input_hash'] === computedInputHash);
console.log('');
console.log('output_hash stored:   ', packet['output_hash']);
console.log('output_hash computed: ', computedOutputHash);
console.log('output_hash OK:       ', packet['output_hash'] === computedOutputHash);
