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
    recentSessions: {
        id: string;
        createdAt: string;
        totalDuration: number;
        totalRetention: number;
        records: { chakra: string; seconds: number }[];
    }[];
};

type WakeLockSentinelLike = {
    released?: boolean;
    release: () => Promise<void>;
    addEventListener?: (type: 'release', listener: () => void) => void;
};

type NavigatorWithWakeLock = Navigator & {
    wakeLock?: {
        request: (type: 'screen') => Promise<WakeLockSentinelLike>;
    };
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
        focusAudio: '/audio/focus-chakra-1.mp3',
        breathingAudio: '/audio/Breathing-chakra-1.mp3',
        meditationAudio: '/audio/meditation-chakra-1.mp3',
        background: '/images/chakras/chakra-1.png',
    },
    {
        id: 2,
        name: 'Sacraal (Svadhisthana)',
        color: 'bg-orange-500',
        focusAudio: '/audio/focus-chakra-2.mp3',
        breathingAudio: '/audio/breathing-chakra-2.mp3',
        meditationAudio: '/audio/meditation-chakra-2.mp3',
        background: '/images/chakras/chakra-2.png',
    },
    {
        id: 3,
        name: 'Zonnevlecht (Manipura)',
        color: 'bg-yellow-500',
        focusAudio: '/audio/focus-chakra-3.mp3',
        breathingAudio: '/audio/breathing-chakra-3.mp3',
        meditationAudio: '/audio/meditation-chakra-3.mp3',
        background: '/images/chakras/chakra-3.png',
    },
    {
        id: 4,
        name: 'Hart (Anahata)',
        color: 'bg-green-500',
        focusAudio: '/audio/focus-chakra-4.mp3',
        breathingAudio: '/audio/breathing-chakra-4.mp3',
        meditationAudio: '/audio/meditiaton-chakra-4.mp3',
        background: '/images/chakras/chakra-4.png',
    },
    {
        id: 5,
        name: 'Keel (Vishuddha)',
        color: 'bg-blue-500',
        focusAudio: '/audio/focus-chakra-5.mp3',
        breathingAudio: '/audio/breathing-chakra-5.mp3',
        meditationAudio: '/audio/meditation-chakra-5.mp3',
        background: '/images/chakras/chakra-5.png',
    },
    {
        id: 6,
        name: 'Derde Oog (Ajna)',
        color: 'bg-indigo-500',
        focusAudio: '/audio/focus-chakra-6.mp3',
        breathingAudio: '/audio/breathing-chakra-6.mp3',
        meditationAudio: '/audio/meditation-chakra-6.mp3',
        background: '/images/chakras/chakra-6.png',
    },
    {
        id: 7,
        name: 'Kroon (Sahasrara)',
        color: 'bg-purple-500',
        focusAudio: '/audio/focus-chakra-7.mp3',
        breathingAudio: '/audio/breathing-chakra-7.mp3',
        meditationAudio: '/audio/meditation-chakra-7.mp3',
        background: '/images/chakras/chakra-7.png',
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

function formatSessionLabel(isoDate: string): string {
    return new Date(isoDate).toLocaleDateString('nl-NL', {
        day: '2-digit',
        month: '2-digit',
    });
}

function getRetentionByChakra(records: { chakra: string; seconds: number }[], chakraName: string): number {
    const exactMatch = records.find((record) => record.chakra === chakraName);
    if (exactMatch) return exactMatch.seconds;

    const normalizedName = chakraName.toLowerCase();
    const fallbackMatch = records.find((record) => record.chakra.toLowerCase().includes(normalizedName.split(' ')[0]));
    return fallbackMatch?.seconds ?? 0;
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
    const [isInstructionInfoVisible, setIsInstructionInfoVisible] = useState(false);
    const [instructionError, setInstructionError] = useState<string | null>(null);
    const [instructionAudioAvailable, setInstructionAudioAvailable] = useState<boolean | null>(null);
    const [chakraBackgroundAvailability, setChakraBackgroundAvailability] = useState<Record<string, boolean>>({});
    const [wakeLockSupported, setWakeLockSupported] = useState<boolean | null>(null);
    const [wakeLockError, setWakeLockError] = useState<string | null>(null);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const instructionAudioRef = useRef<HTMLAudioElement | null>(null);
    const retentionFocusAudioRef = useRef<HTMLAudioElement | null>(null);
    const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
    const isTransitioningRef = useRef(false);

    const isSessionActivePhase = phase === 'BREATHING' || phase === 'RETENTION' || phase === 'MEDITATION';
    const shouldKeepScreenAwake = isSessionActivePhase || (phase === 'DISCLAIMER' && isInstructionPlaying);

    const stopInstructionAudio = useCallback(() => {
        if (instructionAudioRef.current) {
            instructionAudioRef.current.pause();
            instructionAudioRef.current.currentTime = 0;
            instructionAudioRef.current.onended = null;
            instructionAudioRef.current = null;
        }
        setIsInstructionPlaying(false);
        setIsInstructionInfoVisible(false);
    }, []);

    const stopRetentionFocusAudio = useCallback(() => {
        if (!retentionFocusAudioRef.current) return;
        retentionFocusAudioRef.current.pause();
        retentionFocusAudioRef.current.currentTime = 0;
        retentionFocusAudioRef.current = null;
    }, []);

    const releaseWakeLock = useCallback(async () => {
        const activeLock = wakeLockRef.current;
        if (!activeLock) return;

        try {
            await activeLock.release();
        } catch {
            // no-op
        } finally {
            wakeLockRef.current = null;
        }
    }, []);

    const requestWakeLock = useCallback(async () => {
        if (typeof window === 'undefined') return;

        const nav = navigator as NavigatorWithWakeLock;
        if (!nav.wakeLock?.request) {
            setWakeLockSupported(false);
            return;
        }

        if (document.visibilityState !== 'visible') return;
        if (wakeLockRef.current && !wakeLockRef.current.released) return;

        try {
            const lock = await nav.wakeLock.request('screen');
            wakeLockRef.current = lock;
            setWakeLockSupported(true);
            setWakeLockError(null);
            lock.addEventListener?.('release', () => {
                wakeLockRef.current = null;
            });
        } catch {
            setWakeLockSupported(true);
            setWakeLockError('Kon scherm niet wakker houden. Zet Auto-Lock tijdelijk uit als fallback.');
        }
    }, []);

    const toggleInstructionAudio = useCallback(() => {
        if (isInstructionPlaying) {
            stopInstructionAudio();
            return;
        }

        setInstructionError(null);
        setIsInstructionInfoVisible(true);
        const audio = new Audio('/audio/Instructions.mp3');
        audio.preload = 'auto';
        audio.load();
        instructionAudioRef.current = audio;
        setIsInstructionPlaying(true);

        audio.onended = () => {
            setIsInstructionPlaying(false);
            instructionAudioRef.current = null;
            void releaseWakeLock();
        };

        audio.onerror = () => {
            setIsInstructionPlaying(false);
            setInstructionError('Kon Instructions.mp3 niet afspelen.');
            instructionAudioRef.current = null;
            void releaseWakeLock();
        };

        audio.play().catch(() => {
            setIsInstructionPlaying(false);
            setInstructionError('Autoplay geblokkeerd of audio niet gevonden.');
            instructionAudioRef.current = null;
            void releaseWakeLock();
        });
        void requestWakeLock();
    }, [isInstructionPlaying, stopInstructionAudio, requestWakeLock, releaseWakeLock]);

    useEffect(() => {
        let cancelled = false;

        fetch('/audio/Instructions.mp3', { method: 'HEAD' })
            .then((response) => {
                if (cancelled) return;
                setInstructionAudioAvailable(response.ok);
            })
            .catch(() => {
                if (cancelled) return;
                setInstructionAudioAvailable(false);
            });

        return () => {
            cancelled = true;
        };
    }, []);

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
        let currentAudio: HTMLAudioElement | null = null;
        let sequence: string[] = [];

        if (phase === 'BREATHING') {
            sequence = [CHAKRAS[currentChakraIdx].focusAudio, CHAKRAS[currentChakraIdx].breathingAudio];
        } else if (phase === 'MEDITATION') {
            sequence = [CHAKRAS[currentChakraIdx].focusAudio, CHAKRAS[currentChakraIdx].meditationAudio];
        }

        const preloadedPlayers = sequence.map((source) => {
            const player = new Audio(source);
            player.preload = 'auto';
            player.load();
            return player;
        });

        const playSequenceAt = (index: number) => {
            if (!active) return;

            if (index >= sequence.length) {
                handleNext();
                return;
            }

            currentAudio = preloadedPlayers[index] ?? new Audio(sequence[index]);
            audioRef.current = currentAudio;

            currentAudio.onended = () => {
                playSequenceAt(index + 1);
            };

            currentAudio.onerror = () => {
                playSequenceAt(index + 1);
            };

            currentAudio.play().catch(() => {
                // no-op for autoplay restrictions
            });
        };

        if (sequence.length > 0) {
            playSequenceAt(0);
        }

        return () => {
            active = false;
            if (currentAudio) {
                currentAudio.pause();
                currentAudio.onended = null;
                currentAudio.onerror = null;
            }
            preloadedPlayers.forEach((player) => {
                if (player === currentAudio) return;
                player.pause();
                player.onended = null;
                player.onerror = null;
            });
            if (audioRef.current === currentAudio) {
                audioRef.current = null;
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
        if (phase !== 'RETENTION') {
            stopRetentionFocusAudio();
            return;
        }

        const focusAudio = new Audio('/audio/retention-focus.mp3');
        focusAudio.loop = true;
        focusAudio.volume = 1;
        retentionFocusAudioRef.current = focusAudio;
        void focusAudio.play().catch(() => {
            // no-op for autoplay restrictions
        });

        return () => {
            if (retentionFocusAudioRef.current === focusAudio) {
                stopRetentionFocusAudio();
            } else {
                focusAudio.pause();
                focusAudio.currentTime = 0;
            }
        };
    }, [phase, stopRetentionFocusAudio]);

    useEffect(() => {
        if (phase !== 'SUMMARY') return;
        if (history.length !== CHAKRAS.length) return;
        if (isSaving || saveComplete || saveError) return;
        void handleSaveSession(history, totalDuration);
    }, [phase, history, totalDuration, isSaving, saveComplete, saveError, handleSaveSession]);

    useEffect(() => {
        if (shouldKeepScreenAwake) {
            void requestWakeLock();
        } else {
            void releaseWakeLock();
            setWakeLockError(null);
        }
    }, [shouldKeepScreenAwake, requestWakeLock, releaseWakeLock]);

    useEffect(() => {
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible' && shouldKeepScreenAwake) {
                void requestWakeLock();
            }
        };

        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [shouldKeepScreenAwake, requestWakeLock]);

    useEffect(() => {
        if (phase !== 'DISCLAIMER') {
            stopInstructionAudio();
            setInstructionError(null);
        }
    }, [phase, stopInstructionAudio]);

    useEffect(() => {
        let cancelled = false;

        CHAKRAS.forEach((chakra) => {
            const image = new Image();
            image.onload = () => {
                if (cancelled) return;
                setChakraBackgroundAvailability((prev) => ({ ...prev, [chakra.background]: true }));
            };
            image.onerror = () => {
                if (cancelled) return;
                setChakraBackgroundAvailability((prev) => ({ ...prev, [chakra.background]: false }));
            };
            image.src = chakra.background;
        });

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        return () => {
            stopRetentionFocusAudio();
            void releaseWakeLock();
        };
    }, [releaseWakeLock, stopRetentionFocusAudio]);

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
                        {isInstructionPlaying ? 'Stop Instructies' : 'Instructies'}
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

                {isInstructionInfoVisible ? (
                    <div className="mt-5 w-full max-w-sm rounded-2xl border border-white/15 bg-slate-800/60 p-4 text-left">
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300 mb-2">Instructies</p>
                        <div className="space-y-3 text-xs leading-relaxed text-slate-200">
                            <p>
                                Deze app begeleidt een enorme kickstart van je dag door intensieve ademhalingsoefeningen (AM & WHM) te combineren met mindfulness. Doe de oefening bij voorkeur voor je eerste maaltijd en je bruist van energie:
                            </p>
                            <p>
                                Neem een stabiele, comfortabele zithouding aan. Volg de ademhalingsbegeleiding per positie (chakra) zoals aangegeven op de afbeelding.
                            </p>
                            <p>
                                Blijf na elke ronde zo lang als comfortabel is uitgeademd (retentie) en raak het scherm aan om naar de meditatie en herstelademhaling te gaan. Forceer de retentie niet!
                            </p>
                            <p>
                                Tijdens de meditatie focus je je eerst (nog uitgeademd) op de betreffende positie, daarna adem je diep in (volgens instructie) en hou je je adem een aantal tellen in terwijl je de route van alle reeds behandelde posities vanaf je stuit richting de kroon van je hoofd voorstelt als een kolkende energie.
                            </p>
                            <p>Na de herstelademhaling en meditatie, ga je automatisch door naar de volgende chakra.</p>
                            <p>Nadat alle posities behandeld zijn, is er tijd voor een korte meditatie waarna je klaar bent voor de dag!</p>
                        </div>
                    </div>
                ) : null}

                {instructionError ? <p className="mt-4 text-xs text-red-400">{instructionError}</p> : null}
                {instructionAudioAvailable === false ? (
                    <p className="mt-4 text-[10px] text-slate-500 uppercase tracking-widest">Plaats `public/audio/Instructions.mp3` om deze knop te activeren</p>
                ) : null}
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
        const comparisonSessions = (userStats?.recentSessions ?? []).slice(0, 4);
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
                                        <span className="font-mono">{formatDuration(session.totalDuration)} | R: {session.totalRetention}s</span>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                        <p className="text-xs font-black uppercase tracking-widest mb-3">Progressie per chakra (sessievergelijking)</p>
                        {(comparisonSessions.length === 0 || isStatsLoading || statsError) ? (
                            <p className="text-sm text-slate-400">Nog niet genoeg data voor progressievergelijking.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-[720px] w-full text-xs">
                                    <thead>
                                        <tr className="border-b border-white/10 text-slate-300">
                                            <th className="text-left py-2 pr-3">Chakra</th>
                                            {comparisonSessions.map((session, index) => (
                                                <th key={session.id} className="text-center py-2 px-2">
                                                    Sessie {comparisonSessions.length - index}
                                                    <div className="text-[10px] font-normal text-slate-500">{formatSessionLabel(session.createdAt)}</div>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {CHAKRAS.map((chakraItem) => (
                                            <tr key={chakraItem.id} className="border-b border-white/5">
                                                <td className="py-2 pr-3 text-slate-300">{chakraItem.name}</td>
                                                {comparisonSessions.map((session) => (
                                                    <td key={`${session.id}-${chakraItem.id}`} className="py-2 px-2 text-center font-mono">
                                                        {getRetentionByChakra(session.records, chakraItem.name)}s
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                        <tr className="border-t border-white/15">
                                            <td className="py-2 pr-3 font-black text-white uppercase tracking-widest">Totaal retentie</td>
                                            {comparisonSessions.map((session) => (
                                                <td key={`${session.id}-total`} className="py-2 px-2 text-center font-black text-cyan-300">
                                                    {session.totalRetention}s
                                                </td>
                                            ))}
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        )}
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
                    backgroundSize: 'contain',
                    backgroundPosition: 'center bottom',
                    backgroundRepeat: 'no-repeat',
                    backgroundColor: '#020617',
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

                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[min(92vw,420px)]" onClick={(event) => event.stopPropagation()}>
                    <p className="text-[10px] text-slate-300 text-center bg-black/45 border border-white/10 rounded-lg px-3 py-2">
                        {wakeLockSupported === false
                            ? 'Wake Lock niet ondersteund in deze browser. Gebruik Safari of zet Auto-Lock tijdelijk uit.'
                            : wakeLockError
                                ? wakeLockError
                                : 'Scherm wakker houden actief tijdens sessie.'}
                    </p>
                </div>
            </div>
        );
    }

    const chakra = CHAKRAS[currentChakraIdx];
    const isChakraBackgroundMissing = chakraBackgroundAvailability[chakra.background] === false;

    return (
        <div className="flex flex-col items-center justify-center min-h-[100dvh] p-4 sm:p-6 bg-slate-950 text-white relative overflow-hidden font-sans">
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
                    <div className="space-y-5 sm:space-y-8">
                        <div className="space-y-3 sm:space-y-4">
                            <div className={`w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-full border border-white/10 ${chakra.color} flex items-center justify-center bg-black/40 shadow-2xl transition-colors duration-1000`}>
                                <span className="text-2xl sm:text-3xl font-black italic">{currentChakraIdx + 1}</span>
                            </div>
                            <h2 className="text-[2rem] sm:text-3xl font-black tracking-tighter uppercase italic leading-[0.95]">
                                {phase === 'BREATHING' ? 'Ademhaling' : 'Herstel en Meditatie'}
                            </h2>
                            <p className="text-[9px] sm:text-[10px] text-slate-400 tracking-[0.28em] uppercase font-black">{chakra.name}</p>
                        </div>

                        <div
                            className="h-[42vh] max-h-[420px] min-h-[260px] sm:h-[46vh] w-full rounded-[2rem] sm:rounded-[2.5rem] flex flex-col items-center justify-center gap-4 border border-white/10 relative shadow-inner overflow-hidden"
                            style={{
                                backgroundImage: `linear-gradient(rgba(2, 6, 23, 0.35), rgba(2, 6, 23, 0.85)), url('${chakra.background}')`,
                                backgroundSize: 'contain',
                                backgroundPosition: 'center bottom',
                                backgroundRepeat: 'no-repeat',
                                backgroundColor: '#0f172a',
                            }}
                        >
                            <div className={`absolute inset-0 opacity-20 ${chakra.color} blur-3xl transition-colors duration-1000`} />
                            <Volume2 className="text-white/40 animate-pulse z-10" size={48} />
                            <p className="text-[9px] uppercase tracking-[0.35em] font-black opacity-60 z-10">Audio speelt af...</p>
                            {isChakraBackgroundMissing ? (
                                <p className="text-[9px] uppercase tracking-[0.25em] font-black opacity-80 z-10 px-4 py-2 rounded-full bg-black/45 border border-white/10">
                                    Upload chakra-afbeelding naar {chakra.background}
                                </p>
                            ) : null}
                        </div>

                        <button
                            onClick={handleNext}
                            className="w-full py-4 sm:py-5 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center gap-4 font-black uppercase tracking-widest text-xs hover:bg-white/10 transition-all group active:scale-95"
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
