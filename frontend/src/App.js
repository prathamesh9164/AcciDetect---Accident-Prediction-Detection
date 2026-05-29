import React, { useState, useEffect, useRef } from 'react';
import { Upload, Video, Activity, Download, FileText, AlertTriangle, Play, Square, Camera, PlayCircle, Sun, Moon, Cpu, Zap } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import logo from './logo.png';

// In production (Docker), API_BASE_URL should be empty so requests are relative and Nginx proxies them
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL !== undefined ? process.env.REACT_APP_API_BASE_URL : 'http://localhost:8000';

const TrajectoryMap = ({ vehicle, isDarkMode }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !vehicle?.centroid_history || vehicle.centroid_history.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get limits of coordinates to scale the trajectory map nicely
    const coords = vehicle.centroid_history;
    const xs = coords.map(c => c.x);
    const ys = coords.map(c => c.y);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    // Padding
    const pad = 45;
    const w = canvas.width;
    const h = canvas.height;

    // Scale coords to fit canvas
    const scaleX = (x) => {
      const range = maxX - minX || 1;
      return pad + ((x - minX) / range) * (w - 2 * pad);
    };

    const scaleY = (y) => {
      const range = maxY - minY || 1;
      return pad + ((y - minY) / range) * (h - 2 * pad);
    };

    // Draw background
    ctx.fillStyle = isDarkMode ? '#0f172a' : '#f8fafc';
    ctx.fillRect(0, 0, w, h);

    // Draw grid
    ctx.strokeStyle = isDarkMode ? '#1e293b' : '#f1f5f9';
    ctx.lineWidth = 1;
    for (let i = 50; i < w; i += 50) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, h);
      ctx.stroke();
    }
    for (let i = 50; i < h; i += 50) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(w, i);
      ctx.stroke();
    }

    // Draw dotted path line
    ctx.strokeStyle = vehicle.is_accident_vehicle ? '#f43f5e' : '#6366f1';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(scaleX(coords[0].x), scaleY(coords[0].y));
    for (let i = 1; i < coords.length; i++) {
      ctx.lineTo(scaleX(coords[i].x), scaleY(coords[i].y));
    }
    ctx.stroke();
    ctx.setLineDash([]); // Reset line dash

    // Draw motion vector arrows along the path
    ctx.fillStyle = vehicle.is_accident_vehicle ? '#fda4af' : '#818cf8';
    const arrowSpacing = Math.max(1, Math.floor(coords.length / 3));
    for (let i = Math.floor(arrowSpacing / 2); i < coords.length; i += arrowSpacing) {
      if (i > 0) {
        const prev = coords[i - 1];
        const curr = coords[i];
        const px = scaleX(prev.x);
        const py = scaleY(prev.y);
        const cx = scaleX(curr.x);
        const cy = scaleY(curr.y);
        
        const angle = Math.atan2(cy - py, cx - px);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx - 10 * Math.cos(angle - Math.PI / 6), cy - 10 * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(cx - 10 * Math.cos(angle + Math.PI / 6), cy - 10 * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
      }
    }

    // Draw nodes
    coords.forEach((pt, index) => {
      const x = scaleX(pt.x);
      const y = scaleY(pt.y);

      if (index === 0) {
        // Start node
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = isDarkMode ? '#e2e8f0' : '#334155';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText('🟢 Start', x + 10, y + 4);
      } else if (index === coords.length - 1) {
        // End node
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = isDarkMode ? '#e2e8f0' : '#334155';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText('🔴 End', x + 10, y + 4);
      } else if (vehicle.is_accident_vehicle && pt.frame === vehicle.accident_frame) {
        // Accident node
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = '#f43f5e';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText('💥 IMPACT POINT', x + 12, y + 4);
      } else if (index % 10 === 0) {
        // Intermediate path dots
        ctx.fillStyle = isDarkMode ? '#94a3b8' : '#64748b';
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fill();
      }
    });

  }, [vehicle, isDarkMode]);

  return (
    <div className="flex flex-col items-center w-full">
      <div className="relative border border-gray-200 dark:border-slate-700/80 rounded-xl overflow-hidden shadow-inner bg-slate-900 w-full" style={{ maxWidth: '640px' }}>
        <canvas
          ref={canvasRef}
          width={640}
          height={320}
          className="w-full block"
        />
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
        Dotted path represents coordinate centroids. Arrow indices indicate motion vector direction. Start &amp; End nodes highlighted.
      </p>
    </div>
  );
};

const SafetyInsights = ({ vehiclesList }) => {
  if (!vehiclesList || vehiclesList.length === 0) return null;

  // 1. Calculate Fastest Vehicle
  let maxSpeed = 0;
  let maxSpeedId = null;
  vehiclesList.forEach(v => {
    if (v.max_speed_kmh > maxSpeed) {
      maxSpeed = v.max_speed_kmh;
      maxSpeedId = v.vehicle_id;
    }
  });

  // 2. Average flow speed
  const avgSpeeds = vehiclesList.map(v => v.avg_speed_kmh);
  const flowAvg = avgSpeeds.reduce((a, b) => a + b, 0) / avgSpeeds.length;

  // 3. Speed Standard Deviation (Chaotic Flow Index)
  const mean = flowAvg;
  const variance = avgSpeeds.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / avgSpeeds.length;
  const chaoticIndex = Math.sqrt(variance);

  // 4. Algorithm risk score
  const maxProb = Math.max(...vehiclesList.map(v => v.max_probability), 0);
  let riskRating = 'Low';
  let riskColor = 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-800/40';
  if (maxProb >= 0.8) {
    riskRating = 'Critical';
    riskColor = 'text-red-500 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-800/40';
  } else if (maxProb >= 0.4) {
    riskRating = 'Moderate';
    riskColor = 'text-amber-500 bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-800/40';
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div className="p-5 bg-white/40 dark:bg-slate-900/40 border border-white/50 dark:border-slate-800/30 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col justify-between">
        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-bold">⚡ Fastest Tracker</p>
        <p className="text-2xl font-extrabold text-gray-800 dark:text-gray-100 mt-2">
          {maxSpeedId ? `Vehicle #${maxSpeedId}` : 'N/A'}
        </p>
        <p className="text-xs text-rose-500 dark:text-rose-400 mt-2 font-semibold">Peak Speed: {maxSpeed.toFixed(1)} km/h</p>
      </div>

      <div className="p-5 bg-white/40 dark:bg-slate-900/40 border border-white/50 dark:border-slate-800/30 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col justify-between">
        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-bold">📊 Flow Turbulence (SD)</p>
        <p className="text-2xl font-extrabold text-gray-800 dark:text-gray-100 mt-2">
          {chaoticIndex.toFixed(1)}
        </p>
        <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-2 font-semibold">Speed Standard Deviation</p>
      </div>

      <div className="p-5 bg-white/40 dark:bg-slate-900/40 border border-white/50 dark:border-slate-800/30 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col justify-between">
        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-bold">🛡️ Risk Assessment</p>
        <div className="mt-2">
          <span className={`text-sm font-bold px-3 py-1.5 rounded-xl font-mono tracking-wider ${riskColor}`}>
            {riskRating.toUpperCase()}
          </span>
        </div>
        <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-2 font-semibold">Threat Level Rating</p>
      </div>
    </div>
  );
};

const CloseCallTimeline = ({ vehiclesList, fps, analysisData }) => {
  const timelineEvents = [];
  const framesVal = fps || 25;

  // ── 1. Identify accident vehicles and build per-vehicle peak events ──
  const accidentVehicles = vehiclesList.filter(v => v.is_accident_vehicle);
  const highRiskVehicles = vehiclesList.filter(v => v.max_probability >= 0.3);

  // ── 2. Build pairwise interactions using temporal overlap windows ──
  const FRAME_WINDOW = Math.max(5, Math.round(framesVal * 0.4)); // ~0.4s window

  for (let i = 0; i < highRiskVehicles.length; i++) {
    for (let j = i + 1; j < highRiskVehicles.length; j++) {
      const v1 = highRiskVehicles[i];
      const v2 = highRiskVehicles[j];

      // Check temporal overlap: were both vehicles visible at overlapping times?
      const overlapStart = Math.max(v1.first_seen_frame || 0, v2.first_seen_frame || 0);
      const overlapEnd = Math.min(v1.last_seen_frame || Infinity, v2.last_seen_frame || Infinity);
      if (overlapStart > overlapEnd) continue; // no temporal overlap

      const history1 = v1.probability_history || [];
      const history2 = v2.probability_history || [];
      if (history1.length === 0 && history2.length === 0) continue;

      // Build a frame→probability map for fast lookup from vehicle 2
      const h2Map = {};
      history2.forEach(h => { h2Map[h.frame] = h.probability; });

      let peakProb = 0;
      let peakFrame = null;

      // For each probability entry of v1, find the nearest v2 entry within the window
      history1.forEach(h1 => {
        if (h1.frame < overlapStart || h1.frame > overlapEnd) return;

        let bestNeighborProb = 0;
        for (let f = h1.frame - FRAME_WINDOW; f <= h1.frame + FRAME_WINDOW; f++) {
          if (h2Map[f] !== undefined && h2Map[f] > bestNeighborProb) {
            bestNeighborProb = h2Map[f];
          }
        }

        // Combined threat = max of both vehicles' probabilities at this temporal window
        const combinedProb = Math.max(h1.probability, bestNeighborProb);
        if (combinedProb > peakProb) {
          peakProb = combinedProb;
          peakFrame = h1.frame;
        }
      });

      // Also scan from v2's perspective for frames v1 might not have
      history2.forEach(h2 => {
        if (h2.frame < overlapStart || h2.frame > overlapEnd) return;
        if (h2.probability > peakProb) {
          peakProb = h2.probability;
          peakFrame = h2.frame;
        }
      });

      if (peakFrame !== null && peakProb >= 0.25) {
        const bothAccident = v1.is_accident_vehicle && v2.is_accident_vehicle;
        const eitherAccident = v1.is_accident_vehicle || v2.is_accident_vehicle;

        timelineEvents.push({
          type: 'pair',
          vehicles: [v1.vehicle_id, v2.vehicle_id],
          probability: peakProb,
          frame: peakFrame,
          time: peakFrame / framesVal,
          isAccident: bothAccident || (eitherAccident && peakProb >= 0.7),
          severity: peakProb >= 0.8 ? 'critical' : peakProb >= 0.5 ? 'high' : peakProb >= 0.3 ? 'medium' : 'low',
          v1Speed: v1.max_speed_kmh,
          v2Speed: v2.max_speed_kmh,
        });
      }
    }
  }

  // ── 3. Add confirmed accident event from global analysis data ──
  if (analysisData?.accident_detected && analysisData?.accident_frame) {
    const accidentVehicleIds = accidentVehicles.map(v => v.vehicle_id);
    // Only add if not already captured by a pair event
    const alreadyCovered = timelineEvents.some(
      e => e.isAccident && Math.abs(e.frame - analysisData.accident_frame) < FRAME_WINDOW * 2
    );
    if (!alreadyCovered) {
      timelineEvents.push({
        type: 'system',
        vehicles: accidentVehicleIds.length > 0 ? accidentVehicleIds : ['Unknown'],
        probability: Math.max(...accidentVehicles.map(v => v.max_probability), 0.9),
        frame: analysisData.accident_frame,
        time: analysisData.accident_timestamp || (analysisData.accident_frame / framesVal),
        isAccident: true,
        severity: 'critical',
      });
    }
  }

  // ── 4. Add single-vehicle accident entries if not already in a pair ──
  accidentVehicles.forEach(v => {
    const alreadyInPair = timelineEvents.some(
      e => e.vehicles.includes(v.vehicle_id) && e.isAccident
    );
    if (!alreadyInPair && v.accident_frame) {
      timelineEvents.push({
        type: 'single',
        vehicles: [v.vehicle_id],
        probability: v.max_probability,
        frame: v.accident_frame,
        time: v.accident_frame / framesVal,
        isAccident: true,
        severity: 'critical',
      });
    }
  });

  // Deduplicate close events (within 1s of each other with same vehicles)
  const deduped = [];
  timelineEvents.sort((a, b) => a.time - b.time);
  timelineEvents.forEach(event => {
    const isDuplicate = deduped.some(existing =>
      Math.abs(existing.time - event.time) < 1.0 &&
      existing.vehicles.some(v => event.vehicles.includes(v)) &&
      Math.abs(existing.probability - event.probability) < 0.05
    );
    if (!isDuplicate) deduped.push(event);
  });

  if (deduped.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500 dark:text-gray-400 bg-white/30 dark:bg-slate-900/30 backdrop-blur-xl rounded-2xl border border-white/50 dark:border-slate-800/30">
        <div className="text-3xl mb-2">✅</div>
        No high-risk close calls or accident interactions detected. Safe traffic flow observed.
      </div>
    );
  }

  const severityConfig = {
    critical: { bg: 'bg-rose-100 dark:bg-rose-950/50', text: 'text-rose-700 dark:text-rose-400', border: 'border-rose-300 dark:border-rose-800', dot: 'bg-rose-500', label: 'CRITICAL' },
    high:     { bg: 'bg-orange-100 dark:bg-orange-950/50', text: 'text-orange-700 dark:text-orange-400', border: 'border-orange-300 dark:border-orange-800', dot: 'bg-orange-500', label: 'HIGH' },
    medium:   { bg: 'bg-amber-100 dark:bg-amber-950/50', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-300 dark:border-amber-800', dot: 'bg-amber-500', label: 'MODERATE' },
    low:      { bg: 'bg-yellow-100 dark:bg-yellow-950/50', text: 'text-yellow-700 dark:text-yellow-400', border: 'border-yellow-300 dark:border-yellow-800', dot: 'bg-yellow-500', label: 'LOW' },
  };

  return (
    <div className="space-y-0 relative">
      {/* Vertical connector line */}
      <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-rose-400 via-amber-400 to-green-400 dark:from-rose-600 dark:via-amber-600 dark:to-green-600 rounded-full" />

      {deduped.map((event, idx) => {
        const sev = severityConfig[event.severity] || severityConfig.medium;
        const vehicleLabel = event.vehicles.length === 1
          ? `🚗 Vehicle #${event.vehicles[0]}`
          : `🚗 Vehicle #${event.vehicles[0]}  ↔  🚗 Vehicle #${event.vehicles[1]}`;

        return (
          <div key={`tl-${idx}`} className="relative pl-12 pb-6 last:pb-0">
            {/* Timeline dot */}
            <div className={`absolute left-2.5 top-2 w-5 h-5 rounded-full ${sev.dot} border-2 border-white dark:border-slate-900 shadow-lg z-10 flex items-center justify-center`}>
              {event.isAccident && (
                <span className={`absolute inset-0 rounded-full ${sev.dot} animate-ping opacity-40`} />
              )}
            </div>

            {/* Event card */}
            <div className={`${sev.bg} border ${sev.border} rounded-xl p-4 transition-all hover:shadow-lg hover:scale-[1.01]`}>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className="font-bold text-gray-800 dark:text-gray-100 text-sm">
                  {vehicleLabel}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold tracking-wider ${sev.text} ${sev.bg} border ${sev.border}`}>
                  {sev.label}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                {/* Probability */}
                <div className="flex flex-col">
                  <span className="text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium mb-0.5">Collision Risk</span>
                  <span className={`font-mono font-bold text-base ${sev.text}`}>
                    {(event.probability * 100).toFixed(1)}%
                  </span>
                </div>
                {/* Timestamp */}
                <div className="flex flex-col">
                  <span className="text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium mb-0.5">Timestamp</span>
                  <span className="font-mono font-bold text-gray-700 dark:text-gray-200">
                    {event.time.toFixed(1)}s
                  </span>
                </div>
                {/* Frame */}
                <div className="flex flex-col">
                  <span className="text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium mb-0.5">Frame</span>
                  <span className="font-mono font-bold text-gray-700 dark:text-gray-200">
                    #{event.frame}
                  </span>
                </div>
                {/* Status */}
                <div className="flex flex-col">
                  <span className="text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium mb-0.5">Impact Status</span>
                  <span className="font-bold">
                    {event.isAccident ? (
                      <span className="text-rose-600 dark:text-rose-400">💥 Confirmed Impact</span>
                    ) : event.severity === 'high' ? (
                      <span className="text-orange-600 dark:text-orange-400">⚠️ Near Miss</span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400">⚡ Close Encounter</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Speed info for pair events */}
              {event.type === 'pair' && event.v1Speed != null && (
                <div className="mt-2 pt-2 border-t border-gray-200/50 dark:border-slate-700/50 flex gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <span>V#{event.vehicles[0]} peak: <strong className="text-gray-700 dark:text-gray-200">{event.v1Speed.toFixed(1)} km/h</strong></span>
                  <span>V#{event.vehicles[1]} peak: <strong className="text-gray-700 dark:text-gray-200">{event.v2Speed.toFixed(1)} km/h</strong></span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

function App() {
  const [activeTab, setActiveTab] = useState('upload');
  const [videoFile, setVideoFile] = useState(null);
  const [analysisId, setAnalysisId] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [graphData, setGraphData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [useGpu, setUseGpu] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [isLiveStream, setIsLiveStream] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const outputVideoRef = useRef(null);
  const wsRef = useRef(null);
  const captureIntervalRef = useRef(null);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) {
        return savedTheme === 'dark';
      }
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // Function to poll the backend for analysis status
  const pollStatus = async (id) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/analyses/${id}/status/`);
        const data = await response.json();
        
        setAnalysisData(data);
        setProgress(data.progress);
        
        if (data.status === 'completed') {
          clearInterval(interval);
          setIsProcessing(false);
          loadVehicles(id);
          loadGraphData(id);
          setActiveTab('results'); 
        } else if (data.status === 'failed') {
          clearInterval(interval);
          setIsProcessing(false);
          alert('Processing failed: ' + data.error_message);
        }
      } catch (error) {
        console.error('Error polling status:', error);
      }
    }, 2000);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file);
    } else {
      alert('Please select a valid video file');
    }
  };

  const handleSubmit = async () => {
    if (!videoFile) {
      alert('Please select a video file');
      return;
    }

    const formData = new FormData();
    formData.append('video_file', videoFile);
    formData.append('is_live', false);
    formData.append('use_gpu', useGpu);

    setIsProcessing(true);
    setProgress(0);

    try {
      const response = await fetch(`${API_BASE_URL}/api/analyses/`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Server error:', errorData);
        throw new Error(errorData.error || 'Failed to upload video');
      }

      const data = await response.json();
      
      if (!data.id) {
        throw new Error('No analysis ID returned from server');
      }
      
      console.log('Analysis created:', data);
      setAnalysisId(data.id);
      pollStatus(data.id);
    } catch (error) {
      console.error('Error uploading video:', error);
      alert('Error uploading video: ' + error.message);
      setIsProcessing(false);
    }
  };

  const loadVehicles = async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/analyses/${id}/vehicles/`);
      const data = await response.json();
      setVehicles(data);
    } catch (error) {
      console.error('Error loading vehicles:', error);
    }
  };

  const loadGraphData = async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/analyses/${id}/graph_data/`);
      const data = await response.json();
      setGraphData(data);
    } catch (error) {
      console.error('Error loading graph data:', error);
    }
  };

  const downloadFile = async (type) => {
    if (!analysisId) return;
    
    const endpoints = {
      video: 'download_video',
      clip: 'download_clip',
      csv: 'download_csv'
    };

    try {
      const response = await fetch(`${API_BASE_URL}/api/analyses/${analysisId}/${endpoints[type]}/?download=1`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_${analysisId}.${type === 'csv' ? 'csv' : 'mp4'}`;
      a.click();
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('File not available or error downloading');
    }
  };

  const drawDetections = (vehiclesList, accidentDetected) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Match canvas coordinate space to actual video resolution
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw vehicles
    vehiclesList.forEach(vehicle => {
      const [x1, y1, x2, y2] = vehicle.bbox;
      const width = x2 - x1;
      const height = y2 - y1;

      // Select color
      let color = '#22c55e'; // green
      if (vehicle.color === 'red') {
        color = '#ef4444'; // red
      } else if (vehicle.color === 'blue') {
        color = '#3b82f6'; // blue
      }

      // Draw bounding box
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(x1, y1, width, height);

      // Draw label background
      ctx.fillStyle = color;
      const label = `ID: ${vehicle.id} | ${vehicle.speed} km/h | ${Math.round(vehicle.probability * 100)}%`;
      ctx.font = 'bold 16px sans-serif';
      const textWidth = ctx.measureText(label).width;
      ctx.fillRect(x1 - 1, y1 - 25, textWidth + 10, 25);

      // Draw text
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, x1 + 4, y1 - 7);
    });

    // Draw flashing accident alert banner if detected
    if (accidentDetected) {
      const flash = Math.floor(Date.now() / 500) % 2 === 0;
      if (flash) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.85)'; // semi-transparent red
        ctx.fillRect(10, 10, canvas.width - 20, 60);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚠️ CRITICAL COLLISION WARNING / ACCIDENT DETECTED ⚠️', canvas.width / 2, 48);
        ctx.textAlign = 'left'; // restore default
      }
    }
  };

  const startLiveStream = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Camera access not supported');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsLiveStream(true);
      }

      // Initialize WebSocket connection dynamically matching backend host
      const WS_BASE_URL = API_BASE_URL.replace(/^http/, 'ws');
      const ws = new WebSocket(`${WS_BASE_URL}/ws/live/`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected to live detection');
        // Let the backend know we are streaming at 10 FPS
        ws.send(JSON.stringify({ type: 'config', fps: 10.0 }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'detection') {
            drawDetections(data.vehicles, data.accident_detected);
          } else if (data.type === 'model_loaded') {
            console.log('Live stream model loaded:', data.message);
          } else if (data.type === 'error') {
            console.error('Live stream backend error:', data.message);
          }
        } catch (err) {
          console.error('Error parsing live stream message:', err);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected from live detection');
      };

      ws.onerror = (error) => {
        console.error('WebSocket live detection error:', error);
      };

      // Set up capturing loop (draw feed to offscreen canvas and pipe JPEG compressed base64 over WS)
      const offscreenCanvas = document.createElement('canvas');
      const offscreenCtx = offscreenCanvas.getContext('2d');

      captureIntervalRef.current = setInterval(() => {
        if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
          const videoWidth = videoRef.current.videoWidth;
          const videoHeight = videoRef.current.videoHeight;
          if (videoWidth && videoHeight && offscreenCtx) {
            offscreenCanvas.width = videoWidth;
            offscreenCanvas.height = videoHeight;
            offscreenCtx.drawImage(videoRef.current, 0, 0, videoWidth, videoHeight);
            
            // Compress image to JPEG format with 0.6 quality to maximize socket frame rate
            const jpegData = offscreenCanvas.toDataURL('image/jpeg', 0.6);
            
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({
                type: 'frame',
                frame: jpegData
              }));
            }
          }
        }
      }, 100);

    } catch (error) {
      console.error('Error accessing camera or starting live detection:', error);
      alert('Could not start live detection');
      stopLiveStream();
    }
  };

  const stopLiveStream = () => {
    // Clear capture interval
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Stop all media stream tracks
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }

    // Clear overlay canvas
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    setIsLiveStream(false);
  };

  const VehicleCard = ({ vehicle }) => {
    const isAccident = vehicle.is_accident_vehicle;
    
    return (
      <div 
        className={`p-4 rounded-lg cursor-pointer transition-all ${
          isAccident 
            ? 'bg-red-50 dark:bg-red-900/30 border-2 border-red-500 dark:border-red-700' 
            : 'bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 hover:border-rose-400 dark:hover:border-rose-500'
        } ${selectedVehicle?.vehicle_id === vehicle.vehicle_id ? 'ring-2 ring-rose-500 dark:ring-rose-400' : ''}`}
        onClick={() => setSelectedVehicle(vehicle)}
      >
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Vehicle #{vehicle.vehicle_id}</h3>
          {isAccident && (
            <span className="bg-red-500 text-white px-2 py-1 rounded text-xs font-bold">
              ACCIDENT
            </span>
          )}
        </div>
        <div className="space-y-1 text-sm">
          <p><span className="font-semibold">Avg Speed:</span> {vehicle.avg_speed_kmh.toFixed(1)} km/h</p>
          <p><span className="font-semibold">Max Speed:</span> {vehicle.max_speed_kmh.toFixed(1)} km/h</p>
          <p><span className="font-semibold">Max Probability:</span> {(vehicle.max_probability * 100).toFixed(1)}%</p>
          <p><span className="font-semibold">Frames Tracked:</span> {vehicle.frames_tracked}</p>
        </div>
      </div>
    );
  };

  const SpeedChart = ({ vehicle }) => {
    if (!vehicle?.speed_history || vehicle.speed_history.length === 0) {
      return <div className="text-gray-500 dark:text-gray-400 text-center py-8">No speed data available</div>;
    }

    const fps = analysisData?.fps || 25;
    const mappedData = vehicle.speed_history.map(d => ({
      ...d,
      time: parseFloat((d.frame / fps).toFixed(1))
    }));

    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={mappedData} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#475569' : '#e5e7eb'} />
          <XAxis 
            dataKey="time" 
            tick={{ fill: isDarkMode ? '#94a3b8' : '#4b5563' }} 
            label={{ value: 'Time (Seconds)', position: 'insideBottom', offset: -10, fill: isDarkMode ? '#cbd5e1' : '#475569', fontSize: 14 }}
          />
          <YAxis 
            domain={[0, 'auto']} 
            tick={{ fill: isDarkMode ? '#94a3b8' : '#4b5563' }} 
            label={{ value: 'Speed (km/h)', angle: -90, position: 'insideLeft', fill: isDarkMode ? '#cbd5e1' : '#475569', fontSize: 14, style: { textAnchor: 'middle' } }}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', borderColor: isDarkMode ? '#334155' : '#e5e7eb', color: isDarkMode ? '#f5f5f4' : '#1f2937' }} 
            formatter={(value) => [`${value} km/h`, 'Speed']} 
            labelFormatter={(label) => `Time: ${label}s`}
          />
          <Legend wrapperStyle={{ color: isDarkMode ? '#94a3b8' : '#4b5563', paddingTop: '20px' }} />
          <Line type="monotone" dataKey="speed" stroke={isDarkMode ? '#fb7185' : '#e11d48'} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  const ProbabilityChart = ({ vehicle }) => {
    if (!vehicle?.probability_history || vehicle.probability_history.length === 0) {
      return <div className="text-gray-500 dark:text-gray-400 text-center py-8">No probability data available</div>;
    }

    const fps = analysisData?.fps || 25;
    // Convert probabilities to percentages for display and frames to seconds
    const mappedData = vehicle.probability_history.map(d => ({
      ...d,
      prob_percent: parseFloat((d.probability * 100).toFixed(1)),
      time: parseFloat((d.frame / fps).toFixed(1))
    }));

    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={mappedData} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#475569' : '#e5e7eb'} />
          <XAxis 
            dataKey="time" 
            tick={{ fill: isDarkMode ? '#94a3b8' : '#4b5563' }} 
            label={{ value: 'Time (Seconds)', position: 'insideBottom', offset: -10, fill: isDarkMode ? '#cbd5e1' : '#475569', fontSize: 14 }}
          />
          <YAxis 
            domain={[0, 100]} 
            tick={{ fill: isDarkMode ? '#94a3b8' : '#4b5563' }} 
            label={{ value: 'Probability (%)', angle: -90, position: 'insideLeft', fill: isDarkMode ? '#cbd5e1' : '#475569', fontSize: 14, style: { textAnchor: 'middle' } }}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', borderColor: isDarkMode ? '#334155' : '#e5e7eb', color: isDarkMode ? '#f5f5f4' : '#1f2937' }} 
            formatter={(value) => [`${value}%`, 'Probability']} 
            labelFormatter={(label) => `Time: ${label}s`}
          />
          <Legend wrapperStyle={{ color: isDarkMode ? '#94a3b8' : '#4b5563', paddingTop: '20px' }} />
          <Line type="monotone" dataKey="prob_percent" name="Probability" stroke={isDarkMode ? '#f87171' : '#ef4444'} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    );
  };



  const VehicleComparisonChart = () => {
    if (!graphData?.vehicles || graphData.vehicles.length === 0) {
      return <div className="text-gray-500 dark:text-gray-400 text-center py-8">No data available</div>;
    }

    const data = graphData.vehicles.map(v => ({
      id: `V${v.id}`,
      speed: parseFloat(v.avg_speed.toFixed(1)),
      probability: parseFloat((v.max_probability * 100).toFixed(1)),
      isAccident: v.is_accident || v.is_accident_vehicle
    }));

    return (
      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#475569' : '#e5e7eb'} />
          <XAxis dataKey="id" tick={{ fill: isDarkMode ? '#94a3b8' : '#4b5563' }} />
          <YAxis yAxisId="left" orientation="left" stroke={isDarkMode ? '#fb7185' : '#e11d48'} domain={[0, 'auto']} />
          <YAxis yAxisId="right" orientation="right" stroke={isDarkMode ? '#f87171' : '#ef4444'} domain={[0, 100]} />
          <Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', borderColor: isDarkMode ? '#334155' : '#e5e7eb', color: isDarkMode ? '#f5f5f4' : '#1f2937' }} />
          <Legend wrapperStyle={{ color: isDarkMode ? '#94a3b8' : '#4b5563' }} />
          <Bar yAxisId="left" dataKey="speed" name="Avg Speed (km/h)">
            {data.map((entry, index) => (
              <Cell key={`cell-speed-${index}`} fill={entry.isAccident ? (isDarkMode ? '#fca5a5' : '#ffe4e6') : (isDarkMode ? '#fb7185' : '#e11d48')} />
            ))}
          </Bar>
          <Bar yAxisId="right" dataKey="probability" name="Max Probability (%)">
             {data.map((entry, index) => (
              <Cell key={`cell-prob-${index}`} fill={entry.isAccident ? (isDarkMode ? '#ef4444' : '#dc2626') : (isDarkMode ? '#f87171' : '#fca5a5')} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-slate-950 dark:via-indigo-950 dark:to-slate-900 transition-colors duration-500">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <header className="mb-10 flex flex-col md:flex-row justify-between items-center bg-white/40 dark:bg-slate-900/40 backdrop-blur-lg p-6 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 dark:border-slate-700/50">
          <div className="flex items-center gap-4 mb-4 md:mb-0">
            <div className="p-1 bg-gradient-to-br from-rose-500 to-indigo-600 rounded-xl shadow-lg flex items-center justify-center">
              <img src={logo} alt="Accidetect Logo" className="w-10 h-10 object-cover rounded-lg" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300">
                Accidetect
              </h1>
              <p className="text-gray-500 dark:text-gray-400 font-medium tracking-wide">AI-powered tracking & prediction</p>
            </div>
          </div>
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-3 rounded-xl bg-white/80 dark:bg-slate-800/80 text-gray-800 dark:text-yellow-400 shadow-sm border border-gray-100 dark:border-slate-700 hover:scale-105 transition-transform"
            aria-label="Toggle Dark Mode"
          >
            {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
          </button>
        </header>

        <div className="flex flex-wrap gap-3 mb-8">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
              activeTab === 'upload'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30 scale-105'
                : 'bg-white/60 text-gray-700 hover:bg-white/80 dark:bg-slate-800/60 dark:text-gray-300 dark:hover:bg-slate-800 backdrop-blur-md'
            }`}
          >
            <Upload className="inline-block mr-2" size={20} />
            Upload Video
          </button>
          <button
            onClick={() => setActiveTab('live')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
              activeTab === 'live'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30 scale-105'
                : 'bg-white/60 text-gray-700 hover:bg-white/80 dark:bg-slate-800/60 dark:text-gray-300 dark:hover:bg-slate-800 backdrop-blur-md'
            }`}
          >
            <Camera className="inline-block mr-2" size={20} />
            Live Stream
          </button>
          {analysisData && (
            <button
              onClick={() => setActiveTab('results')}
              className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
                activeTab === 'results'
                  ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg shadow-rose-500/30 scale-105'
                  : 'bg-white/60 text-gray-700 hover:bg-white/80 dark:bg-slate-800/60 dark:text-gray-300 dark:hover:bg-slate-800 backdrop-blur-md'
              }`}
            >
              <FileText className="inline-block mr-2" size={20} />
              Results Overview
            </button>
          )}
        </div>

        {activeTab === 'upload' && (
          <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 dark:border-slate-700/50 p-8 transition-all duration-300">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Upload Video</h2>
              <div className="flex items-center gap-3 bg-gray-100 dark:bg-slate-700 p-2 rounded-xl">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300 flex items-center">
                  <Cpu size={16} className="mr-1" /> CPU
                </span>
                <button 
                  onClick={() => setUseGpu(!useGpu)}
                  className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ease-in-out flex ${useGpu ? 'bg-indigo-500 justify-end' : 'bg-gray-300 dark:bg-gray-600 justify-start'}`}
                  aria-label="Toggle GPU"
                >
                  <div className="bg-white w-4 h-4 rounded-full shadow-md transform transition-transform"></div>
                </button>
                <span className={`text-sm font-medium flex items-center ${useGpu ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-300'}`}>
                  <Zap size={16} className="mr-1" /> GPU Fast
                </span>
              </div>
            </div>
            
            <div className="border-2 border-dashed border-indigo-200 dark:border-slate-600 bg-white/50 dark:bg-slate-900/50 rounded-xl p-12 text-center hover:bg-indigo-50/50 dark:hover:bg-slate-800 transition-colors backdrop-blur-sm">
              <input
                type="file"
                accept="video/*"
                onChange={handleFileUpload}
                className="hidden"
                id="video-upload"
                disabled={isProcessing}
              />
              <label htmlFor="video-upload" className="cursor-pointer">
                <Video className="mx-auto mb-4 text-indigo-400 dark:text-indigo-500" size={64} />
                <p className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">
                  {videoFile ? videoFile.name : 'Drag & drop or click to upload'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Supports MP4, AVI, MOV up to 500MB
                </p>
              </label>
            </div>

            {videoFile && !isProcessing && (
              <button
                onClick={handleSubmit}
                className="mt-8 w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-indigo-500/40 transform hover:-translate-y-1 transition-all duration-300"
              >
                Launch Analysis
              </button>
            )}

            {isProcessing && (
              <div className="mt-8 p-6 bg-white dark:bg-slate-900 rounded-xl shadow-inner border border-gray-100 dark:border-slate-800">
                <div className="flex justify-between mb-3 text-gray-800 dark:text-gray-200">
                  <span className="text-sm font-bold flex items-center">
                    <Activity className="animate-spin mr-2" size={16} /> 
                    Processing Video
                  </span>
                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{progress}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-4 text-center italic">
                  {progress < 30 && 'Loading AI model weights...'}
                  {progress >= 30 && progress < 70 && 'Tracing vehicle trajectories...'}
                  {progress >= 70 && progress < 100 && 'Calculating collision probabilities...'}
                  {progress === 100 && 'Rendering final video annotations...'}
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'live' && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8 transition-colors duration-300">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">Live Stream Detection</h2>
            
            <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full"
              />
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full"
              />
            </div>

            <div className="mt-6 flex gap-4">
              {!isLiveStream ? (
                <button
                  onClick={startLiveStream}
                  className="flex-1 bg-green-600 text-white py-4 rounded-lg font-semibold hover:bg-green-700 transition-all shadow-lg"
                >
                  <Play className="inline-block mr-2" size={20} />
                  Start Live Detection
                </button>
              ) : (
                <button
                  onClick={stopLiveStream}
                  className="flex-1 bg-red-600 text-white py-4 rounded-lg font-semibold hover:bg-red-700 transition-all shadow-lg"
                >
                  <Square className="inline-block mr-2" size={20} />
                  Stop Detection
                </button>
              )}
            </div>

            <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700/50 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <AlertTriangle className="inline-block mr-2" size={16} />
                Live stream detection requires a webcam or IP camera. The system will process frames in real-time.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'results' && analysisData && (
          <div className="space-y-6">
            {/* Video Players Section - Side by Side Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Processed Video Output */}
              <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 dark:border-slate-700/50 p-6 transition-colors duration-300">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center">
                  <Video className="mr-2 text-indigo-500" /> Processed View
                </h2>

                <div className="mx-auto w-full">
                  <div className="relative bg-black rounded-lg overflow-hidden mb-3" style={{ aspectRatio: '16/9' }}>
                    <video
                      ref={outputVideoRef}
                      controls
                      className="w-full h-full"
                      src={`${API_BASE_URL}/api/analyses/${analysisId}/download_video/`}
                      crossOrigin="anonymous"
                    >
                      Your browser does not support the video tag.
                    </video>
                  </div>

                  <div className="flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <PlayCircle size={14} />
                    <span>Use video controls to play, pause, and seek through the processed video</span>
                  </div>
                </div>
              </div>

              {/* Accident Clip Player (if accident detected) */}
              {analysisData.accident_detected && (
                <div className="bg-red-50/80 dark:bg-red-900/30 backdrop-blur-xl border border-red-200 dark:border-red-800/50 rounded-2xl shadow-xl shadow-red-500/10 p-6 flex flex-col justify-between transition-colors duration-300">
                  <div>
                    <h2 className="text-xl font-bold mb-4 text-red-700 dark:text-red-400 flex items-center">
                      <AlertTriangle className="mr-2 animate-bounce" size={24} />
                      Accident Event
                    </h2>

                    <div className="mx-auto w-full">
                      <div className="relative bg-black rounded-lg overflow-hidden mb-3" style={{ aspectRatio: '16/9' }}>
                        <video
                          controls
                          className="w-full h-full"
                          src={`${API_BASE_URL}/api/analyses/${analysisId}/download_clip/`}
                          crossOrigin="anonymous"
                        >
                          Your browser does not support the video tag.
                        </video>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-2 text-xs text-red-600 mt-2">
                    <AlertTriangle size={14} />
                    <span>Accident detected at frame {analysisData.accident_frame} ({analysisData.accident_timestamp?.toFixed(2)}s)</span>
                  </div>
                </div>
              )}
            </div>

            {/* Analysis Summary */}
            <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 dark:border-slate-700/50 p-8 transition-colors duration-300">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">Analysis Summary</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="p-5 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-slate-700 dark:to-slate-800 border border-indigo-100 dark:border-slate-600 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                  <p className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">Total Vehicles</p>
                  <p className="text-4xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-2">{vehicles.length}</p>
                </div>
                <div className="p-5 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/30 border border-emerald-100 dark:border-emerald-800/50 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                  <p className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">Status</p>
                  <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-3">{analysisData.status.toUpperCase()}</p>
                </div>
                <div className={`p-5 rounded-xl border shadow-sm hover:shadow-md transition-shadow ${analysisData.accident_detected ? 'bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/30 dark:to-rose-900/30 border-red-200 dark:border-red-800/50' : 'bg-gradient-to-br from-gray-50 to-slate-50 dark:from-slate-700 dark:to-slate-800 border-gray-200 dark:border-slate-600'}`}>
                  <p className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">Accident Status</p>
                  <p className={`text-2xl font-extrabold mt-3 ${analysisData.accident_detected ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    {analysisData.accident_detected ? 'DETECTED' : 'SAFE'}
                  </p>
                </div>
                <div className="p-5 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/30 dark:to-cyan-900/30 border border-blue-100 dark:border-blue-800/50 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                  <p className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">Processed Frames</p>
                  <p className="text-4xl font-extrabold text-blue-600 dark:text-blue-400 mt-2">{analysisData.total_frames}</p>
                </div>
              </div>

              {/* Dynamic Speed Safety & Insights Cards */}
              <SafetyInsights vehiclesList={vehicles} />

              <div className="flex flex-wrap gap-4 justify-start">
                <button
                  onClick={() => downloadFile('video')}
                  className="px-6 bg-rose-600 text-white py-3 rounded-lg font-semibold hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600 transition-all shadow-sm"
                >
                  <Download className="inline-block mr-2" size={20} />
                  Download Video
                </button>
                {analysisData.accident_detected && (
                  <button
                    onClick={() => downloadFile('clip')}
                    className="px-6 bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 transition-all shadow-sm"
                  >
                    <Download className="inline-block mr-2" size={20} />
                    Download Accident Clip
                  </button>
                )}
                <button
                  onClick={() => downloadFile('csv')}
                  className="px-6 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 transition-all shadow-sm"
                >
                  <Download className="inline-block mr-2" size={20} />
                  Download CSV
                </button>
              </div>
            </div>

            {/* Close Calls Threat Intelligence Timeline */}
            <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 dark:border-slate-700/50 p-8 transition-colors duration-300">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Threat Intelligence Timeline</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Chronological breakdown of high-risk vehicle encounters, close calls, and impact events.</p>
              <CloseCallTimeline vehiclesList={vehicles} fps={analysisData?.fps} analysisData={analysisData} />
            </div>

            {/* Charts Section */}
            <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 dark:border-slate-700/50 p-8 transition-colors duration-300">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">Vehicle Comparison</h2>
              <VehicleComparisonChart />
            </div>

            {/* Vehicle Details */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 dark:border-slate-700/50 p-6 transition-colors duration-300">
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Tracked Vehicles</h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {vehicles.map(vehicle => (
                    <VehicleCard key={vehicle.vehicle_id} vehicle={vehicle} />
                  ))}
                </div>
              </div>

              {selectedVehicle && (
                <div className="lg:col-span-2 bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 dark:border-slate-700/50 p-6 transition-colors duration-300 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center justify-between flex-wrap gap-2">
                      <span>Vehicle #{selectedVehicle.vehicle_id} Details</span>
                      {selectedVehicle.is_accident_vehicle && (
                        <span className="bg-red-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold font-mono tracking-wider shadow-sm animate-pulse">
                          ACCIDENT INVOLVED
                        </span>
                      )}
                    </h3>
                    
                    {/* Trajectory map space */}
                    <div className="mb-8 bg-white/30 dark:bg-slate-900/30 backdrop-blur-md rounded-xl p-5 border border-white/40 dark:border-slate-700/30">
                      <h4 className="font-bold text-sm text-gray-600 dark:text-gray-300 mb-4 uppercase tracking-wider">📍 Trajectory Projection Space</h4>
                      <TrajectoryMap vehicle={selectedVehicle} isDarkMode={isDarkMode} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-bold text-sm text-gray-600 dark:text-gray-300 mb-3 uppercase tracking-wider">📈 Speed Profile</h4>
                        <SpeedChart vehicle={selectedVehicle} />
                      </div>
                      
                      <div>
                        <h4 className="font-bold text-sm text-gray-600 dark:text-gray-300 mb-3 uppercase tracking-wider">📉 Risk Probability Log</h4>
                        <ProbabilityChart vehicle={selectedVehicle} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;