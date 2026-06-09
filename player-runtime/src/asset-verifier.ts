/**
 * Asset integrity verification before render.
 *
 * Constitutional rule: emergency content asset must be verified present
 * on all screens as a production prerequisite.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

export interface AssetVerificationResult {
  readonly asset_id: string;
  readonly path: string;
  readonly present: boolean;
  readonly checksum_valid: boolean;
  readonly expected_checksum: string | null;
  readonly actual_checksum: string | null;
}

export class AssetVerifier {
  private readonly assetDir: string;

  constructor(assetDir: string) {
    this.assetDir = assetDir;
  }

  verify(assetId: string, expectedChecksum?: string): AssetVerificationResult {
    const assetPath = path.join(this.assetDir, assetId);
    const present = fs.existsSync(assetPath);

    if (!present) {
      return {
        asset_id: assetId,
        path: assetPath,
        present: false,
        checksum_valid: false,
        expected_checksum: expectedChecksum ?? null,
        actual_checksum: null,
      };
    }

    const actual = this.computeFileChecksum(assetPath);
    const checksum_valid = expectedChecksum === undefined || actual === expectedChecksum;

    return {
      asset_id: assetId,
      path: assetPath,
      present: true,
      checksum_valid,
      expected_checksum: expectedChecksum ?? null,
      actual_checksum: actual,
    };
  }

  /** Verify all assets in a playlist. Returns failures only. */
  verifyPlaylist(
    assets: Array<{ asset_id: string; checksum?: string }>,
  ): AssetVerificationResult[] {
    return assets
      .map(a => this.verify(a.asset_id, a.checksum))
      .filter(r => !r.present || !r.checksum_valid);
  }

  private computeFileChecksum(filePath: string): string {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}
