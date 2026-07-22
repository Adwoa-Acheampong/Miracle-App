import { useState, useEffect } from "react";
import { 
  Sparkles, 
  Volume2, 
  VolumeX, 
  BookOpen, 
  HelpCircle, 
  Flame,
  Music,
  Compass
} from "lucide-react";
import { GameWorld } from "./components/GameWorld";
import { GameSheets } from "./components/GameSheets";
import { ActiveSheet, DiscoveredMiracle, SparkleHistoryItem } from "./types";
import { setMuteState, playSoundConfirm, playSoundEnter } from "./lib/audio";

export default function App() {
  // State initialization
  const [sparkles, setSparkles] = useState<number>(() => {
    const saved = localStorage.getItem("miracle_sparkles");
    return saved ? parseInt(saved, 10) : 25; // 25 initial sparks - modest and real
  });

  const [activeSheet, setActiveSheet] = useState<ActiveSheet>("none");
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [showIntro, setShowIntro] = useState<boolean>(true);

  const [discoveredMiracles, setDiscoveredMiracles] = useState<DiscoveredMiracle[]>(() => {
    const saved = localStorage.getItem("miracle_chronicles");
    return saved ? JSON.parse(saved) : [];
  });

  const [sparkleHistory, setSparkleHistory] = useState<SparkleHistoryItem[]>(() => {
    const saved = localStorage.getItem("miracle_history");
    return saved ? JSON.parse(saved) : [
      {
        id: "init",
        amount: 25,
        reason: "The house remembered your first step",
        timestamp: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
      }
    ];
  });

  // Sync state to local storage for long-term durable user-centered persistence
  useEffect(() => {
    localStorage.setItem("miracle_sparkles", sparkles.toString());
  }, [sparkles]);

  useEffect(() => {
    localStorage.setItem("miracle_chronicles", JSON.stringify(discoveredMiracles));
  }, [discoveredMiracles]);

  useEffect(() => {
    localStorage.setItem("miracle_history", JSON.stringify(sparkleHistory));
  }, [sparkleHistory]);

  // Audio system coordinator
  const toggleMute = () => {
    const targetState = !isMuted;
    setIsMuted(targetState);
    setMuteState(targetState);
    playSoundConfirm();
  };

  const handleWakeHouse = () => {
    setShowIntro(false);
    // Auto-enable audio on this direct gesture!
    setIsMuted(false);
    setMuteState(false);
    playSoundConfirm();
  };

  // Add Sparkles with clear ledger entries (anti-cheat, anti-casino)
  const addSparkles = (amount: number, reason: string) => {
    setSparkles((prev) => prev + amount);
    setSparkleHistory((prev) => [
      {
        id: Math.random().toString(36).substr(2, 9),
        amount,
        reason,
        timestamp: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
      },
      ...prev
    ]);
  };

  const addMiracle = (miracle: DiscoveredMiracle) => {
    setDiscoveredMiracles((prev) => [miracle, ...prev]);
  };

  const handleOpenSheet = (sheet: ActiveSheet) => {
    setActiveSheet(sheet);
    playSoundConfirm();
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden flex items-center justify-center text-[#F7FAF8] font-sans">
      
      {/* Mesh background and blurred colorful blobs behind everything */}
      <div className="mesh-bg">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>

      {/* 1. INTRO/SPLASH COVER (User gesture for audio activation & beautiful presentation) */}
      {showIntro ? (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#050806]/60 backdrop-blur-md px-6 text-center">
          
          <div className="relative space-y-6 max-w-sm p-8 rounded-3xl glass-card z-10">
            {/* Elegant Vector Aura Icon */}
            <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border border-emerald-500/40 animate-pulse" />
              <div className="w-12 h-12 rounded-full glass-card flex items-center justify-center">
                <Compass className="w-5 h-5 text-[#34D399]" />
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-normal tracking-[0.15em] text-[#ECFDF5] uppercase">
                MIRACLE: THE LIVING HOUSE
              </h1>
              <p className="font-serif italic text-sm text-[#9AAFA3] leading-relaxed px-4">
                “Wake the house. Decide what matters. Let the world remember.”
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={handleWakeHouse}
                onPointerEnter={playSoundEnter}
                className="py-3.5 px-8 bg-white text-emerald-950 font-bold text-xs tracking-widest rounded-full transition-all duration-300 uppercase shadow-lg select-none active:scale-95"
                style={{ minHeight: 44, minWidth: 200 }}
              >
                Wake the House
              </button>
            </div>

            <div className="pt-4 flex items-center justify-center gap-1.5 text-[10px] text-[#9AAFA3] uppercase tracking-wider">
              <Music className="w-3.5 h-3.5 text-[#34D399] animate-pulse" />
              <span>Enables synthesized ambient water sounds</span>
            </div>
          </div>
        </div>
      ) : null}

      {/* 2. THE MAIN FULL-SCREEN GAME VIEWPORT */}
      <div className="w-full h-full relative z-10" id="game-viewport">
        
        {/* HUD: Safe-area HUD - Top Edge */}
        <header className="absolute top-0 left-0 right-0 z-40 p-4 pointer-events-none flex items-center justify-between">
          
          {/* Left HUD group: Sparkle ledger state (No prefilled fake metrics) */}
          <div 
            className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 glass-card rounded-full"
            title="Miracle Sparkles Ledger"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#34D399] animate-pulse" />
            <div className="flex flex-col">
              <span className="text-[8px] uppercase tracking-wider text-[#9AAFA3] leading-none">Sparks</span>
              <span className="font-mono text-xs text-[#ECFDF5] font-semibold leading-none mt-0.5">{sparkles}</span>
            </div>
          </div>

          {/* Right HUD group: Sound and History controls */}
          <div className="pointer-events-auto flex items-center gap-2">
            
            {/* Discovered Chronicles Button */}
            <button
              onClick={() => handleOpenSheet("history")}
              onPointerEnter={playSoundEnter}
              aria-label="Open chronicles"
              className={`p-2.5 rounded-full border glass-card transition-all duration-150 flex items-center justify-center ${
                activeSheet === "history" 
                  ? "border-[#34D399] text-[#ECFDF5]"
                  : "border-white/10 text-[#9AAFA3] hover:text-[#ECFDF5]"
              }`}
              style={{ minWidth: 44, minHeight: 44 }}
              title="Sacred Chronicles"
            >
              <BookOpen className="w-4 h-4" />
            </button>

            {/* Quests Tracker Button */}
            <button
              onClick={() => handleOpenSheet("quest")}
              onPointerEnter={playSoundEnter}
              aria-label="Open quests"
              className={`p-2.5 rounded-full border glass-card transition-all duration-150 flex items-center justify-center ${
                activeSheet === "quest" 
                  ? "border-[#34D399] text-[#ECFDF5]"
                  : "border-white/10 text-[#9AAFA3] hover:text-[#ECFDF5]"
              }`}
              style={{ minWidth: 44, minHeight: 44 }}
              title="Quests Tracker"
            >
              <Flame className="w-4 h-4" />
            </button>

            {/* Ambient Synthesizer Mute Control */}
            <button
              onClick={toggleMute}
              onPointerEnter={playSoundEnter}
              aria-label={isMuted ? "Turn sound on" : "Turn sound off"}
              className={`p-2.5 rounded-full border glass-card transition-all duration-150 flex items-center justify-center ${
                !isMuted 
                  ? "border-[#34D399] text-[#34D399]"
                  : "border-white/10 text-[#9AAFA3] hover:text-[#ECFDF5]"
              }`}
              style={{ minWidth: 44, minHeight: 44 }}
              title={isMuted ? "Unmute Ambient Sound" : "Mute Ambient Sound"}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

          </div>
        </header>

        {/* The procedurally-drawn 2D interactive canvas */}
        <GameWorld 
          onInteract={(hotspotId) => handleOpenSheet(hotspotId as ActiveSheet)} 
          sparkleCount={sparkles}
        />

        {/* BOTTOM HUD HELP ACCENTS */}
        <footer className="absolute bottom-4 left-0 right-0 z-30 pointer-events-none flex flex-col items-center gap-1 text-center">
          <p className="text-[10px] text-[#9AAFA3] uppercase tracking-[0.12em] glass-card py-1.5 px-4 rounded-full">
            Tap a glowing place to move, listen, and act
          </p>
        </footer>

        {/* Context-bound overlays sheets (up to 70vh and dismissible) */}
        <GameSheets
          activeSheet={activeSheet}
          onClose={() => setActiveSheet("none")}
          onAddSparkles={addSparkles}
          discoveredMiracles={discoveredMiracles}
          onAddMiracle={addMiracle}
        />

      </div>
    </main>
  );
}
