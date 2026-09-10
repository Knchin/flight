import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SearchRequest, SearchResult } from '../types';

interface ResultPageProps {
  rotation: any;
  debugInfo: any;
  onFlightClick: (flight: any) => void;
  onMapClick: () => void;
  onBack: () => void;
}

const ResultPage: React.FC<ResultPageProps> = ({
  rotation: initialRotation,
  debugInfo: initialDebugInfo,
  onFlightClick,
  onMapClick,
  onBack,
}) => {
  const { flightNumber, date } = useParams<{ flightNumber: string; date: string }>();
  const navigate = useNavigate();
  
  const [rotation, setRotation] = useState<any>(initialRotation);
  const [debugInfo, setDebugInfo] = useState<any>(initialDebugInfo);
  const [isLoading, setIsLoading] = useState(!initialRotation);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch rotation if not provided (direct link access)
  useEffect(() => {
    if (!rotation && flightNumber && date) {
      fetchRotation();
    }
  }, [flightNumber, date, rotation]);
  
  const fetchRotation = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const request: SearchRequest = {
        flight_number: flightNumber!,
        date: date!,
      };
      
      const response = await fetch('/api/rotation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      
      const result: SearchResult = await response.json();
      
      if (result.success && result.rotation) {
        setRotation(result.rotation);
        setDebugInfo(result.debug_info);
      } else {
        setError(result.error || 'Flight not found');
        setTimeout(() => navigate('/'), 3000);
      }
    } catch (err) {
      setError('Failed to load rotation data');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };
  
  if (isLoading) {
    return (
      <div className="result-container loading">
        <div className="loading-spinner">
          <div className="spinner-large" aria-hidden="true"></div>
          <p>Reconstructing aircraft rotation…</p>
          <p className="loading-hint">Querying ADS-B data and flight schedules</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="result-container error">
        <div className="error-state">
          <h2>Flight Not Found</h2>
          <p>{error}</p>
          <button className="search-button" onClick={onBack}>← Back to Search</button>
        </div>
      </div>
    );
  }
  
  if (!rotation) {
    return null;
  }
  
  const userFlightSector = rotation.sectors.find((s: any) => s.is_user_flight);
  const aircraft = rotation.aircraft;
  
  return (
    <div className="result-container">
      <button className="back-button" onClick={onBack}>
        ← Back to Search
      </button>
      
      {/* Aircraft Header */}
      <div className="aircraft-header">
        <div className="aircraft-header-content">
          <div className="aircraft-main-info">
            <div className="aircraft-registration">
              {aircraft.registration || aircraft.icao24 || 'Unknown Aircraft'}
            </div>
            <div className="aircraft-type">
              {aircraft.type_name || aircraft.aircraft_type || 'Unknown Type'}
              {aircraft.operator_icao && (
                <span className="operator-badge">{aircraft.operator_icao}</span>
              )}
            </div>
            <div className="aircraft-operator">
              <span className="confidence-badge {aircraft_identification_confidence?.toLowerCase()}">
                Aircraft ID: {rotation.aircraft_identification_confidence || 'UNKNOWN'}
              </span>
            </div>
          </div>
          
          <div className="aircraft-meta">
            <div className="meta-item">
              <span className="meta-label">Date</span>
              <span className="meta-value">{new Date(rotation.date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Sectors Found</span>
              <span className="meta-value">{rotation.sectors.length}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Data Sources</span>
              <span className="meta-value">{rotation.data_sources.join(', ')}</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Rotation Timeline */}
      <div className="rotation-timeline">
        <div className="timeline-header">
          <h3>Today's Rotation ({rotation.sectors.length} sectors)</h3>
          <div className="timeline-actions">
            <button className="action-button" onClick={onMapClick}>
              🗺️ View Map
            </button>
          </div>
        </div>
        
        <div className="timeline-sectors">
          {rotation.sectors.map((sector: any, index: number) => (
            <SectorCard
              key={sector.leg.id}
              sector={sector}
              index={index}
              isLast={index === rotation.sectors.length - 1}
              onClick={() => onFlightClick(sector.flight || sector.leg)}
            />
          ))}
        </div>
      </div>
      
      {/* Delay Propagation */}
      {rotation.delay_propagation.length > 0 && (
        <div className="delay-propagation">
          <h3>Delay Propagation Analysis</h3>
          {rotation.delay_propagation.map((prop: any, index: number) => (
            <div key={index} className="propagation-item">
              <span className="propagation-flight">{prop.flight_number}</span>
              <span className="propagation-arrow">→</span>
              <div className="propagation-delays">
                <span>Arr: {prop.arrival_delay_minutes !== null ? formatDelay(prop.arrival_delay_minutes) : 'N/A'}</span>
                <span>Dep: {prop.departure_delay_minutes !== null ? formatDelay(prop.departure_delay_minutes) : 'N/A'}</span>
              </div>
              <span className={`propagation-likelihood ${prop.propagation_likelihood.toLowerCase().replace('_', '-')}`}>
                {formatLikelihood(prop.propagation_likelihood)}
              </span>
            </div>
          ))}
          <p className="propagation-note">
            <em>Note: "Likely propagated" means delays are temporally consistent with turnaround maintained. 
            This indicates possible causation but does not prove it.</em>
          </p>
        </div>
      )}
      
      {/* Warnings */}
      {rotation.warnings && rotation.warnings.length > 0 && (
        <div className="warnings">
          <h4>⚠️ Data Quality Notes</h4>
          <ul>
            {rotation.warnings.map((warning: string, i: number) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Debug Info */}
      {debugInfo && (
        <details className="debug-info">
          <summary>Debug Information</summary>
          <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
        </details>
      )}
    </div>
  );
};

const SectorCard: React.FC<{
  sector: any;
  index: number;
  isLast: boolean;
  onClick: () => void;
}> = ({ sector, index, isLast, onClick }) => {
  const { leg, flight, turnaround_minutes, departure_delay_minutes, arrival_delay_minutes, is_user_flight, connection_confidence } = sector;
  
  const depTime = flight?.actual_departure || leg.first_seen;
  const arrTime = flight?.actual_arrival || leg.last_seen;
  const schedDep = flight?.scheduled_departure;
  const schedArr = flight?.scheduled_arrival;
  
  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
  
  return (
    <div className={`sector ${is_user_flight ? 'user-flight' : ''}`} onClick={onClick} style={{ cursor: 'pointer' }}>
      <div className="sector-marker" />
      <div className="sector-content">
        <div className="sector-header">
          <span className="flight-number">
            {flight?.flight_number || leg.callsign || 'UNKNOWN'}
            {is_user_flight && <span className="user-badge">YOUR FLIGHT</span>}
          </span>
          {leg.callsign && leg.callsign !== flight?.flight_number && (
            <span className="callsign">{leg.callsign}</span>
          )}
        </div>
        
        <div className="sector-route">
          <div className="airport-block">
            <span className="airport-code">{leg.est_departure_icao || flight?.origin_icao || '???'}</span>
            <span className="airport-name">{flight?.origin_icao || ''}</span>
          </div>
          <span className="arrow">→</span>
          <div className="airport-block">
            <span className="airport-code">{leg.est_arrival_icao || flight?.destination_icao || '???'}</span>
            <span className="airport-name">{flight?.destination_icao || ''}</span>
          </div>
        </div>
        
        <div className="sector-times">
          <div className="time-block">
            <span className="time-label">Departure</span>
            <span className={`time-value ${departure_delay_minutes && departure_delay_minutes > 5 ? 'delayed' : ''} ${!flight?.actual_departure ? 'actual' : ''}`}>
              {depTime ? formatTime(depTime) : '—'}
              {departure_delay_minutes !== null && departure_delay_minutes !== 0 && (
                <span className={`delay-indicator ${departure_delay_minutes > 0 ? 'positive' : 'negative'}`}>
                  {departure_delay_minutes > 0 ? '+' : ''}{departure_delay_minutes}min
                </span>
              )}
              {schedDep && flight?.actual_departure && (
                <span className="time-value scheduled">Sched: {formatTime(schedDep)}</span>
              )}
            </span>
          </div>
          
          <div className="time-block">
            <span className="time-label">Arrival</span>
            <span className={`time-value ${arrival_delay_minutes && arrival_delay_minutes > 5 ? 'delayed' : ''} ${!flight?.actual_arrival ? 'actual' : ''}`}>
              {arrTime ? formatTime(arrTime) : '—'}
              {arrival_delay_minutes !== null && arrival_delay_minutes !== 0 && (
                <span className={`delay-indicator ${arrival_delay_minutes > 0 ? 'positive' : 'negative'}`}>
                  {arrival_delay_minutes > 0 ? '+' : ''}{arrival_delay_minutes}min
                </span>
              )}
              {schedArr && flight?.actual_arrival && (
                <span className="time-value scheduled">Sched: {formatTime(schedArr)}</span>
              )}
            </span>
          </div>
        </div>
        
        {turnaround_minutes !== null && (
          <div className={`turnaround ${turnaround_minutes < 30 ? 'critical' : turnaround_minutes < 45 ? 'warning' : ''}`}>
            ⏱ Turnaround: {turnaround_minutes} min
            {connection_confidence && (
              <span className="connection-confidence"> ({connection_confidence})</span>
            )}
          </div>
        )}
        
        {!is_user_flight && flight && (
          <div className="flight-match-confidence">
            Match confidence: <span className={`confidence-badge ${sector.leg_flight_match_confidence?.toLowerCase()}`}>{sector.leg_flight_match_confidence}</span>
          </div>
        )}
      </div>
    </div>
  );
};

function formatDelay(minutes: number): string {
  return `${minutes > 0 ? '+' : ''}${minutes}min`;
}

function formatLikelihood(likelihood: string): string {
  const map: Record<string, string> = {
    'LIKELY_PROPAGATED': 'Likely Propagated',
    'CONSISTENT_WITH': 'Consistent With',
    'POSSIBLE_FACTOR': 'Possible Factor',
    'NO_PROPAGATION': 'No Propagation',
    'INSUFFICIENT_DATA': 'Insufficient Data',
  };
  return map[likelihood] || likelihood;
}

export default ResultPage;