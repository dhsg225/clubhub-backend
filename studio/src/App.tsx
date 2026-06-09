import React, { useState } from 'react';
import { CreateTab } from './components/CreateTab';
import { ContentTab } from './components/ContentTab';
import { PlaylistTab } from './components/PlaylistTab';

type Tab = 'create' | 'content' | 'playlist';

export default function App() {
  const [tab, setTab] = useState<Tab>('create');

  return (
    <div className="app">
      <header>
        <h1>ClubHub Studio</h1>
        <nav>
          {(['create', 'content', 'playlist'] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={tab === t ? 'active' : ''}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </nav>
      </header>
      <main>
        {tab === 'create'   && <CreateTab />}
        {tab === 'content'  && <ContentTab />}
        {tab === 'playlist' && <PlaylistTab />}
      </main>
    </div>
  );
}
