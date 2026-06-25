/**
 * Schedule Creator — assign a named playlist to a venue/screen with optional
 * date window and daypart restriction.
 * Route: /schedules/new
 *
 * D-013: Card → Playlist → Schedule → Screen
 * POSTs to POST /schedules with playlist_id (not content_id).
 */
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../lib/api-client.js';

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

interface NamedPlaylist {
  id: string;
  name: string;
  card_count: number;
}

interface Venue {
  id: string;
  name: string;
}

type Target = 'global' | 'venue' | 'screen';

/* ------------------------------------------------------------------ *
 * Layout / zone definitions
 * ------------------------------------------------------------------ */

const LAYOUT_ZONES: Record<string, string[]> = {
  fullscreen:       ['main'],
  split_horizontal: ['main_left', 'main_right', 'ticker'],
  news_bar:         ['main', 'ticker'],
  quad:             ['top_left', 'top_right', 'bottom_left', 'bottom_right'],
};

const LAYOUT_LABELS: Record<string, string> = {
  fullscreen:       'Full Screen',
  split_horizontal: 'Split Horizontal',
  news_bar:         'News Bar',
  quad:             'Quad',
};

const ZONE_LABELS: Record<string, string> = {
  main:         'Main (full screen)',
  main_left:    'Main Left',
  main_right:   'Main Right',
  ticker:       'Ticker Strip',
  top_left:     'Top Left',
  top_right:    'Top Right',
  bottom_left:  'Bottom Left',
  bottom_right: 'Bottom Right',
};

/* ------------------------------------------------------------------ *
 * Day definitions — Mon=1 … Sat=6, Sun=0 (matches engine convention)
 * ------------------------------------------------------------------ */

const DAYS: { label: string; value: number }[] = [
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
  { label: 'Sun', value: 0 },
];

/* ------------------------------------------------------------------ *
 * Form primitives
 * ------------------------------------------------------------------ */

function SectionHeading({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <h2 style={{
      margin: '0 0 0.75rem',
      fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af',
      textTransform: 'uppercase', letterSpacing: '0.06em',
    }}>
      {children}
    </h2>
  );
}

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }): JSX.Element {
  return (
    <label htmlFor={htmlFor} style={{
      display: 'block', fontSize: '0.78rem', fontWeight: 600,
      color: '#374151', marginBottom: '0.3rem',
    }}>
      {children}
    </label>
  );
}

function HelpText({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>{children}</p>
  );
}

function Divider(): JSX.Element {
  return <div style={{ height: '1px', backgroundColor: '#e5e7eb', margin: '1.5rem 0' }} />;
}

/* ================================================================== *
 * MAIN COMPONENT
 * ================================================================== */

export function Component(): JSX.Element {
  const navigate = useNavigate();

  /* ---- Form state ---- */
  const [playlistId, setPlaylistId] = useState('');
  const [target, setTarget] = useState<Target>('venue');
  const [venueId, setVenueId] = useState('');
  const [screenIdInput, setScreenIdInput] = useState('');
  const [priority, setPriority] = useState(5);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [daypartEnabled, setDaypartEnabled] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [timeStart, setTimeStart] = useState('');
  const [timeEnd, setTimeEnd] = useState('');
  const [layoutTemplate, setLayoutTemplate] = useState('fullscreen');
  const [zoneName, setZoneName] = useState('main');
  const [validationError, setValidationError] = useState<string | null>(null);

  /* ---- Data queries ---- */
  const { data: playlists = [], isLoading: playlistsLoading } = useQuery<NamedPlaylist[]>({
    queryKey: ['named-playlists'],
    queryFn: () => api.get<NamedPlaylist[]>('/named_playlists'),
    staleTime: 30_000,
  });

  const { data: venues = [], isLoading: venuesLoading } = useQuery<Venue[]>({
    queryKey: ['venues'],
    queryFn: () => api.get<Venue[]>('/venues'),
    enabled: target === 'venue',
    staleTime: 60_000,
  });

  /* ---- Save mutation ---- */
  const { mutate: save, isPending, error: saveError } = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post<{ id: string }>('/schedules', payload),
    onSuccess: () => navigate('/schedules'),
  });

  /* ---- Day toggle ---- */
  function toggleDay(value: number): void {
    setSelectedDays((prev) =>
      prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value],
    );
  }

  /* ---- Validation + submit ---- */
  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();

    if (!playlistId) { setValidationError('Select a playlist.'); return; }
    if (target === 'venue' && !venueId) { setValidationError('Select a venue.'); return; }
    if (target === 'screen' && !screenIdInput.trim()) { setValidationError('Enter a location ID.'); return; }
    if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
      setValidationError('End date must be after start date.');
      return;
    }
    if (daypartEnabled) {
      if (selectedDays.length === 0) { setValidationError('Select at least one day for daypart restriction.'); return; }
      if (!timeStart || !timeEnd) { setValidationError('Both "Time from" and "Time to" are required for daypart.'); return; }
    }

    setValidationError(null);
    save({
      playlist_id: playlistId,
      venue_id: target === 'venue' ? venueId : null,
      screen_id: target === 'screen' ? screenIdInput.trim() : null,
      priority,
      starts_at: startsAt || null,
      ends_at: endsAt || null,
      days_of_week: daypartEnabled ? selectedDays : null,
      time_of_day_start: daypartEnabled ? timeStart : null,
      time_of_day_end: daypartEnabled ? timeEnd : null,
      duration: 10,
      zone_name: zoneName,
    });
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', color: '#111827' }}>
      <Link to="/schedules" style={{ fontSize: '0.875rem', color: '#6b7280', textDecoration: 'none' }}>
        ← Schedules
      </Link>
      <h1 style={{ margin: '0.5rem 0 1.5rem', fontSize: '1.5rem', fontWeight: 600 }}>New schedule</h1>

      <form onSubmit={handleSubmit} style={{ maxWidth: '640px', display: 'flex', flexDirection: 'column' }}>

        {/* Section 1 — Playlist */}
        <section>
          <SectionHeading>What to play</SectionHeading>
          <FieldLabel htmlFor="playlist-select">Playlist</FieldLabel>
          <select
            id="playlist-select"
            value={playlistId}
            onChange={(e) => setPlaylistId(e.target.value)}
            disabled={playlistsLoading}
            style={inputStyle}
          >
            <option value="" disabled>— select a playlist —</option>
            {playlists.map((pl) => (
              <option key={pl.id} value={pl.id}>
                {pl.name} ({pl.card_count} {Number(pl.card_count) === 1 ? 'card' : 'cards'})
              </option>
            ))}
          </select>
          {playlists.length === 0 && !playlistsLoading && (
            <HelpText>
              No playlists yet.{' '}
              <Link to="/playlists/new" style={{ color: '#1d4ed8' }}>Create one first.</Link>
            </HelpText>
          )}
        </section>

        <Divider />

        {/* Section 2 — Where */}
        <section>
          <SectionHeading>Where to play</SectionHeading>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
            {(['global', 'venue', 'screen'] as Target[]).map((t) => (
              <label key={t} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="target"
                  value={t}
                  checked={target === t}
                  onChange={() => setTarget(t)}
                />
                {t === 'global' && 'All venues (global)'}
                {t === 'venue' && 'Specific venue'}
                {t === 'screen' && 'Specific location'}
              </label>
            ))}
          </div>

          {target === 'venue' && (
            <div style={{ marginTop: '0.5rem' }}>
              <FieldLabel htmlFor="venue-select">Venue</FieldLabel>
              <select
                id="venue-select"
                value={venueId}
                onChange={(e) => setVenueId(e.target.value)}
                disabled={venuesLoading}
                style={inputStyle}
              >
                <option value="" disabled>— select a venue —</option>
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
          )}

          {target === 'screen' && (
            <div style={{ marginTop: '0.5rem' }}>
              <FieldLabel htmlFor="screen-id-input">Location ID</FieldLabel>
              <input
                id="screen-id-input"
                type="text"
                value={screenIdInput}
                onChange={(e) => setScreenIdInput(e.target.value)}
                placeholder="e.g. gosford-foyer"
                style={inputStyle}
              />
              <HelpText>Enter the location ID as it appears in the venue dashboard.</HelpText>
            </div>
          )}
        </section>

        <Divider />

        {/* Section 3 — Priority */}
        <section>
          <SectionHeading>Priority</SectionHeading>
          <FieldLabel htmlFor="priority-input">Priority (1–10)</FieldLabel>
          <input
            id="priority-input"
            type="number"
            min={1}
            max={10}
            value={priority}
            onChange={(e) => setPriority(Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 5)))}
            style={{ ...inputStyle, width: '80px' }}
          />
          <HelpText>Higher priority overrides lower when schedules overlap. 10 = highest.</HelpText>
        </section>

        <Divider />

        {/* Section 3b — Layout + Zone */}
        <section>
          <SectionHeading>Layout &amp; zone</SectionHeading>
          <div style={{ marginBottom: '0.75rem' }}>
            <FieldLabel htmlFor="layout-select">Layout template</FieldLabel>
            <select
              id="layout-select"
              value={layoutTemplate}
              onChange={(e) => {
                const lt = e.target.value;
                setLayoutTemplate(lt);
                setZoneName(LAYOUT_ZONES[lt]?.[0] ?? 'main');
              }}
              style={inputStyle}
            >
              {Object.entries(LAYOUT_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          {(LAYOUT_ZONES[layoutTemplate]?.length ?? 1) > 1 && (
            <div>
              <FieldLabel htmlFor="zone-select">Zone</FieldLabel>
              <select
                id="zone-select"
                value={zoneName}
                onChange={(e) => setZoneName(e.target.value)}
                style={inputStyle}
              >
                {(LAYOUT_ZONES[layoutTemplate] ?? []).map((z) => (
                  <option key={z} value={z}>{ZONE_LABELS[z] ?? z}</option>
                ))}
              </select>
            </div>
          )}
        </section>

        <Divider />

        {/* Section 4 — Date window */}
        <section>
          <SectionHeading>Date window (optional)</SectionHeading>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <FieldLabel htmlFor="starts-at">Starts</FieldLabel>
              <input
                id="starts-at"
                type="date"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <FieldLabel htmlFor="ends-at">Ends</FieldLabel>
              <input
                id="ends-at"
                type="date"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
          <HelpText>Leave both blank to run indefinitely.</HelpText>
        </section>

        <Divider />

        {/* Section 5 — Daypart */}
        <section>
          <SectionHeading>Daypart (optional)</SectionHeading>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer', marginBottom: '0.75rem' }}>
            <input
              type="checkbox"
              checked={daypartEnabled}
              onChange={(e) => {
                setDaypartEnabled(e.target.checked);
                if (!e.target.checked) { setSelectedDays([]); setTimeStart(''); setTimeEnd(''); }
              }}
            />
            Restrict to specific times of day
          </label>

          {daypartEnabled && (
            <div>
              {/* Day checkboxes */}
              <div style={{ marginBottom: '0.75rem' }}>
                <FieldLabel>Days</FieldLabel>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {DAYS.map(({ label, value }) => {
                    const checked = selectedDays.includes(value);
                    return (
                      <label
                        key={value}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.3rem',
                          padding: '0.3rem 0.6rem', borderRadius: '4px', cursor: 'pointer',
                          fontSize: '0.8rem', fontWeight: 600,
                          border: `1px solid ${checked ? '#1d4ed8' : '#d1d5db'}`,
                          backgroundColor: checked ? '#eff6ff' : '#fff',
                          color: checked ? '#1d4ed8' : '#374151',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleDay(value)}
                          style={{ display: 'none' }}
                        />
                        {label}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Time range */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <FieldLabel htmlFor="time-start">Time from</FieldLabel>
                  <input
                    id="time-start"
                    type="time"
                    value={timeStart}
                    onChange={(e) => setTimeStart(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="time-end">Time to</FieldLabel>
                  <input
                    id="time-end"
                    type="time"
                    value={timeEnd}
                    onChange={(e) => setTimeEnd(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>
          )}
        </section>

        <Divider />

        {/* Validation error */}
        {validationError && (
          <div role="alert" style={{
            padding: '0.625rem 0.75rem', backgroundColor: '#fef2f2',
            border: '1px solid #fecaca', borderRadius: '5px',
            color: '#991b1b', fontSize: '0.8rem', marginBottom: '0.75rem',
          }}>
            {validationError}
          </div>
        )}

        {/* Save error */}
        {saveError && !validationError && (
          <div role="alert" style={{
            padding: '0.625rem 0.75rem', backgroundColor: '#fef2f2',
            border: '1px solid #fecaca', borderRadius: '5px',
            color: '#991b1b', fontSize: '0.8rem', marginBottom: '0.75rem',
          }}>
            Save failed: {saveError instanceof Error ? saveError.message : String(saveError)}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isPending}
          style={{
            padding: '0.65rem 1.25rem',
            backgroundColor: isPending ? '#93c5fd' : '#1d4ed8',
            color: '#fff', border: 'none', borderRadius: '6px',
            fontSize: '0.9rem', fontWeight: 600,
            cursor: isPending ? 'not-allowed' : 'pointer',
            alignSelf: 'flex-start',
          }}
        >
          {isPending ? 'Saving…' : 'Save schedule'}
        </button>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '0.45rem 0.6rem',
  border: '1px solid #d1d5db', borderRadius: '5px',
  fontSize: '0.875rem', fontFamily: 'system-ui, sans-serif',
  color: '#111827', backgroundColor: '#fff',
};
