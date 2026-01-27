
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, MessageSquare, Terminal, RefreshCcw, Power, Volume2 } from 'lucide-react';
import Scene from './components/Scene';
import { decode, decodeAudioData, createPcmBlob } from './utils/audio-helpers';
import { Message, ConnectionStatus } from './types';

const App: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioAmplitude, setAudioAmplitude] = useState(0);
  const [lastTranscript, setLastTranscript] = useState('');
  const [userTranscript, setUserTranscript] = useState('');

  // Refs for audio processing
  const audioCtxRef = useRef<{
    input: AudioContext;
    output: AudioContext;
    inputNode: GainNode;
    outputNode: GainNode;
    sources: Set<AudioBufferSourceNode>;
  } | null>(null);
  const sessionRef = useRef<any>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const nextStartTimeRef = useRef(0);

  const initAudio = useCallback(async () => {
    if (audioCtxRef.current) return audioCtxRef.current;

    const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const inputNode = inputAudioContext.createGain();
    const outputNode = outputAudioContext.createGain();
    
    // Analyser for mouth movement (audio out)
    const analyser = outputAudioContext.createAnalyser();
    analyser.fftSize = 256;
    outputNode.connect(analyser);
    outputNode.connect(outputAudioContext.destination);
    analyserRef.current = analyser;

    audioCtxRef.current = {
      input: inputAudioContext,
      output: outputAudioContext,
      inputNode,
      outputNode,
      sources: new Set<AudioBufferSourceNode>(),
    };

    return audioCtxRef.current;
  }, []);

  const connectToGemini = async () => {
    try {
      setStatus(ConnectionStatus.CONNECTING);
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const audio = await initAudio();
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const session = await ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setStatus(ConnectionStatus.CONNECTED);
            // Start sending mic audio
            const source = audio.input.createMediaStreamSource(stream);
            const scriptProcessor = audio.input.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createPcmBlob(inputData);
              if (sessionRef.current) {
                sessionRef.current.sendRealtimeInput({ media: { data: pcmBlob, mimeType: 'audio/pcm;rate=16000' } });
              }
            };
            
            source.connect(scriptProcessor);
            scriptProcessor.connect(audio.input.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Audio output
            const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData) {
              setIsSpeaking(true);
              const bytes = decode(audioData);
              const buffer = await decodeAudioData(bytes, audio.output, 24000, 1);
              
              const source = audio.output.createBufferSource();
              source.buffer = buffer;
              source.connect(audio.outputNode);
              
              const startAt = Math.max(nextStartTimeRef.current, audio.output.currentTime);
              source.start(startAt);
              nextStartTimeRef.current = startAt + buffer.duration;
              
              audio.sources.add(source);
              source.onended = () => {
                audio.sources.delete(source);
                if (audio.sources.size === 0) setIsSpeaking(false);
              };
            }

            // Handle Transcriptions
            if (message.serverContent?.outputTranscription) {
              setLastTranscript(prev => prev + message.serverContent?.outputTranscription?.text);
            }
            if (message.serverContent?.inputTranscription) {
              setUserTranscript(prev => prev + message.serverContent?.inputTranscription?.text);
            }

            if (message.serverContent?.turnComplete) {
              setMessages(prev => [
                ...prev,
                { role: 'user', text: userTranscript || '...', timestamp: Date.now() },
                { role: 'model', text: lastTranscript || '...', timestamp: Date.now() }
              ]);
              setLastTranscript('');
              setUserTranscript('');
            }

            // Handle interruptions
            if (message.serverContent?.interrupted) {
              audio.sources.forEach(s => s.stop());
              audio.sources.clear();
              nextStartTimeRef.current = 0;
              setIsSpeaking(false);
            }
          },
          onerror: (e) => {
            console.error('Gemini error:', e);
            setStatus(ConnectionStatus.ERROR);
          },
          onclose: () => {
            setStatus(ConnectionStatus.DISCONNECTED);
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: "You are a helpful and charismatic AI avatar named Kai. You live in a 3D digital world. Talk to the user naturally and keep your responses friendly and relatively concise.",
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
          },
          outputAudioTranscription: {},
          inputAudioTranscription: {}
        }
      });

      sessionRef.current = session;
    } catch (error) {
      console.error('Connection failed:', error);
      setStatus(ConnectionStatus.ERROR);
    }
  };

  const disconnect = () => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    setStatus(ConnectionStatus.DISCONNECTED);
  };

  // Update audio amplitude for mouth animation
  useEffect(() => {
    let animationFrame: number;
    const updateAmplitude = () => {
      if (analyserRef.current && isSpeaking) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioAmplitude(average / 128); // Normalize to roughly 0-1
      } else {
        setAudioAmplitude(0);
      }
      animationFrame = requestAnimationFrame(updateAmplitude);
    };
    updateAmplitude();
    return () => cancelAnimationFrame(animationFrame);
  }, [isSpeaking]);

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-slate-900 text-slate-100 overflow-hidden font-sans">
      
      {/* 3D Viewer Side */}
      <div className="relative flex-1 h-2/3 md:h-full">
        <Scene isSpeaking={isSpeaking} audioAmplitude={audioAmplitude} />
        
        {/* Connection Overlay */}
        <div className="absolute top-6 left-6 flex items-center gap-4 bg-slate-900/60 backdrop-blur-md px-4 py-2 rounded-full border border-slate-700">
           <div className={`w-3 h-3 rounded-full ${
             status === ConnectionStatus.CONNECTED ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 
             status === ConnectionStatus.CONNECTING ? 'bg-yellow-500 animate-pulse' : 
             'bg-red-500'
           }`} />
           <span className="text-sm font-medium uppercase tracking-wider">
             {status}
           </span>
        </div>

        {/* Action Bar */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3">
          {status === ConnectionStatus.DISCONNECTED || status === ConnectionStatus.ERROR ? (
            <button 
              onClick={connectToGemini}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-full font-bold shadow-xl transition-all transform hover:scale-105 flex items-center gap-2"
            >
              <Power size={20} />
              Start Conversation
            </button>
          ) : (
            <button 
              onClick={disconnect}
              className="bg-red-600 hover:bg-red-500 text-white px-8 py-4 rounded-full font-bold shadow-xl transition-all transform hover:scale-105 flex items-center gap-2"
            >
              <MicOff size={20} />
              Stop Session
            </button>
          )}
        </div>

        {/* Live Subtitles */}
        {(lastTranscript || userTranscript) && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 w-full max-w-lg px-4 pointer-events-none">
            <div className="bg-black/40 backdrop-blur-sm p-4 rounded-xl border border-white/10 text-center">
              {userTranscript && (
                <p className="text-slate-400 text-sm mb-1 italic">You: {userTranscript}</p>
              )}
              {lastTranscript && (
                <p className="text-white text-lg font-medium">Kai: {lastTranscript}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Control Sidebar / Chat Log */}
      <div className="w-full md:w-96 bg-slate-800/50 backdrop-blur-lg border-l border-slate-700 flex flex-col h-1/3 md:h-full">
        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Terminal size={20} className="text-indigo-400" />
            Interaction Log
          </h2>
          <button onClick={() => setMessages([])} className="text-slate-400 hover:text-white transition-colors">
            <RefreshCcw size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center px-4">
              <MessageSquare size={48} className="mb-4 opacity-20" />
              <p>No messages yet. Start a session and say hello!</p>
            </div>
          ) : (
            messages.map((m, i) => (
              <div 
                key={i} 
                className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                  m.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-tr-none' 
                  : 'bg-slate-700 text-slate-100 rounded-tl-none border border-slate-600'
                }`}>
                  {m.text}
                </div>
                <span className="text-[10px] text-slate-500 mt-1 uppercase">
                  {m.role === 'user' ? 'You' : 'Kai'} • {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="p-6 bg-slate-900/50 border-t border-slate-700">
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-1">
              <Mic size={14} className={status === ConnectionStatus.CONNECTED ? 'text-green-400' : ''} />
              Mic Ready
            </div>
            <div className="flex items-center gap-1">
              <Volume2 size={14} className={isSpeaking ? 'text-indigo-400 animate-pulse' : ''} />
              Audio Out
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
