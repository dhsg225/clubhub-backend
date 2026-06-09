/**
 * Constitutional: PREVIEW: prefix on checksums is NEVER stripped.
 * This component enforces that invariant at the rendering layer.
 */

interface Props {
  checksum: string;
  label?: string;
}

export function PreviewChecksumDisplay({ checksum, label = 'Preview checksum' }: Props): JSX.Element {
  // Constitutional guard: verify prefix is present
  const hasPrefix = checksum.startsWith('PREVIEW:');
  const displayChecksum = hasPrefix ? checksum : `PREVIEW:${checksum}`; // restore if somehow stripped

  return (
    <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#6b7280' }}>
      <span style={{ marginRight: '0.5rem', color: '#9ca3af' }}>{label}:</span>
      <code style={{ color: hasPrefix ? '#374151' : '#dc2626' }}>
        {displayChecksum}
      </code>
      {!hasPrefix && (
        <span style={{ marginLeft: '0.5rem', color: '#dc2626', fontFamily: 'system-ui' }}>
          ⚠ PREVIEW prefix was missing — this is a preview checksum, not canonical
        </span>
      )}
      <div style={{ marginTop: '0.25rem', fontSize: '0.7rem', color: '#9ca3af' }}>
        This is a PRE resolution preview. This checksum is not a canonical playlist checksum.
      </div>
    </div>
  );
}
