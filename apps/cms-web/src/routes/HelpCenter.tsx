/**
 * Help Center — operator reference for ClubHub TV CMS.
 *
 * Covers: content workflow, key concepts (D-013, D-016), screen layouts,
 * getting started guide, FAQ, and keyboard shortcuts.
 */
import { useState } from 'react';

/* ================================================================== *
 * Section data
 * ================================================================== */

type SectionId =
  | 'getting-started'
  | 'how-it-works'
  | 'concepts'
  | 'layouts'
  | 'content-types'
  | 'scheduling'
  | 'faq';

interface Section {
  id: SectionId;
  title: string;
  icon: string;
}

const SECTIONS: Section[] = [
  { id: 'getting-started', title: 'Getting Started',    icon: '1' },
  { id: 'how-it-works',    title: 'How It Works',       icon: '2' },
  { id: 'concepts',        title: 'Key Concepts',       icon: '3' },
  { id: 'layouts',         title: 'Screen Layouts',     icon: '4' },
  { id: 'content-types',   title: 'Content Types',      icon: '5' },
  { id: 'scheduling',      title: 'Scheduling',         icon: '6' },
  { id: 'faq',             title: 'FAQ',                icon: '?' },
];

/* ================================================================== *
 * Section content
 * ================================================================== */

function GettingStarted(): JSX.Element {
  return (
    <>
      <H2>Getting Started</H2>
      <P>ClubHub TV puts your venue's content on screen — promotions, events, menus, sponsor banners, and live ticker messages. Everything is managed from this CMS.</P>

      <H3>Quick start (5 minutes)</H3>
      <Ol>
        <li><B>Create a Card</B> — Go to <Code>Campaigns → New campaign</Code>. Pick a template, fill in the fields, set an expiry date, and save.</li>
        <li><B>Build a Playlist</B> — Go to <Code>Playlists → New playlist</Code>. Add the cards you just created. Set the order and duration for each.</li>
        <li><B>Schedule it</B> — Go to <Code>Schedules → New schedule</Code>. Pick your playlist, choose which venue/screen it plays on, set the days and times, and save.</li>
        <li><B>Watch it play</B> — Your screen will pick up the new content within 60 seconds. No manual refresh needed.</li>
      </Ol>

      <Callout type="info">
        Screens sync automatically every 60 seconds. Once a schedule is active, screens pick it up on the next sync cycle.
      </Callout>
    </>
  );
}

function HowItWorks(): JSX.Element {
  return (
    <>
      <H2>How It Works</H2>
      <P>Content flows through four layers before it reaches a screen. Each layer has one job:</P>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', margin: '1.25rem 0' }}>
        <FlowStep num="1" title="Card" desc="A single piece of content — a promo slide, event banner, menu board, or sponsor banner. You create it once." />
        <FlowArrow />
        <FlowStep num="2" title="Playlist" desc="An ordered loop of cards. Controls what plays and for how long (e.g. 10 seconds per card, sequential or shuffle)." />
        <FlowArrow />
        <FlowStep num="3" title="Schedule" desc="Maps a playlist to a venue, screen group, or individual screen. Controls when it plays (days of week, time windows, priority)." />
        <FlowArrow />
        <FlowStep num="4" title="Screen" desc="The physical display (Raspberry Pi). Pulls its content automatically. Can play for 72 hours offline if your network goes down." />
      </div>

      <Callout type="info">
        This is the same model used by every major digital signage platform. It means you can reuse the same card across multiple playlists, and the same playlist across multiple schedules.
      </Callout>
    </>
  );
}

function Concepts(): JSX.Element {
  return (
    <>
      <H2>Key Concepts</H2>
      <P>These terms are used consistently throughout ClubHub. Understanding them makes everything easier.</P>

      <DefTable rows={[
        ['Card', 'A single piece of authored content. Has a template type (e.g. Promo Slide), data fields (title, subtitle, colours), and an expiry date. Created in Campaigns → New campaign.'],
        ['Playlist', 'An ordered collection of cards that loop on screen. Each card has a display duration (minimum 3 seconds). Playlists can be sequential or shuffled.'],
        ['Schedule', 'The rule that puts a playlist on a screen. Specifies which venue/screen, what days and times, and the priority level. Higher priority schedules override lower ones.'],
        ['Screen', 'A physical Raspberry Pi display at a venue. Each screen has a name, belongs to a venue, and can be assigned a layout.'],
        ['Venue', 'A physical location (your club, bar, or restaurant). Contains one or more screens. Has a timezone for scheduling.'],
        ['Tenant', 'Your organisation. All your venues, screens, content, and schedules belong to one tenant. Multi-venue operators have one tenant with multiple venues.'],
        ['Layout', 'The screen geometry — how the display is divided into zones. Layouts are pre-built (you pick one, you don\'t design them). Options: Fullscreen, Split Horizontal, News Bar, Quad.'],
        ['Zone', 'A named region inside a layout. Each zone plays its own playlist independently. The "main" zone is where your primary content goes. "ticker" is the scrolling text bar.'],
        ['Widget', 'A small real-time utility in a zone — the clock, date display, or scrolling ticker. Widgets are not scheduled — they run automatically based on the layout.'],
        ['Ticker', 'Scrolling text messages at the bottom of the screen (in layouts that have a ticker zone). Managed in the Ticker section. Not a card — it\'s a widget.'],
      ]} />
    </>
  );
}

function Layouts(): JSX.Element {
  return (
    <>
      <H2>Screen Layouts</H2>
      <P>Each screen has a layout that determines how content is arranged. You select a layout per screen — you don't design custom layouts.</P>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem', margin: '1.25rem 0' }}>
        <LayoutCard
          name="Fullscreen"
          slug="fullscreen"
          desc="One zone fills the entire display. Your playlist rotates here."
          zones={['main']}
        />
        <LayoutCard
          name="Split Horizontal"
          slug="split_horizontal"
          desc="Two equal halves side by side, plus a ticker bar at the bottom with clock."
          zones={['main_left', 'main_right', 'ticker']}
        />
        <LayoutCard
          name="News Bar"
          slug="news_bar"
          desc="Full-screen main zone with a persistent scrolling ticker strip at the bottom."
          zones={['main', 'ticker']}
        />
        <LayoutCard
          name="Quad"
          slug="quad"
          desc="Four equal zones — great for menu boards or multi-content displays."
          zones={['top_left', 'top_right', 'bottom_left', 'bottom_right']}
        />
      </div>

      <Callout type="tip">
        To change a screen's layout, open the venue dashboard, click on the screen, and select a layout from the dropdown. The screen will switch layouts on its next sync.
      </Callout>
    </>
  );
}

function ContentTypes(): JSX.Element {
  return (
    <>
      <H2>Content Types (Card Templates)</H2>
      <P>Each card uses a template that defines what fields are available. You fill in the fields — the system handles the design.</P>

      <DefTable rows={[
        ['Promotional Slide', 'Title + subtitle + background/text colours. Use for happy hours, specials, announcements. The most common card type.'],
        ['Event Banner', 'Event name + date + time + description. Use for live music nights, trivia, themed events.'],
        ['Sponsor Banner', 'Sponsor name + tagline + tier (Platinum/Gold/Silver) + optional image. Use for acknowledging venue sponsors.'],
        ['Menu Board', 'Sections with items and prices. Up to 2 sections, 4 items each. Use for food menus, drink lists.'],
        ['Daily Specials', 'Headline + list of dishes with prices. Up to 5 items. Use for today\'s specials board.'],
      ]} />

      <Callout type="info">
        New template types can be added by your platform administrator without any code changes. The form fields are driven by a template catalogue in the database.
      </Callout>
    </>
  );
}

function Scheduling(): JSX.Element {
  return (
    <>
      <H2>Scheduling</H2>
      <P>Schedules control when and where content plays. They're the bridge between your playlists and your screens.</P>

      <H3>Priority</H3>
      <P>Every schedule has a priority number (1–10). When multiple schedules are active at the same time for the same screen, the highest priority wins. Use this for:</P>
      <Ul>
        <li><B>Regular content</B> (priority 3–5) — your daily playlists</li>
        <li><B>Events</B> (priority 6–7) — override regular content during event hours</li>
        <li><B>Emergencies</B> (priority 8–10) — venue-wide announcements that override everything</li>
      </Ul>

      <H3>Time windows</H3>
      <P>Schedules can be constrained to:</P>
      <Ul>
        <li><B>Date range</B> — starts at / ends at (e.g. "June 20 – June 30")</li>
        <li><B>Days of week</B> — e.g. Thursday through Sunday only</li>
        <li><B>Time of day</B> — e.g. 16:00 – 21:00 (happy hour)</li>
      </Ul>
      <P>All constraints are in the venue's local timezone.</P>

      <H3>Targeting</H3>
      <P>A schedule can target:</P>
      <Ul>
        <li><B>A specific screen</B> — content plays on that screen only</li>
        <li><B>A screen group</B> — all screens in that group (e.g. "bar", "vip")</li>
        <li><B>A venue</B> — all screens at that venue</li>
      </Ul>

      <H3>Zones</H3>
      <P>Each schedule targets a specific zone within the screen's layout (default: <Code>main</Code>). This lets you schedule different playlists for different zones independently.</P>

      <Callout type="tip">
        Fallback schedules (marked "is_fallback") only play when no regular schedule is active. Use them for default/ambient content.
      </Callout>
    </>
  );
}

function FAQ(): JSX.Element {
  return (
    <>
      <H2>Frequently Asked Questions</H2>

      <FaqItem q="How long until my changes appear on screen?">
        Screens poll for updates every 60 seconds. Your changes will appear within 1 minute of saving.
      </FaqItem>

      <FaqItem q="What happens if the internet goes down?">
        Screens store their content locally and can operate for 72 hours without any internet connection. When connectivity returns, they sync automatically.
      </FaqItem>

      <FaqItem q="Can I schedule different content for different times of day?">
        Yes. Create multiple schedules for the same screen with different time windows. The schedule system handles the switching automatically.
      </FaqItem>

      <FaqItem q="What's the minimum duration for a card on screen?">
        3 seconds. This prevents the screen from flickering too fast.
      </FaqItem>

      <FaqItem q="Can the same card be in multiple playlists?">
        Yes. Cards are independent from playlists. One card can appear in as many playlists as you want.
      </FaqItem>

      <FaqItem q="What does the expiry date on a card do?">
        After the expiry date, the card is automatically excluded from all playlists. It won't appear on any screen. You can set "No expiry" for permanent content.
      </FaqItem>

      <FaqItem q="How do I add scrolling text to the bottom of the screen?">
        First, set the screen's layout to "News Bar" or "Split Horizontal" (both have a ticker zone). Then go to the Ticker section and add text messages for that screen.
      </FaqItem>

      <FaqItem q="What does 'Cross-post to Facebook' do?">
        When enabled on a card, it sends the card's content to your connected Facebook page automatically. Your social accounts must be connected in the platform settings first.
      </FaqItem>

      <FaqItem q="What is the 'Write for me' button?">
        AI-assisted copy generation. It creates title and description text based on your template type. It only fills in empty fields — it won't overwrite anything you've already typed.
      </FaqItem>

      <FaqItem q="Can I upload images or videos?">
        Yes, if media storage is configured. The card authoring form shows a file upload field for templates that support images. Files are uploaded directly to CDN — they don't go through the CMS server.
      </FaqItem>
    </>
  );
}

/* ================================================================== *
 * Reusable components
 * ================================================================== */

function H2({ children }: { children: React.ReactNode }): JSX.Element {
  return <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.35rem', fontWeight: 700, color: '#111827' }}>{children}</h2>;
}
function H3({ children }: { children: React.ReactNode }): JSX.Element {
  return <h3 style={{ margin: '1.25rem 0 0.5rem', fontSize: '1rem', fontWeight: 600, color: '#374151' }}>{children}</h3>;
}
function P({ children }: { children: React.ReactNode }): JSX.Element {
  return <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', lineHeight: 1.6, color: '#374151' }}>{children}</p>;
}
function B({ children }: { children: React.ReactNode }): JSX.Element {
  return <strong style={{ fontWeight: 600, color: '#111827' }}>{children}</strong>;
}
function Code({ children }: { children: React.ReactNode }): JSX.Element {
  return <code style={{ padding: '0.15rem 0.35rem', backgroundColor: '#f3f4f6', borderRadius: '3px', fontSize: '0.8rem', fontFamily: 'monospace', color: '#1d4ed8' }}>{children}</code>;
}
function Ol({ children }: { children: React.ReactNode }): JSX.Element {
  return <ol style={{ margin: '0 0 1rem', paddingLeft: '1.5rem', fontSize: '0.875rem', lineHeight: 1.7, color: '#374151' }}>{children}</ol>;
}
function Ul({ children }: { children: React.ReactNode }): JSX.Element {
  return <ul style={{ margin: '0 0 1rem', paddingLeft: '1.5rem', fontSize: '0.875rem', lineHeight: 1.7, color: '#374151' }}>{children}</ul>;
}

function Callout({ type, children }: { type: 'info' | 'tip'; children: React.ReactNode }): JSX.Element {
  const styles = type === 'tip'
    ? { bg: '#f0fdf4', border: '#bbf7d0', color: '#166534', label: 'Tip' }
    : { bg: '#eff6ff', border: '#bfdbfe', color: '#1e40af', label: 'Info' };
  return (
    <div style={{ padding: '0.75rem 1rem', backgroundColor: styles.bg, border: `1px solid ${styles.border}`, borderRadius: '6px', fontSize: '0.825rem', lineHeight: 1.6, color: styles.color, margin: '1rem 0' }}>
      <strong>{styles.label}:</strong> {children}
    </div>
  );
}

function FlowStep({ num, title, desc }: { num: string; title: string; desc: string }): JSX.Element {
  return (
    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '0.75rem 1rem', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: '#fff' }}>
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#1d4ed8', color: '#fff', fontSize: '0.8rem', fontWeight: 700, flexShrink: 0 }}>{num}</span>
      <div>
        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#111827', marginBottom: '0.15rem' }}>{title}</div>
        <div style={{ fontSize: '0.825rem', color: '#6b7280', lineHeight: 1.5 }}>{desc}</div>
      </div>
    </div>
  );
}

function FlowArrow(): JSX.Element {
  return <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '1.1rem', lineHeight: 1 }}>↓</div>;
}

function DefTable({ rows }: { rows: [string, string][] }): JSX.Element {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', margin: '1rem 0' }}>
      {rows.map(([term, desc], i) => (
        <div key={term} style={{ display: 'grid', gridTemplateColumns: '160px 1fr', borderBottom: i < rows.length - 1 ? '1px solid #f3f4f6' : undefined }}>
          <div style={{ padding: '0.625rem 0.75rem', fontWeight: 600, fontSize: '0.825rem', color: '#111827', backgroundColor: '#f9fafb', borderRight: '1px solid #e5e7eb' }}>{term}</div>
          <div style={{ padding: '0.625rem 0.75rem', fontSize: '0.825rem', color: '#374151', lineHeight: 1.5 }}>{desc}</div>
        </div>
      ))}
    </div>
  );
}

function LayoutCard({ name, slug, desc, zones }: { name: string; slug: string; desc: string; zones: string[] }): JSX.Element {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1rem', backgroundColor: '#fff' }}>
      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#111827', marginBottom: '0.25rem' }}>{name}</div>
      <div style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: '#9ca3af', marginBottom: '0.5rem' }}>{slug}</div>
      <div style={{ fontSize: '0.825rem', color: '#6b7280', lineHeight: 1.5, marginBottom: '0.5rem' }}>{desc}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
        {zones.map(z => (
          <span key={z} style={{ padding: '0.15rem 0.4rem', backgroundColor: '#eff6ff', color: '#1d4ed8', borderRadius: '3px', fontSize: '0.7rem', fontFamily: 'monospace', fontWeight: 600 }}>{z}</span>
        ))}
      </div>
    </div>
  );
}

function FaqItem({ q, children }: { q: string; children: React.ReactNode }): JSX.Element {
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#111827', marginBottom: '0.3rem' }}>{q}</div>
      <div style={{ fontSize: '0.85rem', color: '#374151', lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

/* ================================================================== *
 * MAIN COMPONENT
 * ================================================================== */

export function Component(): JSX.Element {
  const [activeSection, setActiveSection] = useState<SectionId>('getting-started');

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', color: '#111827', maxWidth: '900px' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: '0 0 0.25rem', fontSize: '1.5rem', fontWeight: 600 }}>Help Center</h1>
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280' }}>
          Learn how ClubHub TV works and how to manage your venue's screens.
        </p>
      </div>

      {/* Section tabs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1.5rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.75rem' }}>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActiveSection(s.id)}
            style={{
              padding: '0.4rem 0.75rem', borderRadius: '6px', cursor: 'pointer',
              border: activeSection === s.id ? '1px solid #1d4ed8' : '1px solid #d1d5db',
              backgroundColor: activeSection === s.id ? '#eff6ff' : '#fff',
              color: activeSection === s.id ? '#1d4ed8' : '#374151',
              fontSize: '0.8rem', fontWeight: activeSection === s.id ? 600 : 400,
            }}
          >
            {s.title}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeSection === 'getting-started' && <GettingStarted />}
      {activeSection === 'how-it-works' && <HowItWorks />}
      {activeSection === 'concepts' && <Concepts />}
      {activeSection === 'layouts' && <Layouts />}
      {activeSection === 'content-types' && <ContentTypes />}
      {activeSection === 'scheduling' && <Scheduling />}
      {activeSection === 'faq' && <FAQ />}
    </div>
  );
}
