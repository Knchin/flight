import React from 'react';

interface FlightDetailModalProps {
  flight: any;
  onClose: () => void;
}

const FlightDetailModal: React.FC<FlightDetailModalProps> = ({ flight, onClose }) => {
  if (!flight) return null;
  
  // Determine if this is a leg (ADS-B sector) or a scheduled flight
  const isLeg = !!flight.first_seen && !flight.flight_number;
  const isScheduled = !!flight.flight_number;
  
  const formatTime = (iso: string | null | undefined) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString(undefined, { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit',
      timeZoneName: 'short'
    });
  };
  
  const formatDelay = (minutes: number | null) => {
    if (minutes === null || minutes === 0) return 'On time';
    return `${minutes > 0 ? '+' : ''}${minutes} min`;
  };
  
  const getConfidenceColor = (confidence: string) => {
    switch (confidence?.toLowerCase()) {
      case 'high': return 'text-green-700 bg-green-100';
      case 'medium': return 'text-yellow-700 bg-yellow-100';
      case 'low': return 'text-red-700 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };
  
  const details = [
    { label: 'Flight Number', value: flight.flight_number || flight.callsign || '—', mono: true },
    { label: 'Callsign', value: flight.callsign || '—', mono: true },
    { label: 'Airline', value: flight.airline_icao || flight.operator_icao || '—', mono: true },
    { label: 'Aircraft Registration', value: flight.registration || flight.aircraft_registration || '—', mono: true },
    { label: 'ICAO24', value: flight.icao24 || flight.aircraft_icao24 || '—', mono: true },
    { label: 'Aircraft Type', value: flight.aircraft_type || flight.type_name || '—' },
    { label: 'Origin', value: `${flight.origin_icao || flight.est_departure_icao || '—'} (${flight.origin_iata || ''})` },
    { label: 'Destination', value: `${flight.destination_icao || flight.est_arrival_icao || '—'} (${flight.destination_iata || ''})` },
    { label: 'Scheduled Departure', value: formatTime(flight.scheduled_departure) },
    { label: 'Actual Departure', value: formatTime(flight.actual_departure || flight.estimated_departure) },
    { label: 'Scheduled Arrival', value: formatTime(flight.scheduled_arrival) },
    { label: 'Actual Arrival', value: formatTime(flight.actual_arrival || flight.estimated_arrival) },
    { label: 'Departure Delay', value: formatDelay(flight.departure_delay_minutes), className: flight.departure_delay_minutes && flight.departure_delay_minutes > 5 ? 'delayed' : '' },
    { label: 'Arrival Delay', value: formatDelay(flight.arrival_delay_minutes), className: flight.arrival_delay_minutes && flight.arrival_delay_minutes > 5 ? 'delayed' : '' },
    { label: 'Flight Duration', value: flight.flight_duration_min ? `${flight.flight_duration_min} min` : '—' },
    { label: 'Distance', value: flight.distance_km ? `${flight.distance_km} km` : '—' },
    { label: 'Status', value: flight.status || '—' },
    { 
      label: 'Data Source', 
      value: flight.source || flight.provider || '—',
      className: 'source-badge'
    },
    { 
      label: 'Confidence', 
      value: flight.confidence || flight.match_confidence || flight.confidence_overall || '—',
      className: getConfidenceColor(flight.confidence || flight.match_confidence || flight.confidence_overall || '')
    },
  ].filter(d => d.value !== '—' && d.value !== '');
  
  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 id="modal-title">
            {isScheduled ? 'Flight Details' : 'ADS-B Sector Details'}
            {flight.flight_number && <span className="flight-badge">{flight.flight_number}</span>}
          </h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        
        <div className="modal-body">
          <div className="detail-grid">
            {details.map((detail, index) => (
              <div key={index} className={`detail-item ${detail.className || ''}`}>
                <span className="detail-label">{detail.label}</span>
                <span className={`detail-value ${detail.mono ? 'detail-mono' : ''} ${detail.className || ''}`}>
                  {detail.value}
                </span>
              </div>
            ))}
          </div>
          
          {flight.raw_data && (
            <details className="raw-data-toggle">
              <summary>View Raw Provider Data</summary>
              <pre className="raw-data-display">{JSON.stringify(flight.raw_data, null, 2)}</pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
};

export default FlightDetailModal;