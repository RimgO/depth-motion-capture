import React, { useState, useEffect } from 'react';
import MotionCapturer from './components/MotionCapturer';
import { Activity, Brain, User, Upload, Settings, Info, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function App() {
  const [vrmUrl, setVrmUrl] = useState(null);
  const [useScreenCapture, setUseScreenCapture] = useState(false);
  const [detectedAction, setDetectedAction] = useState("Observing...");
  const [actionHistory, setActionHistory] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [debugLogging, setDebugLogging] = useState({
    holistic: false,
    pose: false,
    eyeGaze: false
  });
  const [captureSettings, setCaptureSettings] = useState({
    captureLowerBody: true
  });

  // Mock AI Agent Labeling logic
  const handleActionDetected = (landmarks) => {
    const rightHand = landmarks[16];
    const leftHand = landmarks[15];
    const rightShoulder = landmarks[12];
    const leftShoulder = landmarks[11];
    const head = landmarks[0];
    const hips = landmarks[24];

    let label = "Standing Idle";

    // Heuristics for detection
    const rightUp = rightHand.y < head.y;
    const leftUp = leftHand.y < head.y;
    const tPose = Math.abs(rightHand.y - rightShoulder.y) < 0.1 && Math.abs(leftHand.y - leftShoulder.y) < 0.1;
    const handsNearFace = Math.abs(rightHand.x - head.x) < 0.1 && Math.abs(rightHand.y - head.y) < 0.2;

    if (rightUp && leftUp) {
      label = "Both Hands Raised";
    } else if (tPose) {
      label = "T-Pose Detected";
    } else if (rightUp) {
      label = "Right Hand Raised";
    } else if (leftUp) {
      label = "Left Hand Raised";
    } else if (handsNearFace) {
      label = "Hand Near Face";
    } else if (hips.y > 0.8) {
      label = "Squatting / Low Guard";
    }

    if (label !== detectedAction) {
      setDetectedAction(label);
      setActionHistory(prev => [
        { id: Date.now(), time: new Date().toLocaleTimeString().split(' ')[0], action: label },
        ...prev.slice(0, 9)
      ]);
    }
  };

  const handleVrmUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVrmUrl(url);
    }
  };

  const [isMediaExpanded, setIsMediaExpanded] = useState(true);
  const [isAiExpanded, setIsAiExpanded] = useState(true);

  return (
    <div className="flex h-screen w-screen bg-[#0a0a0c] text-white overflow-hidden">
      {/* Sidebar */}
      <aside className="w-80 h-full glass-panel m-4 border-white/5 flex flex-col p-6 gap-6 z-10 overflow-hidden">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Activity className="text-white" size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight">
            Depth<span className="text-cyan-400">Capture</span>
          </h1>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar space-y-4">
          {/* Source Media Section */}
          <section className="bg-white/5 rounded-2xl border border-white/5 overflow-hidden">
            <button
              onClick={() => setIsMediaExpanded(!isMediaExpanded)}
              className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
            >
              <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest flex items-center gap-2">
                <Upload size={14} /> Source Media
              </h2>
              <motion.div animate={{ rotate: isMediaExpanded ? 180 : 0 }}>
                <Settings size={14} className="text-white/20" />
              </motion.div>
            </button>

            <motion.div
              initial={false}
              animate={{ height: isMediaExpanded ? "auto" : 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 pt-0 grid grid-cols-1 gap-3">
                <button
                  onClick={() => setUseScreenCapture(false)}
                  className={`flex flex-col items-center justify-center w-full h-16 border-2 border-dashed rounded-xl transition-all group ${!useScreenCapture ? 'border-cyan-500 bg-cyan-500/10' : 'border-white/10 hover:border-cyan-500/50 hover:bg-white/5'}`}
                >
                  <Activity className={`${!useScreenCapture ? 'text-cyan-400' : 'text-white/20 group-hover:text-cyan-400'} mb-1`} size={16} />
                  <span className={`text-[10px] ${!useScreenCapture ? 'text-cyan-400 font-bold' : 'text-white/40 group-hover:text-white/60'}`}>Webcam Feed</span>
                </button>

                <button
                  onClick={() => setUseScreenCapture(true)}
                  className={`flex flex-col items-center justify-center w-full h-16 border-2 border-dashed rounded-xl transition-all group ${useScreenCapture ? 'border-cyan-500 bg-cyan-500/10' : 'border-white/10 hover:border-cyan-500/50 hover:bg-white/5'}`}
                >
                  <Upload className={`${useScreenCapture ? 'text-cyan-400' : 'text-white/20 group-hover:text-cyan-400'} mb-1`} size={16} />
                  <span className={`text-[10px] ${useScreenCapture ? 'text-cyan-400 font-bold' : 'text-white/40 group-hover:text-white/60'}`}>Screen Capture</span>
                </button>

                <label className="flex flex-col items-center justify-center w-full h-16 border-2 border-dashed border-white/10 rounded-xl hover:border-cyan-500/50 hover:bg-white/5 transition-all cursor-pointer group">
                  <User className="text-white/20 group-hover:text-cyan-400 mb-1" size={16} />
                  <span className="text-[10px] text-white/40 group-hover:text-white/60">Upload VRM</span>
                  <input type="file" accept=".vrm" className="hidden" onChange={handleVrmUpload} />
                </label>

                <button
                  onClick={() => setVrmUrl("https://cdn.jsdelivr.net/gh/pixiv/three-vrm@master/packages/three-vrm/examples/models/VRM1_Constraint_Twist_Sample.vrm")}
                  className="flex flex-col items-center justify-center w-full h-10 border border-white/10 rounded-xl hover:bg-white/5 transition-all group"
                >
                  <span className="text-[10px] text-white/40 group-hover:text-cyan-400">Load Test Avatar</span>
                </button>
              </div>
            </motion.div>
          </section>

          {/* Capture Settings Section */}
          <section className="bg-white/5 rounded-2xl border border-white/5 overflow-hidden">
            <div className="p-4">
              <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest flex items-center gap-2 mb-3">
                <Settings size={14} /> Capture Settings
              </h2>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-white/80">Lower Body Capture</span>
                  <button
                    onClick={() => setCaptureSettings(prev => ({ ...prev, captureLowerBody: !prev.captureLowerBody }))}
                    className={`w-8 h-4 rounded-full transition-colors relative ${captureSettings.captureLowerBody ? 'bg-cyan-500' : 'bg-white/10'}`}
                  >
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${captureSettings.captureLowerBody ? 'left-4.5' : 'left-0.5'}`} style={{ left: captureSettings.captureLowerBody ? 'calc(100% - 14px)' : '2px' }} />
                  </button>
                </div>
                <div className="pt-2 border-t border-white/10">
                  <div className="text-[10px] text-white/40 uppercase font-bold tracking-wider mb-2">Debug Logging</div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-white/80">Holistic</span>
                      <button
                        onClick={() => setDebugLogging(prev => ({ ...prev, holistic: !prev.holistic }))}
                        className={`w-8 h-4 rounded-full transition-colors relative ${debugLogging.holistic ? 'bg-cyan-500' : 'bg-white/10'}`}
                      >
                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all`} style={{ left: debugLogging.holistic ? 'calc(100% - 14px)' : '2px' }} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-white/80">Pose</span>
                      <button
                        onClick={() => setDebugLogging(prev => ({ ...prev, pose: !prev.pose }))}
                        className={`w-8 h-4 rounded-full transition-colors relative ${debugLogging.pose ? 'bg-cyan-500' : 'bg-white/10'}`}
                      >
                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all`} style={{ left: debugLogging.pose ? 'calc(100% - 14px)' : '2px' }} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-white/80">Eye Gaze</span>
                      <button
                        onClick={() => setDebugLogging(prev => ({ ...prev, eyeGaze: !prev.eyeGaze }))}
                        className={`w-8 h-4 rounded-full transition-colors relative ${debugLogging.eyeGaze ? 'bg-cyan-500' : 'bg-white/10'}`}
                      >
                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all`} style={{ left: debugLogging.eyeGaze ? 'calc(100% - 14px)' : '2px' }} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Motion Recording Section */}
          <section className="bg-white/5 rounded-2xl border border-white/5 overflow-hidden">
            <div className="p-4">
              <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest flex items-center gap-2 mb-3">
                <Activity size={14} /> Recording
              </h2>
              <button
                onClick={() => setIsRecording(!isRecording)}
                className={`w-full font-bold px-4 py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all ${isRecording
                    ? 'bg-red-500 text-white shadow-red-500/30 animate-pulse'
                    : 'bg-cyan-500 text-black shadow-cyan-500/30 hover:bg-cyan-400'
                  }`}
              >
                <Activity size={18} /> {isRecording ? 'Stop Recording' : 'Start Recording'}
              </button>
              {isRecording && (
                <div className="mt-2 text-[9px] text-red-400 text-center animate-pulse tracking-widest uppercase font-bold">
                  rec ●
                </div>
              )}
            </div>
          </section>

          {/* AI Monitoring Section */}
          <section className="bg-white/5 rounded-2xl border border-white/5 overflow-hidden">
            <button
              onClick={() => setIsAiExpanded(!isAiExpanded)}
              className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
            >
              <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest flex items-center gap-2">
                <Brain size={14} /> AI Monitoring
              </h2>
              <motion.div animate={{ rotate: isAiExpanded ? 180 : 0 }}>
                <Activity size={14} className="text-white/20" />
              </motion.div>
            </button>

            <motion.div
              initial={false}
              animate={{ height: isAiExpanded ? "auto" : 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 pt-0">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs text-cyan-400 font-medium flex items-center gap-1">
                    <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                    Live Analysis
                  </span>
                </div>

                <div className="text-[10px] text-white/40 uppercase font-bold tracking-wider mb-2">Current Intent</div>
                <div className="text-sm font-bold text-white mb-4 bg-white/5 px-3 py-2 rounded-lg border border-white/5">
                  {detectedAction}
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Analysis Log</div>
                  <div className="max-h-40 overflow-y-auto no-scrollbar space-y-2">
                    <AnimatePresence initial={false}>
                      {actionHistory.map((item) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-start gap-2 text-[11px] py-1 border-b border-white/5 last:border-0"
                        >
                          <CheckCircle2 size={10} className="text-cyan-500 mt-1" />
                          <div className="flex-1 flex justify-between gap-2">
                            <span className="text-white/80">{item.action}</span>
                            <span className="text-[9px] text-white/30 whitespace-nowrap">{item.time}</span>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </motion.div>
          </section>
        </div>

        <div className="mt-auto shrink-0 space-y-3">
          <div className="bg-gradient-to-tr from-cyan-500/10 to-blue-500/10 rounded-2xl p-4 border border-cyan-500/20">
            <div className="flex items-center gap-2 mb-1">
              <Info size={14} className="text-cyan-400" />
              <span className="text-xs font-semibold">Ready to Sync</span>
            </div>
            <p className="text-[10px] text-white/40 leading-relaxed">
              Mediapipe pose engine is active.
            </p>
          </div>
        </div>
      </aside >

      {/* Main Viewport */}
      < main className="flex-1 relative" >
        <MotionCapturer
          vrmUrl={vrmUrl}
          useScreenCapture={useScreenCapture}
          onActionDetected={handleActionDetected}
          isRecording={isRecording}
          captureSettings={captureSettings}
          debugLogging={debugLogging}
          onDebugLoggingChange={setDebugLogging}
        />

        {/* HUD Overlay - Reduced */}
        <div className="absolute top-6 right-6 flex gap-4">
          <button className="glass-panel text-white/80 p-3 hover:text-white">
            <Settings size={20} />
          </button>
        </div>
      </main >
    </div >
  );
}

export default App;
