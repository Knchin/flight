import React, { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';

interface MapViewProps {
  rotation: any;
  onClose: () => void;
}

const MapView: React.FC<MapViewProps> = ({ rotation, onClose }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [leaflet, setLeaflet] = useState<any>(null);
  
  useEffect(() => {
    // Dynamically import Leaflet to avoid SSR issues
    import('leaflet').then((L) => {
      setLeaflet(L);
      
      // Fix default marker icon
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });
    });
  }, []);
  
  useEffect(() => {
    if (!leaflet || !mapRef.current || mapInstanceRef.current) return;
    
    const L = leaflet;
    const sectors = rotation.sectors;
    
    // Collect all unique airports
    const airports = new Map<string, { code: string; lat: number; lng: number; name: string }>();
    
    sectors.forEach((sector: any) => {
      const dep = sector.leg.est_departure_icao || sector.flight?.origin_icao;
      const arr = sector.leg.est_arrival_icao || sector.flight?.destination_icao;
      
      // We'd need airport coordinates from our database
      // For now, use approximate coordinates for known airports
      const airportCoords: Record<string, { lat: number; lng: number; name: string }> = {
        'LEVC': { lat: 39.4893, lng: -0.4816, name: 'Valencia' },
        'LIME': { lat: 45.6739, lng: 9.7042, name: 'Milan Bergamo' },
        'LEAL': { lat: 38.2822, lng: -0.5582, name: 'Alicante' },
        'LFOB': { lat: 49.4544, lng: 2.1128, name: 'Paris Beauvais' },
        'LEMD': { lat: 40.4983, lng: -3.5676, name: 'Madrid' },
        'LEBL': { lat: 41.2974, lng: 2.0784, name: 'Barcelona' },
        'LIRF': { lat: 41.8003, lng: 12.2389, name: 'Rome Fiumicino' },
        'LFPG': { lat: 49.0097, lng: 2.5479, name: 'Paris CDG' },
        'EGLL': { lat: 51.4700, lng: -0.4543, name: 'London Heathrow' },
        'EDDF': { lat: 50.0379, lng: 8.5622, name: 'Frankfurt' },
        'EHAM': { lat: 52.3086, lng: 4.7639, name: 'Amsterdam' },
        'LPPT': { lat: 38.7742, lng: -9.1342, name: 'Lisbon' },
        'LOWW': { lat: 48.1103, lng: 16.5697, name: 'Vienna' },
        'LGAV': { lat: 37.9364, lng: 23.9445, name: 'Athens' },
        'LKPR': { lat: 50.1008, lng: 14.2600, name: 'Prague' },
        'EPWA': { lat: 52.1657, lng: 20.9671, name: 'Warsaw' },
        'LHBP': { lat: 47.4298, lng: 19.2611, name: 'Budapest' },
      };
      
      [dep, arr].forEach(code => {
        if (code && airportCoords[code]) {
          airports.set(code, { ...airportCoords[code], code });
        }
      });
    });
    
    if (airports.size === 0) return;
    
    // Calculate bounds
    const coords = Array.from(airports.values());
    const minLat = Math.min(...coords.map(c => c.lat));
    const maxLat = Math.max(...coords.map(c => c.lat));
    const minLng = Math.min(...coords.map(c => c.lng));
    const maxLng = Math.max(...coords.map(c => c.lng));
    
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    
    // Initialize map
    const map = L.map(mapRef.current!, {
      center: [centerLat, centerLng],
      zoom: 4,
    });
    
    mapInstanceRef.current = map;
    
    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);
    
    // Fit bounds
    const bounds = L.latLngBounds(
      coords.map(c => [c.lat, c.lng] as [number, number])
    );
    map.fitBounds(bounds, { padding: [50, 50] });
    
    // Add airport markers
    const airportMarkers = new Map<string, any>();
    airports.forEach((airport, code) => {
      const marker = L.circleMarker([airport.lat, airport.lng], {
        radius: 8,
        fillColor: '#1e3a5f',
        color: '#fff',
        weight: 2,
        fillOpacity: 1,
      }).addTo(map);
      
      marker.bindPopup(`<strong>${airport.code}</strong><br>${airport.name}`);
      airportMarkers.set(code, marker);
    });
    
    // Draw flight paths
    const sortedSectors = [...sectors].sort((a, b) => 
      new Date(a.leg.first_seen).getTime() - new Date(b.leg.first_seen).getTime()
    );
    
    sortedSectors.forEach((sector, index) => {
      const dep = sector.leg.est_departure_icao || sector.flight?.origin_icao;
      const arr = sector.leg.est_arrival_icao || sector.flight?.destination_icao;
      
      if (dep && arr && airports.has(dep) && airports.has(arr)) {
        const depAirport = airports.get(dep)!;
        const arrAirport = airports.get(arr)!;
        
        const isUserFlight = sector.is_user_flight;
        const color = isUserFlight ? '#3b82f6' : '#1e3a5f';
        const weight = isUserFlight ? 4 : 2;
        const dashArray = isUserFlight ? undefined : '5, 5';
        
        const polyline = L.polyline([
          [depAirport.lat, depAirport.lng],
          [arrAirport.lat, arrAirport.lng],
        ], {
          color,
          weight,
          dashArray,
          opacity: 0.8,
        }).addTo(map);
        
        // Add flight number label at midpoint
        const midLat = (depAirport.lat + arrAirport.lat) / 2;
        const midLng = (depAirport.lng + arrAirport.lng) / 2;
        
        const flightLabel = L.divIcon({
          className: 'flight-label',
          html: `<div style="background: ${color}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600; white-space: nowrap; box-shadow: 0 1px 3px rgba(0,0,0,0.3);">${sector.flight?.flight_number || sector.leg.callsign || `Sector ${index + 1}`}</div>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });
        
        L.marker([midLat, midLng], { icon: flightLabel }).addTo(map);
        
        // Add popup to line
        polyline.bindPopup(`
          <strong>${sector.flight?.flight_number || sector.leg.callsign || `Sector ${index + 1}`}</strong><br>
          ${dep} → ${arr}<br>
          ${sector.turnaround_minutes !== null ? `Turnaround: ${sector.turnaround_minutes} min` : ''}
          ${sector.departure_delay_minutes !== null ? `Dep delay: ${sector.departure_delay_minutes > 0 ? '+' : ''}${sector.departure_delay_minutes} min` : ''}
          ${sector.arrival_delay_minutes !== null ? `Arr delay: ${sector.arrival_delay_minutes > 0 ? '+' : ''}${sector.arrival_delay_minutes} min` : ''}
          ${isUserFlight ? '<br><em>Your flight</em>' : ''}
        `);
      }
    });
    
    // Add legend
    const legend = L.control({ position: 'bottomright' });
    legend.onAdd = () => {
      const div = L.DomUtil.create('div', 'map-legend');
      div.innerHTML = `
        <h4>Rotation Map</h4>
        <div class="legend-item"><span class="legend-color" style="background: #3b82f6;"></span> Your Flight</div>
        <div class="legend-item"><span class="legend-color" style="background: #1e3a5f;"></span> Other Sectors</div>
        <div class="legend-item"><span class="legend-dot" style="background: #1e3a5f;"></span> Airports</div>
      `;
      return div;
    };
    legend.addTo(map);
    
    // Add track data if available
    sectors.forEach((sector: any) => {
      if (sector.leg.raw_data && sector.leg.raw_data.path) {
        // Path data available from OpenSky tracks
        // This would be populated if we fetched tracks
      }
    });
    
    setMapLoaded(true);
    
    // Cleanup
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [leaflet, rotation]);
  
  const handleClose = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }
    onClose();
  };
  
  return (
    <div className="modal-overlay" onClick={handleClose} role="dialog" aria-modal="true" aria-labelledby="map-title">
      <div className="modal map-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 id="map-title">Aircraft Rotation Map</h3>
          <button className="modal-close" onClick={handleClose} aria-label="Close">×</button>
        </div>
        
        <div className="modal-body" style={{ padding: 0 }}>
          <div 
            ref={mapRef} 
            className="map-container" 
            style={{ height: '60vh', minHeight: '400px' }}
          >
            {!mapLoaded && <div className="map-loading">Loading map…</div>}
          </div>
          
          <div className="map-info">
            <p><strong>{rotation.aircraft.registration || rotation.aircraft.icao24}</strong> — {rotation.date}</p>
            <p>{rotation.sectors.length} sectors · {rotation.data_sources.join(', ')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapView;