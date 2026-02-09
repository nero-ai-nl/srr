"use client";

import React, { useState, useEffect, useRef, useCallback, useReducer } from 'react';
import {
    AlertCircle,
    BarChart3,
    CheckCircle2,
    ChevronRight,
    Clock,
    LogIn,
    LogOut,
    PauseCircle,
    PlayCircle,
    ShieldAlert,
    User,
    UserPlus,
    Volume2,
} from 'lucide-react';

type Phase = 'DISCLAIMER' | 'AUTH' | 'DASHBOARD' | 'BREATHING' | 'RETENTION' | 'MEDITATION' | 'SUMMARY';
type UserType = 'GUEST' | 'USER';
type RetentionHistoryItem = { chakra: string; time: number };
type CurrentUser = {
    id: string;
    username: string;
    displayName?: string | null;
    type: UserType;
};

type UserStats = {
    sessionCount: number;
    totalDuration: number;
    averageDuration: number;
    bestRetention: number;
    lastSessionAt: string | null;
    recentSessions: { id: string; createdAt: string; totalDuration: number }[];
};

interface AppState {
    phase: Phase;
    currentChakraIdx: number;
    sessionStartTime: number | null;
    totalDuration: number;
}

type Action =
    | { type: 'GO_AUTH' }
    | { type: 'GO_DASHBOARD' }
    | { type: 'START_SESSION' }
    | { type: 'NEXT_PHASE' }
    | { type: 'RESET_ALL' };

const CHAKRAS = [
    {
        id: 1,
        name: 'Wortel (Muladhara)',
        color: 'bg-red-500',
        audio: '/audio/Breathing 1.m4a',
        meditation: '/audio/Meditation 1.m4a',
        background: '/images/chakras/chakra-1.jpg',
    },
    {
        id: 2,
        name: 'Sacraal (Svadhisthana)',
        color: 'bg-orange-500',
        audio: '/audio/Breathing 2.m4a',
        meditation: '/audio/Meditation 2.m4a',
        background: '/images/chakras/chakra-2.jpg',
    },
    {
        id: 3,
        name: 'Zonnevlecht (Manipura)',
        color: 'bg-yellow-500',
        audio: '/audio/Breathing 3.m4a',
        meditation: '/audio/Meditation 3.m4a',
        background: '/images/chakras/chakra-3.jpg',
    },
    {
        id: 4,
        name: 'Hart (Anahata)',
        color: 'bg-green-500',
        audio: '/audio/Breathing 4.m4a',
        meditation: '/audio/Meditation 4.m4a',
        background: '/images/chakras/chakra-4.jpg',
    },
    {
        id: 5,
        name: 'Keel (Vishuddha)',
        color: 'bg-blue-500',
        audio: '/audio/Breathing 5.m4a',
        meditation: '/audio/Meditation 5.m4a',
        background: '/images/chakras/chakra-5.jpg',
    },
    {
        id: 6,
        name: 'Derde Oog (Ajna)',
        color: 'bg-indigo-500',
        audio: '/audio/Breathing 6.m4a',
        meditation: '/audio/Meditation 6.m4a',
        background: '/images/chakras/chakra-6.jpg',
    },
    {
        id: 7,
        name: 'Kroon (Sahasrara)',
        color: 'bg-purple-500',
        audio: '/audio/Breathing 7.m4a',
        meditation: '/audio/Meditation 7.m4a',
        background: '/images/chakras/chakra-7.jpg',
    },
];

const initialState: AppState = {
    phase: 'DISCLAIMER',
    currentChakraIdx: 0,
    sessionStartTime: null,
    totalDuration: 0,
};

function appReducer(state: AppState, action: Action): AppState {
    switch (action.type) {
        case 'GO_AUTH':
            return { ...state, phase: 'AUTH' };
        case 'GO_DASHBOARD':
            return {
                ...state,
                phase: 'DASHBOARD',
                currentChakraIdx: 0,
                sessionStartTime: null,
                totalDuration: 0,
            };
        case 'START_SESSION':
            return {
                ...state,
                phase: 'BREATHING',
                currentChakraIdx: 0,
                sessionStartTime: Date.now(),
                totalDuration: 0,
            };
        case 'NEXT_PHASE': {
            if (state.phase === 'BREATHING') return { ...state, phase: 'RETENTION' };
            if (state.phase === 'RETENTION') return { ...state, phase: 'MEDITATION' };
            if (state.phase === 'MEDITATION') {
                if (state.currentChakraIdx < CHAKRAS.length - 1) {
                    return { ...state, phase: 'BREATHING', currentChakraIdx: state.currentChakraIdx + 1 };
                }
                const duration = state.sessionStartTime ? Math.floor((Date.now() - state.sessionStartTime) / 1000) : 0;
                return { ...state, phase: 'SUMMARY', totalDuration: duration };
            }
            return state;
        }
        case 'RESET_ALL':
            return initialState;
        default:
            return state;
    }
}

function formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return `${minutes}m ${rest}s`;
}

export default function App() {
    const [state, dispatch] = useReducer(appReducer, initialState);
    const { phase, currentChakraIdx, totalDuration } = state;

    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
    const [usernameInput, setUsernameInput] = useState('');
    const [passwordInput, setPasswordInput] = useState('');
    const [authError, setAuthError] = useState<string | null>(null);
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    const [userStats, setUserStats] = useState<UserStats | null>(null);
    const [isStatsLoading, setIsStatsLoading] = useState(false);
    const [statsError, setStatsError] = useState<string | null>(null);

    const [retentionTime, setRetentionTime] = useState(0);
    const [history, setHistory] = useState<RetentionHistoryItem[]>([]);
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveComplete, setSaveComplete] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const [isInstructionPlaying, setIsInstructionPlaying] = useState(false);
    const [instructionError, setInstructionError] = useState<string | null>(null);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const instructionAudioRef = useRef<HTMLAudioElement | null>(null);
    const isTransitioningRef = useRef(false);

    const stopInstructionAudio = useCallback(() => {
        if (instructionAudioRef.current) {
            instructionAudioRef.current.pause();
            instructionAudioRef.current.currentTime = 0;
            instructionAudioRef.current.onended = null;
            instructionAudioRef.current = null;
        }
        setIsInstructionPlaying(false);
    }, []);

    const toggleInstructionAudio = useCallback(() => {
        if (isInstructionPlaying) {
            stopInstructionAudio();
            return;
        }

        setInstructionError(null);
        const audio = new Audio('/audio/instructions.m4a');
        instructionAudioRef.current = audio;
        setIsInstructionPlaying(true);

        audio.onended = () => {
            setIsInstructionPlaying(false);
            instructionAudioRef.current = null;
        };

        audio.onerror = () => {
            setIsInstructionPlaying(false);
            setInstructionError('Kon instructions.m4a niet afspelen.');
            instructionAudioRef.current = null;
        };

        audio.play().catch(() => {
            setIsInstructionPlaying(false);
            setInstructionError('Autoplay geblokkeerd of audio niet gevonden.');
            instructionAudioRef.current = null;
        });
    }, [isInstructionPlaying, stopInstructionAudio]);

    const fetchUserStats = useCallback(async (userId: string) => {
        setIsStatsLoading(true);
        setStatsError(null);

        try {
            const response = await fetch(`/api/users/me/stats?userId=${encodeURIComponent(userId)}`);
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.error || 'Kon statistieken niet ophalen.');
            }

            setUserStats(data.stats as UserStats);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Kon statistieken niet ophalen.';
            setStatsError(message);
        } finally {
            setIsStatsLoading(false);
        }
    }, []);

    const handleSaveSession = useCallback(async (finalHistory: RetentionHistoryItem[], duration: number) => {
        setIsSaving(true);
        setSaveError(null);
        try {
            const response = await fetch('/api/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    totalDuration: duration,
                    userType: currentUser?.type ?? 'GUEST',
                    userId: currentUser?.type === 'USER' ? currentUser.id : null,
                    records: finalHistory,
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
            if (currentUser?.type === 'USER' && currentUser.id) {
                void fetchUserStats(currentUser.id);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Kon sessie niet opslaan';
            setSaveError(`Fout: ${message}`);
        } finally {
            setIsSaving(false);
        }
    }, [currentUser, fetchUserStats]);

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
            setHistory((prev) => {
                if (prev.length > currentChakraIdx) return prev;
                return [...prev, { chakra: CHAKRAS[currentChakraIdx].name, time: retentionTime }];
            });
        }
        if (phase === 'MEDITATION') setRetentionTime(0);

        dispatch({ type: 'NEXT_PHASE' });

        setTimeout(() => {
            isTransitioningRef.current = false;
        }, 400);
    }, [phase, currentChakraIdx, retentionTime]);

    const handleLogin = async (event: React.FormEvent) => {
        event.preventDefault();
        setAuthError(null);
        setIsLoggingIn(true);

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: usernameInput,
                    password: passwordInput,
                }),
            });

            const data = await response.json().catch(() => ({} as {
                error?: string;
                user?: { id: string; username: string; displayName?: string | null };
            }));

            if (!response.ok || !data.user) {
                throw new Error(data.error || 'Inloggen mislukt.');
            }

            const user: CurrentUser = {
                id: data.user.id,
                username: data.user.username,
                displayName: data.user.displayName,
                type: 'USER',
            };

            setCurrentUser(user);
            await fetchUserStats(user.id);
            setUsernameInput('');
            setPasswordInput('');
            dispatch({ type: 'GO_DASHBOARD' });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Inloggen mislukt.';
            setAuthError(message);
        } finally {
            setIsLoggingIn(false);
        }
    };

    const startAsGuest = () => {
        setCurrentUser({ id: 'guest', username: 'Gast', type: 'GUEST' });
        setUserStats(null);
        setStatsError(null);
        setRetentionTime(0);
        setHistory([]);
        setSaveComplete(false);
        setSaveError(null);
        dispatch({ type: 'START_SESSION' });
    };

    const startLoggedInSession = () => {
        setRetentionTime(0);
        setHistory([]);
        setSaveComplete(false);
        setSaveError(null);
        setIsSaving(false);
        dispatch({ type: 'START_SESSION' });
    };

    const handleSummaryContinue = async () => {
        setIsSaving(false);
        setSaveComplete(false);
        setSaveError(null);
        setHistory([]);
        setRetentionTime(0);

        if (currentUser?.type === 'USER' && currentUser.id) {
            await fetchUserStats(currentUser.id);
            dispatch({ type: 'GO_DASHBOARD' });
            return;
        }

        setCurrentUser(null);
        setUserStats(null);
        dispatch({ type: 'RESET_ALL' });
    };

    const handleLogout = () => {
        setCurrentUser(null);
        setUserStats(null);
        setStatsError(null);
        setAuthError(null);
        setUsernameInput('');
        setPasswordInput('');
        dispatch({ type: 'GO_AUTH' });
    };

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

            audio.play().catch(() => {
                // no-op for autoplay restrictions
            });
        }

        return () => {
            active = false;
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.onended = null;
            }
        };
    }, [phase, currentChakraIdx, handleNext]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (phase === 'RETENTION' && isTimerRunning) {
            interval = setInterval(() => setRetentionTime((prev) => prev + 1), 1000);
        }
        return () => clearInterval(interval);
    }, [phase, isTimerRunning]);

    useEffect(() => {
        if (phase !== 'SUMMARY') return;
        if (history.length !== CHAKRAS.length) return;
        if (isSaving || saveComplete || saveError) return;
        void handleSaveSession(history, totalDuration);
    }, [phase, history, totalDuration, isSaving, saveComplete, saveError, handleSaveSession]);

    useEffect(() => {
        if (phase !== 'DISCLAIMER') {
            stopInstructionAudio();
            setInstructionError(null);
        }
    }, [phase, stopInstructionAudio]);

    if (phase === 'DISCLAIMER') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-slate-900 text-white font-sans">
                <ShieldAlert size={64} className="mb-4 text-yellow-500" />
                <h1 className="text-2xl font-bold mb-4 uppercase tracking-tighter">Medische Disclaimer</h1>
                <p className="mb-8 opacity-80 max-w-sm text-sm leading-relaxed text-slate-300">
                    Deze sessie bevat intensieve ademhalingstechnieken. Raadpleeg bij twijfel een arts. Niet gebruiken tijdens zwangerschap of bij epilepsie.
                </p>

                <div className="flex flex-col gap-3 w-full max-w-xs">
                    <button
                        onClick={toggleInstructionAudio}
                        className="w-full px-6 py-3 bg-slate-800 border border-white/20 text-white rounded-full font-black uppercase tracking-widest text-xs hover:bg-slate-700 transition-colors active:scale-95 flex items-center justify-center gap-2"
                    >
                        {isInstructionPlaying ? <PauseCircle size={16} /> : <PlayCircle size={16} />} 
                        {isInstructionPlaying ? 'Stop Instructies' : 'Beluister Instructies'}
                    </button>
                    <button
                        onClick={() => {
                            stopInstructionAudio();
                            dispatch({ type: 'GO_AUTH' });
                        }}
                        className="w-full px-6 py-4 bg-white text-black rounded-full font-black uppercase tracking-widest text-xs hover:scale-105 transition-transform active:scale-95"
                    >
                        Ik begrijp het
                    </button>
                </div>

                {instructionError ? <p className="mt-4 text-xs text-red-400">{instructionError}</p> : null}
                <p className="mt-4 text-[10px] text-slate-500 uppercase tracking-widest">Plaats `public/audio/instructions.m4a` om deze knop te activeren</p>
            </div>
        );
    }

    if (phase === 'AUTH') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-[#020617] text-white font-sans">
                <h1 className="text-3xl font-black mb-10 bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent italic tracking-tighter">
                    Sadhana Reiki Rounds
                </h1>

                <div className="w-full max-w-[360px] bg-[#0f172a] rounded-3xl p-8 border border-white/5 shadow-2xl">
                    <div className="flex items-center gap-2 mb-6 opacity-80">
                        <User size={18} />
                        <span className="font-bold text-xs uppercase tracking-widest text-slate-300">Inloggen</span>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4 mb-6">
                        <input
                            type="text"
                            value={usernameInput}
                            onChange={(event) => setUsernameInput(event.target.value)}
                            placeholder="Gebruikersnaam"
                            className="w-full bg-[#1e293b] border border-white/10 rounded-xl py-3 px-4 text-sm placeholder:text-slate-500 outline-none focus:border-purple-500/50 transition-colors text-white"
                            required
                        />
                        <input
                            type="password"
                            value={passwordInput}
                            onChange={(event) => setPasswordInput(event.target.value)}
                            placeholder="Wachtwoord"
                            className="w-full bg-[#1e293b] border border-white/10 rounded-xl py-3 px-4 text-sm placeholder:text-slate-500 outline-none focus:border-purple-500/50 transition-colors text-white"
                            required
                        />
                        <button
                            type="submit"
                            disabled={isLoggingIn}
                            className="w-full py-3 bg-purple-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest border border-purple-400/30 hover:bg-purple-500 transition-colors disabled:opacity-50"
                        >
                            <span className="inline-flex items-center gap-2 justify-center">
                                <LogIn size={16} />
                                {isLoggingIn ? 'Inloggen...' : 'Inloggen'}
                            </span>
                        </button>
                    </form>

                    {authError ? <p className="text-xs text-red-400 mb-4">{authError}</p> : null}

                    <p className="text-[10px] text-slate-400 mb-5 uppercase tracking-wider">
                        Testaccount: <span className="text-white">testuser</span> / <span className="text-white">sadhana123</span>
                    </p>

                    <div className="flex items-center gap-4 my-6 opacity-20">
                        <div className="h-[1px] bg-white flex-1"></div>
                        <span className="text-[10px] font-black">OF</span>
                        <div className="h-[1px] bg-white flex-1"></div>
                    </div>

                    <button
                        onClick={startAsGuest}
                        className="w-full py-4 bg-white/5 border border-white/10 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-white/10 transition shadow-lg active:scale-95"
                    >
                        <UserPlus size={18} /> Start als Gast
                    </button>
                </div>
            </div>
        );
    }

    if (phase === 'DASHBOARD' && currentUser?.type === 'USER') {
        return (
            <div className="min-h-screen p-6 bg-slate-950 text-white font-sans">
                <div className="max-w-3xl mx-auto space-y-6">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <p className="text-xs uppercase tracking-widest text-slate-400">Persoonlijk Dashboard</p>
                            <h1 className="text-3xl font-black tracking-tight">
                                Welkom {currentUser.displayName ?? currentUser.username}
                            </h1>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white/20 transition-colors inline-flex items-center gap-2"
                        >
                            <LogOut size={14} /> Uitloggen
                        </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                            <p className="text-[10px] uppercase tracking-widest text-slate-400">Sessies</p>
                            <p className="text-2xl font-black">{userStats?.sessionCount ?? 0}</p>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                            <p className="text-[10px] uppercase tracking-widest text-slate-400">Totale tijd</p>
                            <p className="text-2xl font-black">{formatDuration(userStats?.totalDuration ?? 0)}</p>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                            <p className="text-[10px] uppercase tracking-widest text-slate-400">Gemiddeld</p>
                            <p className="text-2xl font-black">{formatDuration(userStats?.averageDuration ?? 0)}</p>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                            <p className="text-[10px] uppercase tracking-widest text-slate-400">Beste retentie</p>
                            <p className="text-2xl font-black">{userStats?.bestRetention ?? 0}s</p>
                        </div>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <BarChart3 size={16} />
                            <p className="text-xs font-black uppercase tracking-widest">Laatste sessies</p>
                        </div>

                        {isStatsLoading ? <p className="text-sm text-slate-400">Statistieken laden...</p> : null}
                        {statsError ? <p className="text-sm text-red-400">{statsError}</p> : null}

                        {!isStatsLoading && !statsError && (userStats?.recentSessions.length ?? 0) === 0 ? (
                            <p className="text-sm text-slate-400">Nog geen opgeslagen sessies.</p>
                        ) : null}

                        {!isStatsLoading && !statsError && (userStats?.recentSessions.length ?? 0) > 0 ? (
                            <div className="space-y-2">
                                {userStats?.recentSessions.map((session) => (
                                    <div key={session.id} className="flex justify-between text-sm border-b border-white/5 py-2">
                                        <span>{new Date(session.createdAt).toLocaleString()}</span>
                                        <span className="font-mono">{formatDuration(session.totalDuration)}</span>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </div>

                    <button
                        onClick={startLoggedInSession}
                        className="w-full py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-colors"
                    >
                        Start Sadhana Sessie
                    </button>
                </div>
            </div>
        );
    }

    if (phase === 'RETENTION') {
        const chakra = CHAKRAS[currentChakraIdx];
        return (
            <div
                onClick={handleNext}
                className="flex flex-col items-center justify-center min-h-screen text-white cursor-pointer relative overflow-hidden font-sans"
                style={{
                    backgroundImage: `linear-gradient(rgba(2, 6, 23, 0.70), rgba(0, 0, 0, 0.85)), url('${chakra.background}')`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                }}
            >
                <div className={`absolute inset-0 opacity-20 ${chakra.color} blur-[120px] animate-pulse transition-colors duration-1000`} />
                <div className="z-10 text-center px-6">
                    <h2 className="text-xl font-medium opacity-70 mb-4 tracking-[0.2em] uppercase">{chakra.name}</h2>
                    <div className="text-[110px] font-mono leading-none mb-10 tracking-tighter tabular-nums">
                        {Math.floor(retentionTime / 60)}:{(retentionTime % 60).toString().padStart(2, '0')}
                    </div>
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-2 h-2 bg-white rounded-full animate-ping" />
                        <p className="text-slate-300 tracking-[0.3em] uppercase text-[10px] font-black mt-6">Tik om te voltooien</p>
                    </div>
                </div>
            </div>
        );
    }

    const chakra = CHAKRAS[currentChakraIdx];

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-950 text-white relative overflow-hidden font-sans">
            {phase !== 'SUMMARY' ? (
                <div className="fixed top-0 left-0 w-full h-1 bg-white/5 z-50">
                    <div
                        className={`h-full ${chakra.color} transition-all duration-700 shadow-[0_0_15px_rgba(255,255,255,0.2)]`}
                        style={{ width: `${((currentChakraIdx + 1) / CHAKRAS.length) * 100}%` }}
                    />
                </div>
            ) : null}

            <main className="text-center w-full max-w-md z-10">
                {phase === 'SUMMARY' ? (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                        <h2 className="text-5xl font-black italic tracking-tighter mb-2">Sessie Voltooid.</h2>

                        <div className="flex items-center justify-center gap-2 text-slate-400 mb-6">
                            <Clock size={16} />
                            <span className="text-sm font-bold tracking-widest uppercase">
                                Totale tijd: <span className="text-white font-mono">{formatDuration(totalDuration)}</span>
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

                        <div className="py-2 min-h-10">
                            {isSaving ? (
                                <div className="flex items-center justify-center gap-3">
                                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" />
                                    <span className="text-[10px] text-blue-400 font-black uppercase tracking-widest">Opslaan in database...</span>
                                </div>
                            ) : saveComplete ? (
                                <div className="flex items-center justify-center gap-2 text-green-400 animate-in zoom-in duration-300">
                                    <CheckCircle2 size={16} />
                                    <span className="text-[10px] font-black uppercase tracking-widest italic">Sessie opgeslagen</span>
                                </div>
                            ) : saveError ? (
                                <div className="flex flex-col items-center gap-1 text-red-400">
                                    <div className="flex items-center gap-2">
                                        <AlertCircle size={14} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">{saveError}</span>
                                    </div>
                                    <span className="text-[8px] opacity-50 uppercase tracking-widest">Controleer API route en database setup</span>
                                </div>
                            ) : null}
                        </div>

                        <button
                            onClick={() => {
                                void handleSummaryContinue();
                            }}
                            className="w-full py-5 bg-white text-black font-black rounded-2xl uppercase tracking-widest text-xs shadow-2xl hover:bg-slate-200 transition-all active:scale-95"
                        >
                            {currentUser?.type === 'USER' ? 'Terug naar Dashboard' : 'Nieuwe Sessie'}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-10">
                        <div className="space-y-4">
                            <div className={`w-20 h-20 mx-auto rounded-full border border-white/10 ${chakra.color} flex items-center justify-center bg-black/40 shadow-2xl transition-colors duration-1000`}>
                                <span className="text-3xl font-black italic">{currentChakraIdx + 1}</span>
                            </div>
                            <h2 className="text-3xl font-black tracking-tighter uppercase italic">
                                {phase === 'BREATHING' ? 'Ademhaling' : 'Herstel en Meditatie'}
                            </h2>
                            <p className="text-[10px] text-slate-400 tracking-[0.3em] uppercase font-black">{chakra.name}</p>
                        </div>

                        <div
                            className="aspect-video w-full rounded-[2.5rem] flex flex-col items-center justify-center gap-4 border border-white/10 relative shadow-inner overflow-hidden"
                            style={{
                                backgroundImage: `linear-gradient(rgba(2, 6, 23, 0.35), rgba(2, 6, 23, 0.85)), url('${chakra.background}')`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                            }}
                        >
                            <div className={`absolute inset-0 opacity-20 ${chakra.color} blur-3xl transition-colors duration-1000`} />
                            <Volume2 className="text-white/40 animate-pulse z-10" size={48} />
                            <p className="text-[9px] uppercase tracking-[0.35em] font-black opacity-60 z-10">Audio speelt af...</p>
                            <p className="text-[9px] uppercase tracking-[0.25em] font-black opacity-80 z-10 px-4 py-2 rounded-full bg-black/45 border border-white/10">
                                Upload chakra-afbeelding naar {chakra.background}
                            </p>
                        </div>

                        <button
                            onClick={handleNext}
                            className="w-full py-5 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center gap-4 font-black uppercase tracking-widest text-xs hover:bg-white/10 transition-all group active:scale-95"
                        >
                            <span>
                                {phase === 'BREATHING'
                                    ? 'Naar Retentie'
                                    : currentChakraIdx < CHAKRAS.length - 1
                                      ? 'Volgende Chakra'
                                      : 'Sessie Voltooien'}
                            </span>
                            <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}
