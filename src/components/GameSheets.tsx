import React, { useState, useEffect } from "react";
import { 
  X, 
  Sparkles, 
  Compass, 
  Heart, 
  Wind, 
  BookOpen, 
  ArrowRight, 
  Check, 
  History,
  Info 
} from "lucide-react";
import { 
  ActiveSheet, 
  ReflectionResponse, 
  MiracleResponse, 
  JournalResponse, 
  DiscoveredMiracle 
} from "../types";
import { playSoundConfirm, playSoundReward, playSoundError, playSoundEnter } from "../lib/audio";

interface GameSheetsProps {
  activeSheet: ActiveSheet;
  onClose: () => void;
  onAddSparkles: (amount: number, reason: string) => void;
  discoveredMiracles: DiscoveredMiracle[];
  onAddMiracle: (miracle: DiscoveredMiracle) => void;
}

export const GameSheets: React.FC<GameSheetsProps> = ({
  activeSheet,
  onClose,
  onAddSparkles,
  discoveredMiracles,
  onAddMiracle,
}) => {
  // Loading and Error states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Altar (Breathing) state
  const [breathPhase, setBreathPhase] = useState<'idle' | 'inhale' | 'holdIn' | 'exhale' | 'holdOut'>('idle');
  const [breathTimer, setBreathTimer] = useState(4);
  const [breathCyclesCompleted, setBreathCyclesCompleted] = useState(0);

  // Obelisk (Reflection) state
  const [reflectionFocus, setReflectionFocus] = useState("Silence");
  const [reflectionInput, setReflectionInput] = useState("");
  const [reflectionResult, setReflectionResult] = useState<ReflectionResponse | null>(null);

  // Well (Journal / Offering) state
  const [journalInput, setJournalInput] = useState("");
  const [journalResult, setJournalResult] = useState<JournalResponse | null>(null);
  const [showWellAnimation, setShowWellAnimation] = useState(false);

  // Portal (Miracle Search) state
  const [portalCategory, setPortalCategory] = useState("Human Kindness");
  const [miracleResult, setMiracleResult] = useState<MiracleResponse | null>(null);

  // Reset states on sheet change
  useEffect(() => {
    setErrorMsg(null);
    setLoading(false);
    // Reset breathing
    setBreathPhase('idle');
    setBreathCyclesCompleted(0);
    // Reset obelisk
    setReflectionResult(null);
    setReflectionInput("");
    // Reset well
    setJournalResult(null);
    setJournalInput("");
    setShowWellAnimation(false);
    // Reset portal
    setMiracleResult(null);
  }, [activeSheet]);

  // Handle breathing cycle ticks
  useEffect(() => {
    if (activeSheet !== "altar" || breathPhase === "idle") return;

    const interval = setInterval(() => {
      setBreathTimer((prev) => {
        if (prev <= 1) {
          // Change phase
          if (breathPhase === "inhale") {
            setBreathPhase("holdIn");
            return 4;
          } else if (breathPhase === "holdIn") {
            setBreathPhase("exhale");
            return 4;
          } else if (breathPhase === "exhale") {
            setBreathPhase("holdOut");
            return 4;
          } else {
            // holdOut complete - cycle finishes!
            setBreathCyclesCompleted((c) => c + 1);
            onAddSparkles(15, "Completed one full cycle of serene breath alignment");
            playSoundReward();
            setBreathPhase("inhale");
            return 4;
          }
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [breathPhase, activeSheet]);

  // 1. Submit Obelisk Search
  const handleSeekTruth = async () => {
    if (!reflectionInput.trim()) {
      playSoundError();
      setErrorMsg("Please express what your heart seeks in the silence.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    playSoundConfirm();

    try {
      const res = await fetch("/api/reflect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: reflectionFocus, input: reflectionInput }),
      });
      if (!res.ok) throw new Error("The house is quiet right now.");
      const data: ReflectionResponse = await res.json();
      setReflectionResult(data);
      onAddSparkles(10, `Gained wisdom reflecting on the theme of ${reflectionFocus}`);
      playSoundReward();
    } catch (err: any) {
      playSoundError();
      setErrorMsg(err.message || "The house could not answer just now.");
    } finally {
      setLoading(false);
    }
  };

  // 2. Submit Well Offering
  const handleOfferGratitude = async () => {
    if (!journalInput.trim()) {
      playSoundError();
      setErrorMsg("Please write down your offering before sending it into the waters.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    playSoundConfirm();

    try {
      const res = await fetch("/api/miracle/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journalText: journalInput }),
      });
      if (!res.ok) throw new Error("The waters are too turbulent.");
      const data: JournalResponse = await res.json();
      setJournalResult(data);
      setShowWellAnimation(true);
      onAddSparkles(data.sparkles, "Offered gratitude to the Well of Whispers");
    } catch (err: any) {
      playSoundError();
      setErrorMsg(err.message || "Gratitude offering failed.");
    } finally {
      setLoading(false);
    }
  };

  // 3. Submit Portal Venture
  const handleVenturePortal = async () => {
    setLoading(true);
    setErrorMsg(null);
    playSoundConfirm();

    try {
      const res = await fetch("/api/miracle/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: portalCategory }),
      });
      if (!res.ok) throw new Error("The portal did not illuminate.");
      const data: MiracleResponse = await res.json();
      setMiracleResult(data);

      // Add discovered miracle to Chronicles
      const newMiracle: DiscoveredMiracle = {
        id: Math.random().toString(36).substr(2, 9),
        title: data.title,
        category: portalCategory,
        insight: data.insight,
        sparkles: data.sparkles,
        date: new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
      };
      onAddMiracle(newMiracle);
      onAddSparkles(data.sparkles, `Discovered a miracle: ${data.title}`);
      playSoundReward();
    } catch (err: any) {
      playSoundError();
      setErrorMsg(err.message || "Failed to search the portal.");
    } finally {
      setLoading(false);
    }
  };

  if (activeSheet === "none") return null;

  return (
    <div 
      className="absolute bottom-0 left-0 right-0 z-50 flex flex-col items-center justify-end"
      style={{ pointerEvents: "none" }}
    >
      {/* Background Dim Backdrop */}
      <div 
        className="fixed inset-0 bg-[#050806]/50 backdrop-blur-sm transition-opacity duration-300"
        style={{ pointerEvents: "auto" }}
        onClick={onClose}
      />

      {/* Slide up sheet container */}
      <div 
        className="relative w-full max-w-md glass-card border-t border-white/10 rounded-t-3xl px-6 pt-5 pb-8 overflow-hidden transition-transform duration-300 transform translate-y-0"
        style={{ 
          pointerEvents: "auto", 
          maxHeight: "70vh", 
          boxShadow: "0 -8px 32px rgba(0, 0, 0, 0.45)" 
        }}
      >
        {/* Absolute Sparkling Decor */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#34D399]" />
            <h3 className="text-sm font-medium tracking-widest text-[#ECFDF5] uppercase">
              {activeSheet === "well" && "Well of Whispers"}
              {activeSheet === "obelisk" && "Obelisk of Truth"}
              {activeSheet === "portal" && "Portal of Light"}
              {activeSheet === "altar" && "Sparkle Altar"}
              {activeSheet === "history" && "Sacred Chronicles"}
              {activeSheet === "quest" && "Contemplative Quests"}
            </h3>
          </div>
          <button 
            onClick={onClose}
            onPointerEnter={playSoundEnter}
            aria-label="Close panel"
            className="p-1.5 rounded-full hover:bg-white/5 text-[#9AAFA3] hover:text-[#ECFDF5] transition-colors"
            style={{ minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body with custom overflow scroll */}
        <div className="overflow-y-auto max-h-[50vh] pr-1 custom-scroll">
          
          {errorMsg && (
            <div role="alert" className="p-3 mb-4 text-xs rounded border border-[#D7B56D]/30 bg-[#D7B56D]/10 text-[#F5F3EA]">
              {errorMsg}
            </div>
          )}

          {/* ==================== 1. OBELISK SHEET ==================== */}
          {activeSheet === "obelisk" && (
            <div className="space-y-4">
              {!reflectionResult ? (
                <>
                  <p className="text-xs text-[#9AAFA3] leading-relaxed">
                    Select a theme to anchor your awareness, then formulate your question to the monolith.
                  </p>

                  {/* Focus Picker */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-wider text-[#9AAFA3]">Anchor Theme</label>
                    <div className="grid grid-cols-3 gap-2">
                      {["Silence", "Acceptance", "Patience", "Mystery", "Alignment", "Eternity"].map((focus) => (
                        <button
                          key={focus}
                          onClick={() => {
                            setReflectionFocus(focus);
                            playSoundEnter();
                          }}
                          className={`py-2 px-1 text-xs text-center border rounded transition-all duration-150 ${
                            reflectionFocus === focus
                              ? "bg-emerald-500/25 border-[#34D399] text-[#ECFDF5]"
                              : "bg-white/5 border-white/10 text-[#9AAFA3] hover:border-white/20"
                          }`}
                        >
                          {focus}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Input field */}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-wider text-[#9AAFA3]">Your Seeking Heart</label>
                    <textarea
                      value={reflectionInput}
                      onChange={(e) => setReflectionInput(e.target.value)}
                      placeholder="e.g. 'How can I find peace when the days feel chaotic and fast?'"
                      className="w-full min-h-[70px] p-3 text-xs text-[#F7FAF8] bg-white/5 border border-white/10 rounded focus:border-[#34D399] focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Submit target */}
                  <button
                    onClick={handleSeekTruth}
                    disabled={loading}
                    className="w-full py-3 px-4 flex items-center justify-center gap-2 bg-white text-emerald-950 font-bold text-xs rounded-full transition-all duration-200 uppercase tracking-widest disabled:opacity-40 shadow-lg"
                    style={{ minHeight: 44 }}
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-emerald-950 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Seek Wisdom</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </>
              ) : (
                <div className="space-y-5 animate-fadeIn">
                  {/* Scripture */}
                  <div className="p-4 glass-card border-l-2 border-[#34D399] rounded-xl">
                    <p className="font-serif italic text-base text-[#ECFDF5] leading-relaxed">
                      {reflectionResult.scripture}
                    </p>
                  </div>

                  {/* Reflection Body */}
                  <div className="space-y-2">
                    <h4 className="text-[10px] uppercase tracking-widest text-[#9AAFA3]">Reflection</h4>
                    <p className="text-xs text-[#F7FAF8] leading-relaxed">
                      {reflectionResult.reflection}
                    </p>
                  </div>

                  {/* Action recommendation */}
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-[#34D399] shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase tracking-wider text-[#34D399] font-medium">Contemplative Action</span>
                      <p className="text-xs text-[#F7FAF8] leading-relaxed">{reflectionResult.action}</p>
                    </div>
                  </div>

                  {/* Seek again buttons */}
                  <button
                    onClick={() => setReflectionResult(null)}
                    className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-[#34D399] text-xs font-medium rounded-full transition-all tracking-wider uppercase"
                    style={{ minHeight: 44 }}
                  >
                    Formulate Another Query
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ==================== 2. WELL OF WHISPERS SHEET ==================== */}
          {activeSheet === "well" && (
            <div className="space-y-4">
              {!showWellAnimation ? (
                <>
                  <p className="text-xs text-[#9AAFA3] leading-relaxed">
                    Whisper a moment of gratitude, a simple beauty, or an act of goodness you observed today into the deep waters.
                  </p>

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-wider text-[#9AAFA3]">Your Offering of Remembrance</label>
                    <textarea
                      value={journalInput}
                      onChange={(e) => setJournalInput(e.target.value)}
                      placeholder="e.g. 'The kindness of a stranger who stopped to help carry my groceries...'"
                      className="w-full min-h-[90px] p-3 text-xs text-[#F7FAF8] bg-white/5 border border-white/10 rounded focus:border-[#34D399] focus:outline-none transition-colors"
                    />
                  </div>

                  <button
                    onClick={handleOfferGratitude}
                    disabled={loading}
                    className="w-full py-3 px-4 flex items-center justify-center gap-2 bg-white text-emerald-950 font-bold text-xs rounded-full transition-all duration-200 uppercase tracking-widest disabled:opacity-40 shadow-lg"
                    style={{ minHeight: 44 }}
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-emerald-950 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Drop Into Water</span>
                        <Compass className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </>
              ) : (
                <div 
                  className="space-y-6 text-center py-4 cursor-pointer"
                  onClick={() => {
                    setShowWellAnimation(false);
                    playSoundConfirm();
                  }}
                  title="Tap to dismiss blessing"
                >
                  {/* Radiant Water Ripple Decoration */}
                  <div className="relative w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-emerald-500/10 animate-ping" />
                    <div className="absolute w-12 h-12 rounded-full border border-[#34D399]/30 animate-pulse flex items-center justify-center">
                      <Heart className="w-5 h-5 text-[#34D399]" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] uppercase tracking-widest text-[#34D399]">Water Blessing Received</span>
                    <p className="font-serif italic text-base text-[#ECFDF5] leading-relaxed px-2">
                      {journalResult?.blessing}
                    </p>
                  </div>

                  {/* Earned spark counter */}
                  <div className="inline-flex items-center gap-1.5 py-1.5 px-3 bg-white/5 border border-white/10 rounded-full text-xs text-[#34D399] font-mono">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>+{journalResult?.sparkles} SPARKLES UNLOCKED</span>
                  </div>

                  <p className="text-[9px] text-[#9AAFA3] uppercase tracking-widest animate-pulse">
                    Tap anywhere to return to world
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ==================== 3. PORTAL OF LIGHT SHEET ==================== */}
          {activeSheet === "portal" && (
            <div className="space-y-4">
              {!miracleResult ? (
                <>
                  <p className="text-xs text-[#9AAFA3] leading-relaxed">
                    Venture into the portal to seek daily, unseen synchronicity and everyday miracles happening right now.
                  </p>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-wider text-[#9AAFA3]">Select Lens of Seeking</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: "Human Kindness", label: "Kind Connection" },
                        { id: "Nature's Architecture", label: "Nature's Geometry" },
                        { id: "Coincidence & Alignment", label: "Alignments" },
                        { id: "Visual Radiance", label: "Visual Glints" }
                      ].map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => {
                            setPortalCategory(cat.id);
                            playSoundEnter();
                          }}
                          className={`py-2.5 px-2 text-xs text-left border rounded transition-all duration-150 flex items-center gap-2 ${
                            portalCategory === cat.id
                              ? "bg-emerald-500/25 border-[#34D399] text-[#ECFDF5]"
                              : "bg-white/5 border-white/10 text-[#9AAFA3] hover:border-white/20"
                          }`}
                        >
                          <Compass className="w-3.5 h-3.5 opacity-60 text-[#34D399]" />
                          <span>{cat.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleVenturePortal}
                    disabled={loading}
                    className="w-full py-3 px-4 flex items-center justify-center gap-2 bg-white text-emerald-950 font-bold text-xs rounded-full transition-all duration-200 uppercase tracking-widest disabled:opacity-40 shadow-lg"
                    style={{ minHeight: 44 }}
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-emerald-950 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Venture Into Portal</span>
                        <Sparkles className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </>
              ) : (
                <div 
                  className="space-y-5 animate-fadeIn cursor-pointer"
                  onClick={() => {
                    setMiracleResult(null);
                    playSoundConfirm();
                  }}
                  title="Tap to return"
                >
                  <div className="p-4 glass-card border border-white/10 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-widest text-[#34D399] font-mono">Miracle Discovered</span>
                      <span className="text-[10px] text-[#9AAFA3] uppercase tracking-wider">{portalCategory}</span>
                    </div>

                    <h4 className="text-sm font-medium text-[#ECFDF5] leading-snug">{miracleResult.title}</h4>
                    
                    <p className="text-xs text-[#F7FAF8] leading-relaxed">
                      {miracleResult.description}
                    </p>

                    <div className="pt-2 border-t border-white/10">
                      <span className="text-[10px] uppercase tracking-widest text-[#9AAFA3] block">Core Insight</span>
                      <p className="font-serif italic text-xs text-[#34D399] mt-0.5">{miracleResult.insight}</p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center py-2 px-3 bg-emerald-500/10 rounded-full border border-emerald-500/20 text-xs text-[#34D399] font-mono">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>+{miracleResult.sparkles} SPARKLES ACCUMULATED</span>
                    </div>
                    <span className="text-[9px] text-[#9AAFA3] uppercase tracking-widest">Tap to close</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================== 4. BREATHING ALTAR SHEET ==================== */}
          {activeSheet === "altar" && (
            <div className="space-y-5 py-2">
              {breathPhase === "idle" ? (
                <div className="space-y-4">
                  <p className="text-xs text-[#9AAFA3] leading-relaxed">
                    Still your thoughts and align your breath with the house. Completed breath cycles reward you with genuine Miracle Sparkles (+15).
                  </p>

                  <div className="p-3.5 rounded-xl glass-card border border-white/10 space-y-2">
                    <span className="text-[10px] uppercase tracking-widest text-[#34D399] block font-medium">Contemplative Pattern</span>
                    <p className="text-xs text-[#F7FAF8] leading-relaxed">
                      Follow the glowing circle: <strong className="text-[#34D399]">Inhale</strong> (4s) → <strong className="text-[#34D399]">Hold</strong> (4s) → <strong className="text-[#34D399]">Exhale</strong> (4s) → <strong className="text-[#34D399]">Hold</strong> (4s).
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setBreathPhase("inhale");
                      setBreathTimer(4);
                      playSoundConfirm();
                    }}
                    className="w-full py-3 px-4 flex items-center justify-center gap-2 bg-white text-emerald-950 font-bold text-xs rounded-full transition-all duration-200 uppercase tracking-widest shadow-lg"
                    style={{ minHeight: 44 }}
                  >
                    <span>Begin Alignment</span>
                    <Wind className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="text-center space-y-6">
                  
                  {/* Breathing visualizer circle */}
                  <div className="relative w-36 h-36 mx-auto flex items-center justify-center">
                    {/* Ring background */}
                    <div className="absolute inset-0 rounded-full border border-white/10" />

                    {/* Expand/Contract Circle */}
                    <div 
                      className={`absolute rounded-full transition-all duration-1000 ease-in-out bg-gradient-to-br from-[#047857] to-[#34D399]`}
                      style={{
                        width: 
                          breathPhase === "inhale" ? "85%" : 
                          breathPhase === "holdIn" ? "95%" : 
                          breathPhase === "exhale" ? "20%" : "20%",
                        height: 
                          breathPhase === "inhale" ? "85%" : 
                          breathPhase === "holdIn" ? "95%" : 
                          breathPhase === "exhale" ? "20%" : "20%",
                        opacity: 
                          breathPhase === "inhale" ? 0.45 : 
                          breathPhase === "holdIn" ? 0.65 : 
                          breathPhase === "exhale" ? 0.25 : 0.15,
                        boxShadow: breathPhase === "holdIn" ? "0 0 32px rgba(52, 211, 153, 0.42)" : "none"
                      }}
                    />

                    {/* Pulse counter */}
                    <div className="relative z-10 flex flex-col items-center">
                      <span className="text-2xl font-mono text-[#ECFDF5]">{breathTimer}</span>
                      <span className="text-[10px] uppercase tracking-widest text-[#9AAFA3]">seconds</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-sm font-medium text-[#ECFDF5] uppercase tracking-wider">
                      {breathPhase === "inhale" && "Inhale deeply"}
                      {breathPhase === "holdIn" && "Hold the breath"}
                      {breathPhase === "exhale" && "Exhale slowly"}
                      {breathPhase === "holdOut" && "Hold the void"}
                    </span>
                    <p className="text-[10px] text-[#9AAFA3] tracking-wide uppercase">
                      Breath Cycles Aligned: <span className="font-mono text-[#34D399]">{breathCyclesCompleted}</span>
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setBreathPhase("idle");
                      playSoundConfirm();
                    }}
                    className="py-2 px-5 bg-white/5 border border-white/10 text-[#9AAFA3] hover:text-[#ECFDF5] text-xs font-medium rounded-full transition-all tracking-wider uppercase"
                    style={{ minHeight: 44 }}
                  >
                    Cease Meditation
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ==================== 5. HISTORY SHEET ==================== */}
          {activeSheet === "history" && (
            <div className="space-y-4">
              <p className="text-xs text-[#9AAFA3] leading-relaxed">
                Your accumulated history of discovered miracles and meaningful insights.
              </p>

              {discoveredMiracles.length === 0 ? (
                <div className="p-6 text-center border border-dashed border-white/10 rounded-xl glass-card">
                  <BookOpen className="w-6 h-6 text-[#34D399] mx-auto mb-2 opacity-60" />
                  <p className="text-xs text-[#9AAFA3]">No chronicles have been written yet. Navigate the path to seek truth.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {discoveredMiracles.map((mir) => (
                    <div key={mir.id} className="p-4 rounded-xl glass-card text-left space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] uppercase font-mono text-[#34D399]">{mir.category}</span>
                        <span className="text-[9px] font-mono text-[#9AAFA3]">{mir.date}</span>
                      </div>
                      <h4 className="text-xs font-medium text-[#ECFDF5]">{mir.title}</h4>
                      <p className="font-serif italic text-[11px] text-[#9AAFA3] leading-relaxed">
                        “{mir.insight}”
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ==================== 6. QUEST SHEET ==================== */}
          {activeSheet === "quest" && (
            <div className="space-y-4">
              <p className="text-xs text-[#9AAFA3] leading-relaxed">
                Complete contemplative quests by moving through the house to earn ultimate Miracle Sparkles.
              </p>

              <div className="space-y-3">
                <div className="p-4 rounded-xl glass-card text-left space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-[#ECFDF5]">Chronicles Explorer</span>
                    <span className="text-[10px] font-mono text-[#34D399]">+30 Sparks</span>
                  </div>
                  <p className="text-[11px] text-[#9AAFA3] leading-relaxed">
                    Discover at least 3 distinct everyday miracles through the Portal of Light.
                  </p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[9px] font-mono text-[#9AAFA3]">
                      <span>Progress</span>
                      <span>{Math.min(discoveredMiracles.length, 3)} / 3</span>
                    </div>
                    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-emerald-500 to-[#34D399] transition-all duration-300"
                        style={{ width: `${(Math.min(discoveredMiracles.length, 3) / 3) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl glass-card text-left space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-[#ECFDF5]">Mindfulness Attunement</span>
                    <span className="text-[10px] font-mono text-[#34D399]">+40 Sparks</span>
                  </div>
                  <p className="text-[11px] text-[#9AAFA3] leading-relaxed">
                    Perform silent alignment at the Sparkle Altar to steady the mind.
                  </p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[9px] font-mono text-[#9AAFA3]">
                      <span>Status</span>
                      <span className="text-[#34D399] flex items-center gap-1">
                        <Check className="w-3 h-3" /> Enabled
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
