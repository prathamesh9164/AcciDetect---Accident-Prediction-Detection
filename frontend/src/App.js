import React, { useState, useEffect, useRef } from 'react';
import { Upload, Video, Activity, Download, FileText, AlertTriangle, Play, Square, Camera, PlayCircle, Sun, Moon, Cpu, Zap } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

const API_BASE_URL = 'http://localhost:8000';

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
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Could not access camera');
    }
  };

  const stopLiveStream = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsLiveStream(false);
    }
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
            <div className="p-3 bg-gradient-to-br from-rose-500 to-indigo-600 rounded-xl shadow-lg text-white">
              <Activity size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300">
                AcciDetect System
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
                      <AlertTriangle className="mr-2" size={24} />
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

              <div className="flex flex-wrap gap-4 justify-start">
                <button
                  onClick={() => downloadFile('video')}
                  className="px-6 bg-rose-600 text-white py-3 rounded-lg font-semibold hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600 transition-all"
                >
                  <Download className="inline-block mr-2" size={20} />
                  Download Video
                </button>
                {analysisData.accident_detected && (
                  <button
                    onClick={() => downloadFile('clip')}
                    className="px-6 bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 transition-all"
                  >
                    <Download className="inline-block mr-2" size={20} />
                    Download Accident Clip
                  </button>
                )}
                <button
                  onClick={() => downloadFile('csv')}
                  className="px-6 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 transition-all"
                >
                  <Download className="inline-block mr-2" size={20} />
                  Download CSV
                </button>
              </div>
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
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 transition-colors duration-300">
                  <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                    Vehicle #{selectedVehicle.vehicle_id} Details
                    {selectedVehicle.is_accident_vehicle && (
                      <span className="ml-3 bg-red-500 dark:bg-red-600 text-white px-3 py-1 rounded text-sm">
                        ACCIDENT VEHICLE
                      </span>
                    )}
                  </h3>
                  
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-semibold mb-3">Speed Over Time</h4>
                      <SpeedChart vehicle={selectedVehicle} />
                    </div>
                    
                    <div>
                      <h4 className="font-semibold mb-3">Accident Probability Over Time</h4>
                      <ProbabilityChart vehicle={selectedVehicle} />
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