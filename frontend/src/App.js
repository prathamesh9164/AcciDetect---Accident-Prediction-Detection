import React, { useState, useEffect, useRef } from 'react';
import { Upload, Video, Activity, Download, FileText, AlertTriangle, Play, Square, Camera, PlayCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';

const API_BASE_URL = 'http://localhost:8000';

function App() {
  const [activeTab, setActiveTab] = useState('upload');
  const [videoFile, setVideoFile] = useState(null);
  const [analysisId, setAnalysisId] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [graphData, setGraphData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [isLiveStream, setIsLiveStream] = useState(false);
  const [liveSessionId, setLiveSessionId] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const outputVideoRef = useRef(null);
  
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
            ? 'bg-red-50 border-2 border-red-500' 
            : 'bg-gray-50 border border-gray-200 hover:border-blue-400'
        } ${selectedVehicle?.vehicle_id === vehicle.vehicle_id ? 'ring-2 ring-blue-500' : ''}`}
        onClick={() => setSelectedVehicle(vehicle)}
      >
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-bold text-lg">Vehicle #{vehicle.vehicle_id}</h3>
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
      return <div className="text-gray-500 text-center py-8">No speed data available</div>;
    }

    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={vehicle.speed_history}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="frame" label={{ value: 'Frame', position: 'insideBottom', offset: -5 }} />
          <YAxis label={{ value: 'Speed (km/h)', angle: -90, position: 'insideLeft' }} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="speed" stroke="#3b82f6" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  const ProbabilityChart = ({ vehicle }) => {
    if (!vehicle?.probability_history || vehicle.probability_history.length === 0) {
      return <div className="text-gray-500 text-center py-8">No probability data available</div>;
    }

    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={vehicle.probability_history}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="frame" label={{ value: 'Frame', position: 'insideBottom', offset: -5 }} />
          <YAxis label={{ value: 'Accident Probability', angle: -90, position: 'insideLeft' }} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="probability" stroke="#ef4444" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  const VehicleComparisonChart = () => {
    if (!graphData?.vehicles || graphData.vehicles.length === 0) {
      return <div className="text-gray-500 text-center py-8">No data available</div>;
    }

    const data = graphData.vehicles.map(v => ({
      id: `V${v.id}`,
      speed: v.avg_speed,
      probability: v.max_probability * 100,
      isAccident: v.is_accident
    }));

    return (
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="id" />
          <YAxis yAxisId="left" orientation="left" stroke="#3b82f6" />
          <YAxis yAxisId="right" orientation="right" stroke="#ef4444" />
          <Tooltip />
          <Legend />
          <Bar yAxisId="left" dataKey="speed" fill="#3b82f6" name="Avg Speed (km/h)" />
          <Bar yAxisId="right" dataKey="probability" fill="#ef4444" name="Max Probability (%)" />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            <Activity className="inline-block mr-3 text-blue-600" size={40} />
            Accident Detection System
          </h1>
          <p className="text-gray-600">AI-powered vehicle tracking and accident prediction</p>
        </header>

        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              activeTab === 'upload'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Upload className="inline-block mr-2" size={20} />
            Upload Video
          </button>
          <button
            onClick={() => setActiveTab('live')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              activeTab === 'live'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Camera className="inline-block mr-2" size={20} />
            Live Stream
          </button>
          {analysisData && (
            <button
              onClick={() => setActiveTab('results')}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                activeTab === 'results'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              <FileText className="inline-block mr-2" size={20} />
              Results
            </button>
          )}
        </div>

        {activeTab === 'upload' && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-6">Upload Recorded Video</h2>
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
              <input
                type="file"
                accept="video/*"
                onChange={handleFileUpload}
                className="hidden"
                id="video-upload"
                disabled={isProcessing}
              />
              <label htmlFor="video-upload" className="cursor-pointer">
                <Video className="mx-auto mb-4 text-gray-400" size={64} />
                <p className="text-lg font-semibold text-gray-700 mb-2">
                  {videoFile ? videoFile.name : 'Click to upload video'}
                </p>
                <p className="text-sm text-gray-500">
                  Supports MP4, AVI, MOV and other video formats
                </p>
              </label>
            </div>

            {videoFile && !isProcessing && (
              <button
                onClick={handleSubmit}
                className="mt-6 w-full bg-blue-600 text-white py-4 rounded-lg font-semibold hover:bg-blue-700 transition-all shadow-lg"
              >
                Start Processing
              </button>
            )}

            {isProcessing && (
              <div className="mt-6">
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-semibold">Processing...</span>
                  <span className="text-sm font-semibold">{progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-600 mt-2 text-center">
                  {progress < 30 && 'Loading model and initializing...'}
                  {progress >= 30 && progress < 70 && 'Detecting and tracking vehicles...'}
                  {progress >= 70 && progress < 100 && 'Analyzing accident probabilities...'}
                  {progress === 100 && 'Finalizing results...'}
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'live' && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-6">Live Stream Detection</h2>
            
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

            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <AlertTriangle className="inline-block mr-2" size={16} />
                Live stream detection requires a webcam or IP camera. The system will process frames in real-time.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'results' && analysisData && (
          <div className="space-y-6">
            {/* Video Player Section */}
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h2 className="text-2xl font-bold mb-6">Processed Video Output</h2>
              
              <div className="relative bg-black rounded-lg overflow-hidden mb-4" style={{ aspectRatio: '16/9' }}>
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
              
              <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                <PlayCircle size={16} />
                <span>Use video controls to play, pause, and seek through the processed video</span>
              </div>
            </div>

            {/* Accident Clip Player (if accident detected) */}
            {analysisData.accident_detected && (
              <div className="bg-red-50 border-2 border-red-300 rounded-xl shadow-lg p-8">
                <h2 className="text-2xl font-bold mb-6 text-red-700">
                  <AlertTriangle className="inline-block mr-2" size={24} />
                  Accident Clip
                </h2>
                
                <div className="relative bg-black rounded-lg overflow-hidden mb-4" style={{ aspectRatio: '16/9' }}>
                  <video
                    controls
                    className="w-full h-full"
                    src={`${API_BASE_URL}/api/analyses/${analysisId}/download_clip/`}
                    crossOrigin="anonymous"
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
                
                <div className="flex items-center justify-center gap-2 text-sm text-red-700">
                  <AlertTriangle size={16} />
                  <span>Accident detected at frame {analysisData.accident_frame} ({analysisData.accident_timestamp?.toFixed(2)}s)</span>
                </div>
              </div>
            )}

            {/* Analysis Summary */}
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h2 className="text-2xl font-bold mb-6">Analysis Summary</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600">Total Vehicles</p>
                  <p className="text-3xl font-bold text-blue-600">{vehicles.length}</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-600">Status</p>
                  <p className="text-lg font-bold text-green-600">{analysisData.status.toUpperCase()}</p>
                </div>
                <div className={`p-4 rounded-lg ${analysisData.accident_detected ? 'bg-red-50' : 'bg-gray-50'}`}>
                  <p className="text-sm text-gray-600">Accident Detected</p>
                  <p className={`text-lg font-bold ${analysisData.accident_detected ? 'text-red-600' : 'text-gray-600'}`}>
                    {analysisData.accident_detected ? 'YES' : 'NO'}
                  </p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <p className="text-sm text-gray-600">Total Frames</p>
                  <p className="text-2xl font-bold text-purple-600">{analysisData.total_frames}</p>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => downloadFile('video')}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-all"
                >
                  <Download className="inline-block mr-2" size={20} />
                  Download Video
                </button>
                {analysisData.accident_detected && (
                  <button
                    onClick={() => downloadFile('clip')}
                    className="flex-1 bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition-all"
                  >
                    <Download className="inline-block mr-2" size={20} />
                    Download Accident Clip
                  </button>
                )}
                <button
                  onClick={() => downloadFile('csv')}
                  className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-all"
                >
                  <Download className="inline-block mr-2" size={20} />
                  Download CSV
                </button>
              </div>
            </div>

            {/* Vehicle Comparison Chart */}
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h2 className="text-2xl font-bold mb-6">Vehicle Comparison</h2>
              <VehicleComparisonChart />
            </div>

            {/* Vehicle Details */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-bold mb-4">Tracked Vehicles</h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {vehicles.map(vehicle => (
                    <VehicleCard key={vehicle.vehicle_id} vehicle={vehicle} />
                  ))}
                </div>
              </div>

              {selectedVehicle && (
                <div className="lg:col-span-2 bg-white rounded-xl shadow-lg p-6">
                  <h3 className="text-xl font-bold mb-4">
                    Vehicle #{selectedVehicle.vehicle_id} Details
                    {selectedVehicle.is_accident_vehicle && (
                      <span className="ml-3 bg-red-500 text-white px-3 py-1 rounded text-sm">
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