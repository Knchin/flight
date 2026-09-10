import React, { useState, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ResultPage from './pages/ResultPage';
import MethodologyPage from './pages/MethodologyPage';
import FlightDetailModal from './components/FlightDetailModal';
import MapView from './components/MapView';
import type { SearchResult } from './types';
import './App.css';

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // State for search
  const [flightNumber, setFlightNumber] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // State for result
  const [rotation, setRotation] = useState<any>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  
  // State for modals
  const [selectedFlight, setSelectedFlight] = useState<any>(null);
  const [showMap, setShowMap] = useState(false);
  
  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSearching(true);
    
    try {
      const response = await fetch('/api/rotation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flight_number: flightNumber, date }),
      });
      
      const result: SearchResult = await response.json();
      
      if (result.success && result.rotation) {
        setRotation(result.rotation);
        setDebugInfo(result.debug_info);
        navigate(`/result/${flightNumber}/${date}`);
      } else {
        setError(result.error || 'Flight not found');
        setRotation(null);
      }
    } catch (err) {
      setError('Search failed. Please try again.');
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  }, [flightNumber, date, navigate]);
  
  const handleFlightClick = (flight: any) => {
    setSelectedFlight(flight);
  };
  
  const handleMapClick = () => {
    if (rotation) setShowMap(true);
  };
  
  // If we have rotation data in URL params (from direct link), use it
  // This is handled by ResultPage reading from URL
  
  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>Aircraft Rotation Tracker</h1>
          <p className="subtitle">Track an aircraft's complete daily journey</p>
        </div>
      </header>
      
      <main className="app-main">
        <Routes>
          <Route 
            path="/" 
            element={
              <HomePage
                flightNumber={flightNumber}
                setFlightNumber={setFlightNumber}
                date={date}
                setDate={setDate}
                isSearching={isSearching}
                error={error}
                onSearch={handleSearch}
              />
            } 
          />
          <Route 
            path="/result/:flightNumber/:date" 
            element={
              <ResultPage
                rotation={rotation}
                debugInfo={debugInfo}
                onFlightClick={handleFlightClick}
                onMapClick={handleMapClick}
                onBack={() => navigate('/')}
              />
            } 
          />
          <Route 
            path="/methodology" 
            element={<MethodologyPage />} 
          />
        </Routes>
      </main>
      
      <footer className="app-footer">
        <p>Data from OpenSky Network, AeroDataBox, FlightAware | Non-commercial use only</p>
        <a href="/methodology" className="methodology-link">Methodology & Data Sources</a>
      </footer>
      
      {/* Flight Detail Modal */}
      {selectedFlight && (
        <FlightDetailModal
          flight={selectedFlight}
          onClose={() => setSelectedFlight(null)}
        />
      )}
      
      {/* Map Modal */}
      {showMap && rotation && (
        <MapView
          rotation={rotation}
          onClose={() => setShowMap(false)}
        />
      )}
    </div>
  );
}

export default App;