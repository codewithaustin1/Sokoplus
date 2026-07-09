import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Music, Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, ChevronDown, ChevronUp, ListMusic, X } from "lucide-react";
import toast from "react-hot-toast";

interface Track {
  id: string;
  title: string;
  description: string;
  url: string;
}

const AC_TRACKS: Track[] = [
  {
    id: "savannah-morning",
    title: "Savannah Morning",
    description: "Warm acoustic fingerstyle guitar melody",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
  },
  {
    id: "rift-valley-breeze",
    title: "Rift Valley Breeze",
    description: "Uplifting acoustic folk rhythm",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3"
  },
  {
    id: "coastal-sunset",
    title: "Coastal Sunset",
    description: "Relaxing, breezy guitar chords & soft swells",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3"
  },
  {
    id: "nairobi-folk",
    title: "Nairobi Folk Acoustic",
    description: "Rich acoustic resonance with soft percussion",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3"
  }
];

export default function AudioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrackIdx, setCurrentTrackIdx] = useState(0);
  const [volume, setVolume] = useState(0.4);
  const [isMuted, setIsMuted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showInvite, setShowInvite] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load preferences from localStorage on mount
  useEffect(() => {
    const savedIdx = localStorage.getItem("sokoplus_music_idx");
    if (savedIdx) {
      const parsed = parseInt(savedIdx, 10);
      if (parsed >= 0 && parsed < AC_TRACKS.length) {
        setCurrentTrackIdx(parsed);
      }
    }

    const savedVol = localStorage.getItem("sokoplus_music_vol");
    if (savedVol) {
      setVolume(parseFloat(savedVol));
    }

    const savedMute = localStorage.getItem("sokoplus_music_mute");
    if (savedMute) {
      setIsMuted(savedMute === "true");
    }

    // Determine if we should show the invite tooltip
    const musicInteracted = localStorage.getItem("sokoplus_music_interacted");
    if (!musicInteracted) {
      // Show inviting tooltip after 3 seconds on first visit
      const timer = setTimeout(() => {
        setShowInvite(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Sync state changes with the `<audio>` element
  useEffect(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.play().catch((err) => {
        console.warn("Autoplay blocked or playback interrupted:", err);
        setIsPlaying(false);
      });
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, currentTrackIdx]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  const handlePlayPause = () => {
    localStorage.setItem("sokoplus_music_interacted", "true");
    setShowInvite(false);
    setIsPlaying(!isPlaying);
  };

  const handleNext = () => {
    const nextIdx = (currentTrackIdx + 1) % AC_TRACKS.length;
    setCurrentTrackIdx(nextIdx);
    localStorage.setItem("sokoplus_music_idx", nextIdx.toString());
    setIsPlaying(true);
  };

  const handlePrev = () => {
    const prevIdx = (currentTrackIdx - 1 + AC_TRACKS.length) % AC_TRACKS.length;
    setCurrentTrackIdx(prevIdx);
    localStorage.setItem("sokoplus_music_idx", prevIdx.toString());
    setIsPlaying(true);
  };

  const handleSelectTrack = (idx: number) => {
    setCurrentTrackIdx(idx);
    localStorage.setItem("sokoplus_music_idx", idx.toString());
    setIsPlaying(true);
    setShowPlaylist(false);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    setIsMuted(false);
    localStorage.setItem("sokoplus_music_vol", newVol.toString());
    localStorage.setItem("sokoplus_music_mute", "false");
  };

  const handleToggleMute = () => {
    const newMute = !isMuted;
    setIsMuted(newMute);
    localStorage.setItem("sokoplus_music_mute", newMute.toString());
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleAudioEnded = () => {
    handleNext();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seekTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = seekTime;
      setCurrentTime(seekTime);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return "00:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const activeTrack = AC_TRACKS[currentTrackIdx];

  const pulsingBars = (
    <div className="flex items-end space-x-[2px] h-3.5 w-4 shrink-0 mb-[1px]">
      <motion.div
        animate={isPlaying ? { height: ["20%", "100%", "20%"] } : { height: "20%" }}
        transition={{ repeat: Infinity, duration: 0.8, ease: "easeInOut" }}
        className="w-[3px] bg-orange-600 rounded-full"
      />
      <motion.div
        animate={isPlaying ? { height: ["40%", "100%", "40%"] } : { height: "40%" }}
        transition={{ repeat: Infinity, duration: 0.5, ease: "easeInOut" }}
        className="w-[3px] bg-orange-600 rounded-full"
      />
      <motion.div
        animate={isPlaying ? { height: ["15%", "100%", "15%"] } : { height: "15%" }}
        transition={{ repeat: Infinity, duration: 0.7, ease: "easeInOut" }}
        className="w-[3px] bg-orange-600 rounded-full"
      />
    </div>
  );

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 md:left-6 z-[60] flex flex-col items-start font-sans" id="sokoplus-audio-widget">
      <audio
        ref={audioRef}
        src={activeTrack.url}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleAudioEnded}
      />

      {/* Playlist Selector Dropdown (Floating above) */}
      <AnimatePresence>
        {isExpanded && showPlaylist && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-full left-0 mb-3 w-72 bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl border border-gray-150 dark:border-gray-800 rounded-2xl shadow-2xl p-2 z-[70] overflow-hidden"
          >
            <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <span className="text-xs font-black uppercase text-gray-400 dark:text-gray-500 tracking-wider">Acoustic Playlist</span>
              <button 
                onClick={() => setShowPlaylist(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto mt-1 space-y-1">
              {AC_TRACKS.map((track, idx) => (
                <button
                  key={track.id}
                  onClick={() => handleSelectTrack(idx)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs flex items-center justify-between transition-all ${
                    idx === currentTrackIdx
                      ? "bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 font-bold"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900/60"
                  }`}
                >
                  <div className="truncate pr-2">
                    <p className="font-bold truncate">{track.title}</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium truncate mt-0.5">{track.description}</p>
                  </div>
                  {idx === currentTrackIdx && isPlaying && pulsingBars}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Invite Tooltip (Floating above) */}
      <AnimatePresence>
        {showInvite && !isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.9 }}
            className="absolute bottom-16 left-0 mb-2 w-64 bg-gray-900 text-white p-3.5 rounded-2xl shadow-xl flex items-start space-x-3 border border-white/10 z-[65]"
          >
            <div className="bg-orange-600 p-2 rounded-xl text-white shrink-0">
              <Music size={16} className="animate-bounce" />
            </div>
            <div className="space-y-1 flex-1">
              <h4 className="text-xs font-black leading-none">Acoustic Ambient Radio</h4>
              <p className="text-[10px] text-gray-300 leading-normal">
                Enjoy warm, local acoustic melodies while browsing handcrafts.
              </p>
              <div className="flex space-x-2 mt-2">
                <button
                  onClick={() => {
                    handlePlayPause();
                    setIsExpanded(true);
                  }}
                  className="bg-orange-600 hover:bg-orange-500 text-white text-[10px] font-black uppercase px-2.5 py-1 rounded-lg transition-all"
                >
                  Listen
                </button>
                <button
                  onClick={() => {
                    localStorage.setItem("sokoplus_music_interacted", "true");
                    setShowInvite(false);
                  }}
                  className="text-gray-400 hover:text-white text-[10px] font-bold px-1 py-1"
                >
                  Dismiss
                </button>
              </div>
            </div>
            <button
              onClick={() => {
                localStorage.setItem("sokoplus_music_interacted", "true");
                setShowInvite(false);
              }}
              className="text-gray-500 hover:text-gray-300 transition-colors"
            >
              <X size={14} />
            </button>
            {/* Tooltip triangle indicator */}
            <div className="absolute -bottom-1 left-6 w-3.5 h-3.5 bg-gray-900 rotate-45 border-r border-b border-white/10" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Music Widget */}
      <AnimatePresence initial={false}>
        {!isExpanded ? (
          /* MINIMIZED VIEW */
          <motion.button
            key="minimized-music"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => setIsExpanded(true)}
            className="bg-white/95 dark:bg-gray-950/95 backdrop-blur-md border border-gray-150/50 dark:border-gray-800 p-3.5 rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center space-x-3 cursor-pointer group"
            id="minimized-music-trigger"
          >
            <div className={`p-2.5 rounded-full ${isPlaying ? 'bg-orange-600 text-white animate-pulse' : 'bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300'}`}>
              <Music size={18} className={isPlaying ? "rotate-12 transition-transform" : "group-hover:rotate-12 transition-transform"} />
            </div>
            <div className="text-left pr-1.5 hidden sm:block">
              <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-none">Background</p>
              <p className="text-xs font-bold text-gray-800 dark:text-gray-200 mt-0.5 max-w-[100px] truncate">
                {isPlaying ? activeTrack.title : "Music Off"}
              </p>
            </div>
            {isPlaying && (
              <div className="pr-1.5 shrink-0 hidden sm:block">
                {pulsingBars}
              </div>
            )}
          </motion.button>
        ) : (
          /* EXPANDED CONTROLLER CARD */
          <motion.div
            key="expanded-music"
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            className="bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl border border-gray-150/60 dark:border-gray-800 p-4 rounded-3xl shadow-2xl w-72 flex flex-col space-y-3.5"
          >
            {/* Header / Collapse Bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Music size={15} className="text-orange-600 shrink-0" />
                <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Sokoplus Ambient</span>
              </div>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setShowPlaylist(!showPlaylist)}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${showPlaylist ? 'bg-orange-50 dark:bg-orange-950/30 text-orange-600' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                  title="Playlist"
                >
                  <ListMusic size={15} />
                </button>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors cursor-pointer"
                  title="Minimize"
                >
                  <ChevronDown size={15} />
                </button>
              </div>
            </div>

            {/* Track Info */}
            <div className="space-y-1">
              <div className="flex items-baseline justify-between">
                <h4 className="text-sm font-black text-gray-900 dark:text-white truncate max-w-[190px]">
                  {activeTrack.title}
                </h4>
                {isPlaying && pulsingBars}
              </div>
              <p className="text-[10px] text-gray-500 dark:text-gray-450 truncate font-medium">
                {activeTrack.description}
              </p>
            </div>

            {/* Slider Seek Bar */}
            <div className="space-y-1">
              <input
                type="range"
                min="0"
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 accent-orange-600 rounded-lg appearance-none cursor-pointer focus:outline-none"
              />
              <div className="flex items-center justify-between text-[10px] font-mono text-gray-400 dark:text-gray-500">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Controls Bar */}
            <div className="flex items-center justify-between">
              {/* Skip Back */}
              <button
                onClick={handlePrev}
                className="p-2 text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-gray-50 dark:hover:bg-gray-900 rounded-xl transition-all cursor-pointer"
                title="Previous Track"
              >
                <SkipBack size={16} />
              </button>

              {/* Play / Pause button */}
              <button
                onClick={handlePlayPause}
                className="bg-orange-600 hover:bg-orange-500 text-white p-3 rounded-full transition-all hover:scale-105 active:scale-95 shadow-md shadow-orange-600/20 flex items-center justify-center cursor-pointer"
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
              </button>

              {/* Skip Forward */}
              <button
                onClick={handleNext}
                className="p-2 text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-gray-50 dark:hover:bg-gray-900 rounded-xl transition-all cursor-pointer"
                title="Next Track"
              >
                <SkipForward size={16} />
              </button>

              {/* Volume Controller Panel */}
              <div className="flex items-center space-x-1.5 pl-2 border-l border-gray-100 dark:border-gray-800">
                <button
                  onClick={handleToggleMute}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1"
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted || volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-16 h-1 bg-gray-100 dark:bg-gray-800 accent-orange-600 rounded-lg appearance-none cursor-pointer focus:outline-none"
                  title="Volume"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
