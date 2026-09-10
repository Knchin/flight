import React from 'react';
import { Link } from 'react-router-dom';

const MethodologyPage: React.FC = () => {
  return (
    <div className="methodology-page">
      <button className="back-button" onClick={() => window.history.back()}>
        ← Back
      </button>
      
      <article className="methodology-content">
        <header>
          <h1>Aircraft Rotation Reconstruction Methodology</h1>
          <p className="last-updated">Last updated: September 2026</p>
        </header>
        
        <section>
          <h2>Overview</h2>
          <p>
            This application reconstructs the complete daily journey (rotation) of a physical aircraft from a user's flight number. 
            The core challenge is connecting a commercial flight number to a physical aircraft (via registration/ICAO24), 
            then finding all sectors that aircraft operated that day.
          </p>
        </section>
        
        <section>
          <h2>Data Sources</h2>
          
          <div className="source-cards">
            <div className="source-card primary">
              <h3>OpenSky Network <span className="badge primary-badge">Primary</span></h3>
              <p><strong>Role:</strong> Aircraft rotation reconstruction (ADS-B derived)</p>
              <p><strong>Key Endpoint:</strong> <code>/flights/aircraft</code> — Returns all flights for an ICAO24 within a date range (max 2 days)</p>
              <h4>Strengths</h4>
              <ul>
                <li>Direct access to ADS-B derived flight sectors</li>
                <li>No flight number lookup needed — works from ICAO24</li>
                <li>Actual departure/arrival times from ADS-B</li>
                <li>Free for non-commercial use</li>
              </ul>
              <h4>Limitations</h4>
              <ul>
                <li>Non-commercial use only</li>
                <li>Flights updated nightly (batch process)</li>
                <li>No registration data (only ICAO24)</li>
                <li>No scheduled times (only actual from ADS-B)</li>
                <li>Estimated airports with confidence scores</li>
                <li>2-day max window per request</li>
                <li>Tracks limited to 30 days history</li>
              </ul>
            </div>
            
            <div className="source-card secondary">
              <h3>AeroDataBox <span className="badge secondary-badge">Secondary</span></h3>
              <p><strong>Role:</strong> Flight lookup by number + date, aircraft details, schedules</p>
              <h4>Strengths</h4>
              <ul>
                <li>Flight lookup by IATA flight number + date</li>
                <li>Registration, ICAO24, aircraft type, operator</li>
                <li>Scheduled + actual + estimated times</li>
                <li>Historical data up to 365 days</li>
                <li>Schedules up to 365 days future</li>
                <li>Affordable pricing</li>
              </ul>
            </div>
            
            <div className="source-card tertiary">
              <h3>FlightAware AeroAPI <span className="badge tertiary-badge">Tertiary</span></h3>
              <p><strong>Role:</strong> Deep historical data, Foresight predictions</p>
              <h4>Strengths</h4>
              <ul>
                <li>Historical data from 2011</li>
                <li>Foresight predictive ETAs</li>
                <li>Global coverage</li>
                <li>Personal tier free for non-commercial</li>
              </ul>
              <h4>Limitations</h4>
              <ul>
                <li>Historical data requires Standard+ ($100/mo)</li>
                <li>Usage-based pricing</li>
                <li>Personal tier limited to current flights</li>
              </ul>
            </div>
          </div>
        </section>
        
        <section>
          <h2>Algorithm</h2>
          
          <div className="algorithm-steps">
            <div className="step">
              <div className="step-number">1</div>
              <div className="step-content">
                <h3>Flight Lookup</h3>
                <p>Find the requested flight by flight number and date using AeroDataBox, FlightAware, or AviationStack.</p>
                <p><strong>Output:</strong> Flight details including registration, ICAO24, aircraft type, operator, scheduled/actual times.</p>
              </div>
            </div>
            
            <div className="step">
              <div className="step-number">2</div>
              <div className="step-content">
                <h3>Aircraft Identification</h3>
                <p>Resolve the physical aircraft identity using multi-provider agreement.</p>
                <p><strong>Scoring:</strong> Registration match (+50), ICAO24 match (+40), Callsign match (+25), Flight number match (+20), Airport/time compatibility (+15), Aircraft type match (+10)</p>
                <p><strong>Thresholds:</strong> HIGH &ge; 80, MEDIUM 50-79, LOW 25-49, UNKNOWN &lt; 25</p>
              </div>
            </div>
            
            <div className="step">
              <div className="step-number">3</div>
              <div className="step-content">
                <h3>Rotation Reconstruction</h3>
                <p>Query OpenSky <code>/flights/aircraft</code> for all ADS-B sectors for the aircraft on that date (±2 hours for overnight).</p>
                <p><strong>Output:</strong> Chronological list of ADS-B sectors with actual times, estimated airports, callsigns.</p>
              </div>
            </div>
            
            <div className="step">
              <div className="step-number">4</div>
              <div className="step-content">
                <h3>Leg-Flight Matching</h3>
                <p>Match each ADS-B sector to a scheduled flight using multi-signal scoring.</p>
                <p><strong>Signals:</strong> ICAO24, callsign, airports, times, flight number, aircraft type.</p>
              </div>
            </div>
            
            <div className="step">
              <div className="step-number">5</div>
              <div className="step-content">
                <h3>Rotation Assembly</h3>
                <p>Build complete rotation with turnarounds and delays.</p>
                <p><strong>Calculations:</strong> Turnaround = Next departure - Current arrival. Departure delay = Actual - Scheduled departure. Arrival delay = Actual - Scheduled arrival.</p>
              </div>
            </div>
            
            <div className="step">
              <div className="step-number">6</div>
              <div className="step-content">
                <h3>Delay Propagation Analysis</h3>
                <p>For each consecutive sector pair: if prior arrival delayed &gt;15min AND next departure delayed &gt;15min AND turnaround maintained &rarr; "Likely propagated".</p>
                <p><strong>Categories:</strong> LIKELY_PROPAGATED, CONSISTENT_WITH, POSSIBLE_FACTOR, NO_PROPAGATION, INSUFFICIENT_DATA</p>
              </div>
            </div>
          </div>
        </section>
        
        <section>
          <h2>Confidence System</h2>
          <div className="confidence-levels">
            <div className="confidence-level high">
              <h4>HIGH</h4>
              <p>Multiple independent sources confirm. Strong signal agreement.</p>
            </div>
            <div className="confidence-level medium">
              <h4>MEDIUM</h4>
              <p>Good evidence but some signals missing or conflicting.</p>
            </div>
            <div className="confidence-level low">
              <h4>LOW</h4>
              <p>Weak evidence. Single source or significant gaps.</p>
            </div>
            <div className="confidence-level unknown">
              <h4>UNKNOWN</h4>
              <p>Insufficient data to make a determination.</p>
            </div>
          </div>
        </section>
        
        <section>
          <h2>Key Limitations</h2>
          <ul className="limitations-list">
            <li><strong>OpenSky:</strong> Non-commercial only, flights updated nightly, estimated airports</li>
            <li><strong>Aircraft swaps:</strong> Cannot detect if scheduled aircraft differs from actual without multiple sources</li>
            <li><strong>Missing sectors:</strong> ADS-B coverage gaps may miss sectors, especially over oceans/remote areas</li>
            <li><strong>Registration changes:</strong> Aircraft may change registration; we track by ICAO24</li>
            <li><strong>Callsign reuse:</strong> Same callsign may be used by different aircraft on different days</li>
            <li><strong>Timezone handling:</strong> All times stored UTC, displayed in airport local time</li>
            <li><strong>Midnight crossings:</strong> Searches ±2 hours around midnight to capture overnight sectors</li>
          </ul>
        </section>
        
        <section>
          <h2>Example Scenario</h2>
          <div className="example">
            <p><strong>User searches:</strong> FR9034 on 2026-09-10</p>
            <ol>
              <li>AeroDataBox finds FR9034: registration 9H-XXXX, ICAO24 48xx04, type B38M, operator RYR</li>
              <li>OpenSky <code>/flights/aircraft?icao24=48xx04</code> returns 4 sectors for 2026-09-10</li>
              <li>Matching: Sector 1 (RYR4632 VLC→BGY) + Sector 2 (RYR219 BGY→ALC) + Sector 3 (RYR9034 ALC→BVA) + Sector 4 (RYRxxx BVA→...)</li>
              <li>Turnarounds: 42min, 1h18m, 55min</li>
              <li>Delays: FR4632 arr +37min → FR219 dep +39min → FR9034 dep +41min</li>
              <li>Propagation: LIKELY_PROPAGATED (consistent delays, maintained turnarounds)</li>
            </ol>
          </div>
        </section>
        
        <section>
          <h2>Privacy & Compliance</h2>
          <div className="compliance-grid">
            <div><strong>OpenSky:</strong> Non-commercial use only, cite original paper</div>
            <div><strong>AeroDataBox:</strong> 7-day cache standard, extended on paid plans, attribution on free</div>
            <div><strong>FlightAware:</strong> Per tier, no redistribution of raw data</div>
            <div><strong>AviationStack:</strong> Per plan, attribution required</div>
          </div>
        </section>
      </article>
    </div>
  );
};

export default MethodologyPage;