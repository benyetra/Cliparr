import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLibrarySections, useLibraryItems, useShowSeasons, useSeasonEpisodes, useMediaSearch } from '../hooks/usePlex';
import { MediaGrid } from '../components/MediaGrid';

export function Library() {
  const { sectionKey } = useParams();
  const navigate = useNavigate();
  const { sections, loading: sectionsLoading, load: loadSections } = useLibrarySections();
  const { items, totalSize, loading: itemsLoading, load: loadItems } = useLibraryItems();
  const { seasons, loading: seasonsLoading, load: loadSeasons } = useShowSeasons();
  const { episodes, loading: episodesLoading, load: loadEpisodes } = useSeasonEpisodes();
  const { results, loading: searchLoading, search } = useMediaSearch();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShow, setSelectedShow] = useState<string | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);

  useEffect(() => {
    loadSections();
  }, [loadSections]);

  // Auto-select first section if none is selected
  useEffect(() => {
    if (!sectionKey && sections.length > 0) {
      navigate(`/library/${sections[0].key}`, { replace: true });
    }
  }, [sectionKey, sections, navigate]);

  useEffect(() => {
    if (sectionKey) {
      loadItems(sectionKey);
      setSelectedShow(null);
      setSelectedSeason(null);
    }
  }, [sectionKey, loadItems]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) search(searchQuery);
  }

  function handleItemClick(item: any) {
    if (item.type === 'show') {
      setSelectedShow(item.ratingKey);
      setSelectedSeason(null);
      loadSeasons(item.ratingKey);
    } else if (item.type === 'season') {
      setSelectedSeason(item.ratingKey);
      loadEpisodes(item.ratingKey);
    } else {
      // Movie or episode - go to clip editor
      navigate(`/clip/${item.ratingKey}`);
    }
  }

  const loading = sectionsLoading || itemsLoading || seasonsLoading || episodesLoading || searchLoading;

  // Determine what to show — drill-down state takes priority over search results
  let displayItems: any[] = [];
  let title = 'Library';

  if (selectedSeason) {
    displayItems = episodes;
    title = 'Episodes';
  } else if (selectedShow) {
    displayItems = seasons;
    title = 'Seasons';
  } else if (searchQuery && results.length > 0) {
    displayItems = results;
    title = `Search: "${searchQuery}"`;
  } else if (sectionKey) {
    displayItems = items;
    const section = sections.find((s) => s.key === sectionKey);
    title = section?.title || 'Library';
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {(selectedShow || selectedSeason || (searchQuery && results.length > 0)) && (
            <button
              className="btn-sm btn-secondary"
              onClick={() => {
                if (selectedSeason) {
                  setSelectedSeason(null);
                } else if (selectedShow) {
                  setSelectedShow(null);
                } else {
                  setSearchQuery('');
                }
              }}
            >
              Back
            </button>
          )}
          <h1 style={{ fontSize: 24 }}>{title}</h1>
        </div>

        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            placeholder="Search media..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: 240 }}
          />
          <button type="submit" className="btn-primary btn-sm">Search</button>
        </form>
      </div>

      {/* Library section tabs */}
      {!selectedShow && !selectedSeason && !searchQuery && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {sections.map((section) => (
            <button
              key={section.key}
              className={sectionKey === section.key ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
              onClick={() => navigate(`/library/${section.key}`)}
            >
              {section.title}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="loading"><div className="spinner" />Loading...</div>
      ) : displayItems.length > 0 ? (
        <MediaGrid items={displayItems} onItemClick={handleItemClick} />
      ) : sectionKey ? (
        <p style={{ color: 'var(--text-secondary)' }}>No items found.</p>
      ) : (
        <p style={{ color: 'var(--text-secondary)' }}>Select a library section to browse.</p>
      )}
    </div>
  );
}
