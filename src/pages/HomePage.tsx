import React from 'react';

interface HomePageProps {
  flightNumber: string;
  setFlightNumber: (value: string) => void;
  date: string;
  setDate: (value: string) => void;
  isSearching: boolean;
  error: string | null;
  onSearch: (e: React.FormEvent) => void;
}

const HomePage: React.FC<HomePageProps> = ({
  flightNumber,
  setFlightNumber,
  date,
  setDate,
  isSearching,
  error,
  onSearch,
}) => {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(e);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSearch(e);
    }
  };
  
  return (
    <div className="home-page">
      <form className="search-form" onSubmit={handleSubmit}>
        <h2>Find your aircraft's complete daily rotation</h2>
        <p className="search-hint">Enter a flight number and date to see where the aircraft came from and where it goes next</p>
        
        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}
        
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="flight-number">Flight Number</label>
            <input
              type="text"
              id="flight-number"
              value={flightNumber}
              onChange={(e) => setFlightNumber(e.target.value.toUpperCase().replace(/\s+/g, ''))}
              placeholder="e.g., FR9034, BA123, LH456"
              onKeyDown={handleKeyDown}
              required
              autoFocus
              disabled={isSearching}
              aria-describedby="flight-help"
            />
            <span id="flight-help" className="form-help">IATA format (FR9034) or ICAO (RYR9034)</span>
          </div>
          
          <div className="form-group">
            <label htmlFor="date">Date</label>
            <select
              id="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={isSearching}
            >
              <option value={today}>Today</option>
              <option value={yesterday}>Yesterday</option>
              <option value="">Specific date…</option>
            </select>
          </div>
        </div>
        
        {/* Show date input when "Specific date" selected */}
        {!date && (
          <div className="form-group">
            <label htmlFor="custom-date">Select Date</label>
            <input
              type="date"
              id="custom-date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={today}
              disabled={isSearching}
              required
            />
          </div>
        )}
        
        <button 
          type="submit" 
          className="search-button" 
          disabled={isSearching || !flightNumber.trim() || !date}
        >
          {isSearching ? (
            <span className="button-loading">
              <span className="spinner" aria-hidden="true"></span>
              Searching…
            </span>
          ) : (
            'Track Aircraft'
          )}
        </button>
        
        <div className="search-examples">
          <span className="examples-label">Try:</span>
          <button 
            type="button" 
            className="example-btn"
            onClick={() => { setFlightNumber('FR9034'); setDate(today); }}
          >FR9034</button>
          <button 
            type="button" 
            className="example-btn"
            onClick={() => { setFlightNumber('BA123'); setDate(today); }}
          >BA123</button>
          <button 
            type="button" 
            className="example-btn"
            onClick={() => { setFlightNumber('LH456'); setDate(today); }}
          >LH456</button>
          <button 
            type="button" 
            className="example-btn"
            onClick={() => { setFlightNumber('RYR9034'); setDate(today); }}
          >RYR9034</button>
        </div>
      </form>
      
      <div className="features">
        <div className="feature">
          <div className="feature-icon" aria-hidden="true">✈️</div>
          <h3>Complete Rotation</h3>
          <p>See every sector the aircraft flew today — before and after your flight</p>
        </div>
        <div className="feature">
          <div className="feature-icon" aria-hidden="true">⏱️</div>
          <h3>Turnaround Times</h3>
          <p>Actual ground time between each sector with scheduled vs actual comparison</p>
        </div>
        <div className="feature">
          <div className="feature-icon" aria-hidden="true">📊</div>
          <h3>Delay Analysis</h3>
          <p>Understand if your delay propagated from earlier sectors</p>
        </div>
        <div className="feature">
          <div className="feature-icon" aria-hidden="true">🗺️</div>
          <h3>Route Map</h3>
          <p>Visualize the complete journey on an interactive map</p>
        </div>
      </div>
      
      <div className="data-sources">
        <h3>Data Sources</h3>
        <div className="source-badges">
          <span className="source-badge opensky">OpenSky Network</span>
          <span className="source-badge aerodatabox">AeroDataBox</span>
          <span className="source-badge flightaware">FlightAware</span>
          <span className="source-badge aviationstack">AviationStack</span>
        </div>
        <p className="data-note">ADS-B derived actual times combined with scheduled data for accuracy</p>
      </div>
    </div>
  );
};

export default HomePage;