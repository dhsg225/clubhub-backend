#!/usr/bin/env ts-node
/**
 * Recompute packet_hash for the retired EDGE-001 fixture after metadata updates.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { computePacketHash } from '../src/pre/algorithms/sha256';

const filePath = join(__dirname, '../corpus/edge_cases/EDGE-001.json');
const raw = readFileSync(filePath, 'utf8');
const packet = JSON.parse(raw) as Record<string, unknown>;

// Remove packet_hash so we can recompute
delete packet['packet_hash'];
const newHash = computePacketHash(packet);
console.log('New packet_hash for retired EDGE-001:', newHash);
