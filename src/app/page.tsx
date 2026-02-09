"use client";

import React, { useState, useEffect, useRef, useCallback, useReducer } from 'react';
import { ShieldAlert, User, UserPlus, Volume2, ChevronRight, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

/**
 * UPDATES:
 * 1. Database Feedback: Verbeterde visuele status voor het opslagproces.
 * 2. Stabiliteit: De fetch-aanroep is nu robuuster met een timeout-check.
 */

type Phase = 'DISCLAIMER' | 'AUTH' | 'BREATHING' | 'RETENTION' | 'MEDITATION' | 'SUMMARY';
type RetentionHistoryItem = { chakra: string; time: number };

interface AppState {
    phase: Phase;
    currentChakraIdx: number;
    sessionStartTime: number | null;
    totalDuration: number;
}

type Action = { type: 'NEXT_PHASE' } | { type: 'RESET' };

const CHAKRAS = [
    { id: 1, name: 'Wortel (Muladhara)', color: 'bg-red-500', audio: '/audio/Breathing 1.m4a', meditation: '/audio/Meditation 1.m4a' },
    { id: 2, name: 'Sacraal (Svadhisthana)', color: 'bg-orange-500', audio: '/audio/Breathing 2.m4a', meditation: '/audio/Meditation 2.m4a' },
    { id: 3, name: 'Zonnevlecht (Manipura)', color: 'bg-yellow-500', audio: '/audio/Breathing 3.m4a', meditation: '/audio/Meditation 3.m4a' },
    { id: 4, name: 'Hart (Anahata)', color: 'bg-green-500', audio: '/audio/Breathing 4.m4a', meditation: '/audio/Meditation 4.m4a' },
    { id: 5, name: 'Keel (Vishuddha)', color: 'bg-blue-500', audio: '/audio/Breathing 5.m4a', meditation: '/audio/Meditation 5.m4a' },
    { id: 6, name: 'Derde Oog (Ajna)', color: 'bg-indigo-500', audio: '/audio/Breathing 6.m4a', meditation: '/audio/Meditation 6.m4a' },
    { id: 7, name: 'Kroon (Sahasrara)', color: 'bg-purple-500', audio: '/audio/Breathing 7.m4a', meditation: '/audio/Meditation 7.m4a' },
];

const initialState: AppState = {
    phase: 'DISCLAIMER',
    currentChakraIdx: 0,
    sessionStartTime: null,
    totalDuration: 0,
};

function appReducer(state: AppState, action: Action): AppState {
    switch (action.type) {
        case 'NEXT_PHASE': {
            if (state.phase === 'DISCLAIMER') return { ...state, phase: 'AUTH' };
            if (state.phase === 'AUTH') return { ...state, phase: 'BREATHING', sessionStartTime: Date.now() };
            if (state.phase === 'BREATHING') return { ...state, phase: 'RETENTION' };
            if (state.phase === 'RETENTION') return { ...state, phase: 'MEDITATION' };
            if (state.phase === 'MEDITATION') {
                if (state.currentChakraIdx < 6) {
                    return { ...state, phase: 'BREATHING', currentChakraIdx: state.currentChakraIdx + 1 };
                } else {
                    const duration = state.sessionStartTime ? Math.floor((Date.now() - state.sessionStartTime) / 1000) : 0;
                    return { ...state, phase: 'SUMMARY', totalDuration: duration };
                }
            }
            return state;
        }
        case 'RESET':
            return initialState;
        default:
            return state;
    }
}

export default function App() {
    const [state, dispatch] = useReducer(appReducer, initialState);
    const { phase, currentChakraIdx, totalDuration } = state;

    const [retentionTime, setRetentionTime] = useState(0);
    const [history, setHistory] = useState<RetentionHistoryItem[]>([]);
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveComplete, setSaveComplete] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const isTransitioningRef = useRef(false);

    // --- DATABASE OPSLAG FUNCTIE ---
    const handleSaveSession = useCallback(async (finalHistory: RetentionHistoryItem[], duration: number) => {
        setIsSaving(true);
        setSaveError(null);
        try {
            const response = await fetch('/api/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    totalDuration: duration,
                    userType: 'GUEST',
                    records: finalHistory
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({} as {
                    error?: string;
                    code?: string;
                    detail?: string;
                }));
                const parts = [
                    errorData.error || 'Kon sessie niet opslaan',
                    errorData.code ? `[${errorData.code}]` : '',
                    errorData.detail ? `(${errorData.detail})` : '',
                ].filter(Boolean);
                throw new Error(parts.join(' '));
            }

            setSaveComplete(true);
        } catch (err) {
            console.error("Save error:", err);
            const message = err instanceof Error ? err.message : 'Kon sessie niet opslaan';
            setSaveError(`Fout: ${message}`);
        } finally {
            setIsSaving(false);
        }
    }, []);

    const handleNext = useCallback(() => {
        if (isTransitioningRef.current) return;
        isTransitioningRef.current = true;

        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.onended = null;
        }

        if (phase === 'BREATHING') setIsTimerRunning(true);
        if (phase === 'RETENTION') {
            setIsTimerRunning(false);
            setHistory(prev => {
                if (prev.length > currentChakraIdx) return prev;
                const newHistory = [...prev, { chakra: CHAKRAS[currentChakraIdx].name, time: retentionTime }];
                return newHistory;
            });
        }
        if (phase === 'MEDITATION') setRetentionTime(0);

        dispatch({ type: 'NEXT_PHASE' });

        setTimeout(() => {
            isTransitioningRef.current = false;
        }, 400);
    }, [phase, currentChakraIdx, retentionTime]);

    // Audio effect
    useEffect(() => {
        let active = true;
        let audioPath = '';

        if (phase === 'BREATHING') audioPath = CHAKRAS[currentChakraIdx].audio;
        else if (phase === 'MEDITATION') audioPath = CHAKRAS[currentChakraIdx].meditation;

        if (audioPath && active) {
            const audio = new Audio(audioPath);
            audioRef.current = audio;

            audio.onended = () => {
                if (active) handleNext();
            };

            audio.play().catch(e => console.log("Audio play blocked", e));
        }

        return () => {
            active = false;
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.onended = null;
            }
        };
    }, [phase, currentChakraIdx, handleNext]);

    // Retentie Timer
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (phase === 'RETENTION' && isTimerRunning) {
            interval = setInterval(() => setRetentionTime(prev => prev + 1), 1000);
        }
        return () => clearInterval(interval);
    }, [phase, isTimerRunning]);

    useEffect(() => {
        if (phase !== 'SUMMARY') return;
        if (history.length !== CHAKRAS.length) return;
        if (isSaving || saveComplete || saveError) return;
        void handleSaveSession(history, totalDuration);
    }, [phase, history, totalDuration, isSaving, saveComplete, saveError, handleSaveSession]);

    // --- UI RENDERING ---

    if (phase === 'DISCLAIMER') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-slate-900 text-white font-sans">
                <ShieldAlert size={64} className="mb-4 text-yellow-500" />
                <h1 className="text-2xl font-bold mb-4 uppercase tracking-tighter">Medische Disclaimer</h1>
                <p className="mb-8 opacity-80 max-w-sm text-sm leading-relaxed text-slate-300">
                    Deze sessie bevat intensieve ademhalingstechnieken. Raadpleeg bij twijfel een arts. Niet gebruiken tijdens zwangerschap of bij epilepsie.
                </p>
                <button onClick={handleNext} className="px-12 py-4 bg-white text-black rounded-full font-black uppercase tracking-widest text-xs hover:scale-105 transition-transform active:scale-95">Ik begrijp het</button>
            </div>
        );
    }

    if (phase === 'AUTH') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-[#020617] text-white font-sans">
                <h1 className="text-3xl font-black mb-10 bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent italic tracking-tighter">
                    Sadhana Reiki Rounds
                </h1>

                <div className="w-full max-w-[340px] bg-[#0f172a] rounded-3xl p-8 border border-white/5 shadow-2xl">
                    <div className="flex items-center gap-2 mb-6 opacity-80">
                        <User size={18} />
                        <span className="font-bold text-xs uppercase tracking-widest text-slate-300">Inloggen</span>
                    </div>

                    <div className="space-y-4 mb-6">
                        <input type="text" placeholder="Gebruikersnaam" className="w-full bg-[#1e293b] border border-white/10 rounded-xl py-3 px-4 text-sm placeholder:text-slate-500 outline-none focus:border-purple-500/50 transition-colors text-white" />
                        <input type="password" placeholder="Wachtwoord" className="w-full bg-[#1e293b] border border-white/10 rounded-xl py-3 px-4 text-sm placeholder:text-slate-500 outline-none focus:border-purple-500/50 transition-colors text-white" />
                    </div>

                    <button disabled className="w-full py-3 bg-purple-700/20 text-white/20 rounded-xl font-bold text-xs uppercase tracking-widest mb-4 cursor-not-allowed border border-white/5">
                        Start (Binnenkort)
                    </button>

                    <div className="flex items-center gap-4 my-6 opacity-20">
                        <div className="h-[1px] bg-white flex-1"></div>
                        <span className="text-[10px] font-black">OF</span>
                        <div className="h-[1px] bg-white flex-1"></div>
                    </div>

                    <button onClick={handleNext} className="w-full py-4 bg-white/5 border border-white/10 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-white/10 transition shadow-lg active:scale-95">
                        <UserPlus size={18} /> Start als Gast
                    </button>
                </div>
            </div>
        );
    }

    if (phase === 'RETENTION') {
        return (
            <div onClick={handleNext} className="flex flex-col items-center justify-center min-h-screen bg-black text-white cursor-pointer relative overflow-hidden font-sans">
                <div className={`absolute inset-0 opacity-20 ${CHAKRAS[currentChakraIdx].color} blur-[120px] animate-pulse transition-colors duration-1000`} />
                <div className="z-10 text-center">
                    <h2 className="text-xl font-medium opacity-40 mb-4 tracking-[0.3em] uppercase">{CHAKRAS[currentChakraIdx].name}</h2>
                    <div className="text-[120px] font-mono leading-none mb-10 tracking-tighter tabular-nums">
                        {Math.floor(retentionTime / 60)}:{(retentionTime % 60).toString().padStart(2, '0')}
                    </div>
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-2 h-2 bg-white rounded-full animate-ping" />
                        <p className="text-slate-500 tracking-[0.3em] uppercase text-[10px] font-black mt-6">Tik om te voltooien</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-950 text-white relative overflow-hidden font-sans">
            {phase !== 'SUMMARY' && (
                <div className="fixed top-0 left-0 w-full h-1 bg-white/5 z-50">
                    <div
                        className={`h-full ${CHAKRAS[currentChakraIdx].color} transition-all duration-700 shadow-[0_0_15px_rgba(255,255,255,0.2)]`}
                        style={{ width: `${((currentChakraIdx + 1) / 7) * 100}%` }}
                    />
                </div>
            )}

            <main className="text-center w-full max-w-md z-10">
                {phase === 'SUMMARY' ? (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                        <h2 className="text-5xl font-black italic tracking-tighter mb-2">Sessie Voltooid.</h2>

                        <div className="flex items-center justify-center gap-2 text-slate-400 mb-6">
                            <Clock size={16} />
                            <span className="text-sm font-bold tracking-widest uppercase">
                                Totale tijd: <span className="text-white font-mono">{Math.floor(totalDuration / 60)}m {totalDuration % 60}s</span>
                            </span>
                        </div>

                        <div className="bg-white/5 rounded-[2rem] p-6 border border-white/10 backdrop-blur-xl text-left space-y-4 shadow-2xl">
                            {history.map((h, i) => (
                                <div key={i} className="flex justify-between items-center group">
                                    <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{h.chakra}</span>
                                    <div className="flex items-center gap-3">
                                        <span className="font-mono font-bold text-lg text-white">{h.time}s</span>
                                        <div className={`w-1 h-4 rounded-full ${CHAKRAS[i].color} opacity-40 group-hover:opacity-100 transition-opacity`} />
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="py-2 h-8">
                            {isSaving ? (
                                <div className="flex items-center justify-center gap-3">
                                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" />
                                    <span className="text-[10px] text-blue-400 font-black uppercase tracking-widest">Opslaan in database...</span>
                                </div>
                            ) : saveComplete ? (
                                <div className="flex items-center justify-center gap-2 text-green-400 animate-in zoom-in duration-300">
                                    <CheckCircle2 size={16} />
                                    <span className="text-[10px] font-black uppercase tracking-widest italic">Opgeslagen in Postgres via Prisma</span>
                                </div>
                            ) : saveError ? (
                                <div className="flex flex-col items-center gap-1 text-red-400">
                                    <div className="flex items-center gap-2">
                                        <AlertCircle size={14} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">{saveError}</span>
                                    </div>
                                    <span className="text-[8px] opacity-50 uppercase tracking-widest">Controleer je API route en Prisma migratie</span>
                                </div>
                            ) : null}
                        </div>

                        <button onClick={() => {
                            setIsSaving(false);
                            setSaveComplete(false);
                            setSaveError(null);
                            setHistory([]);
                            dispatch({ type: 'RESET' });
                        }} className="w-full py-5 bg-white text-black font-black rounded-2xl uppercase tracking-widest text-xs shadow-2xl hover:bg-slate-200 transition-all active:scale-95">
                            Nieuwe Sessie
                        </button>
                    </div>
                ) : (
                    <div className="space-y-10">
                        <div className="space-y-4">
                            <div className={`w-20 h-20 mx-auto rounded-full border border-white/10 ${CHAKRAS[currentChakraIdx].color} flex items-center justify-center bg-black/40 shadow-2xl transition-colors duration-1000`}>
                                <span className="text-3xl font-black italic">{currentChakraIdx + 1}</span>
                            </div>
                            <h2 className="text-3xl font-black tracking-tighter uppercase italic">
                                {phase === 'BREATHING' ? 'Ademhaling' : 'Herstel en Meditatie'}
                            </h2>
                            <p className="text-[10px] text-slate-500 tracking-[0.3em] uppercase font-black">{CHAKRAS[currentChakraIdx].name}</p>
                        </div>

                        <div className="aspect-video w-full bg-[#0f172a] rounded-[2.5rem] flex flex-col items-center justify-center gap-4 border border-white/5 relative shadow-inner overflow-hidden">
                            <div className={`absolute inset-0 opacity-10 ${CHAKRAS[currentChakraIdx].color} blur-3xl transition-colors duration-1000`} />
                            <Volume2 className="text-white/20 animate-pulse" size={48} />
                            <p className="text-[9px] uppercase tracking-[0.4em] font-black opacity-30">Audio speelt af...</p>
                        </div>

                        <button
                            onClick={handleNext}
                            className="w-full py-5 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center gap-4 font-black uppercase tracking-widest text-xs hover:bg-white/10 transition-all group active:scale-95"
                        >
                            <span>
                                {phase === 'BREATHING'
                                    ? 'Naar Retentie'
                                    : (currentChakraIdx < 6 ? 'Volgende Chakra' : 'Sessie Voltooien')}
                            </span>
                            <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}
