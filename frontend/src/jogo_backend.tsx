import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Rocket, Zap, Database, Users, Play, Pause, RotateCcw, AlertCircle, Lock, Wifi, WifiOff, TrendingUp } from 'lucide-react';

type Miner = {
  id: number;
  name: string;
  x: number;
  y: number;
  color: string;
  status: 'idle' | 'waiting' | 'mining' | 'terminated';
  mined: number;
  locked: boolean;
  target: string | null;
};

type Resources = { minerals: number; energy: number; crystals: number; };
type Stats = { totalMined: number; conflicts: number; synchronized: number; };
type LogEntry = { time: string; level: 'info'|'success'|'warning'|'error'; message: string; };

const API_BASE = 'http://localhost:8000';

const SpaceMiningGame = () => {
  const [miners, setMiners] = useState<Record<number, Miner>>({});
  const [resources, setResources] = useState<Resources>({ minerals: 100, energy: 100, crystals: 50 });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [stats, setStats] = useState<Stats>({ totalMined: 0, conflicts: 0, synchronized: 0 });
  const [connected, setConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const logsEndRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);

  // Limpar erro após 5 segundos
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Conexão SSE
  useEffect(() => {
    let reconnectTimer: any = null;
    let isUnmounted = false;

    const connect = () => {
      if (isUnmounted) return;

      console.log('🔌 Conectando SSE...');
      const es = new EventSource(`${API_BASE}/api/events`);
      esRef.current = es;

      es.onopen = () => {
        console.log('✅ SSE conectado');
        setConnected(true);
        setError(null);
      };

      es.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          
          if (msg.type === 'state') {
            const d = msg.data;
            setResources(d.resources || { minerals: 0, energy: 0, crystals: 0 });
            setMiners(d.miners || {});
            setStats(d.stats || { totalMined: 0, conflicts: 0, synchronized: 0 });
            setIsRunning(d.isRunning || false);
            
            if (d.logs && Array.isArray(d.logs)) {
              setLogs(d.logs);
            }
          } else if (msg.type === 'log') {
            setLogs(prev => [...prev.slice(-99), msg.data]);
          }
        } catch (e) {
          console.warn('Erro ao processar mensagem:', e);
        }
      };

      es.onerror = () => {
        console.warn('❌ SSE desconectado');
        setConnected(false);
        es.close();
        
        if (!isUnmounted) {
          reconnectTimer = setTimeout(connect, 2000);
        }
      };
    };

    connect();

    return () => {
      isUnmounted = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (esRef.current) esRef.current.close();
    };
  }, []);

  // Ações API
  const apiCall = async (url: string, options: RequestInit = {}) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}${url}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...options.headers }
      });
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Erro na requisição' }));
        throw new Error(err.message || err.error || 'Erro');
      }
      
      return await res.json();
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const toggleRun = async () => {
    try {
      await apiCall(isRunning ? '/api/pause' : '/api/start', { method: 'POST' });
    } catch (e) {
      console.error('Erro toggle:', e);
    }
  };

  const reset = async () => {
    if (!window.confirm('Resetar tudo?')) return;
    try {
      await apiCall('/api/reset', { method: 'POST' });
    } catch (e) {
      console.error('Erro reset:', e);
    }
  };

  const addMiner = async () => {
    try {
      await apiCall('/api/miners', { method: 'POST' });
    } catch (e) {
      console.error('Erro criar:', e);
    }
  };

  const removeMiner = async (id: number, name: string) => {
    if (!window.confirm(`Encerrar ${name}?`)) return;
    try {
      await apiCall(`/api/miners/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.error('Erro remover:', e);
    }
  };

  const minersArray = Object.values(miners);
  const activeMiners = minersArray.length;
  const miningMiners = minersArray.filter(m => m.status === 'mining').length;
  const waitingMiners = minersArray.filter(m => m.status === 'waiting').length;
  const efficiency = stats.synchronized > 0 
    ? Math.round(((stats.synchronized / (stats.synchronized + stats.conflicts)) * 100))
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Erro */}
        {error && (
          <div className="fixed top-4 right-4 z-50 bg-red-500 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3">
            <AlertCircle size={24} />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="fixed inset-0 bg-black/30 z-40 flex items-center justify-center">
            <div className="bg-slate-800 p-6 rounded-xl">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 mb-6 border border-purple-500/30 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
                🚀 Batalha de Mineração Espacial
              </h1>
              <p className="text-slate-400 mt-2 flex items-center gap-3">
                Memória Compartilhada + Multi-Processo (Python)
                <span className="flex items-center gap-2">
                  {connected ? (
                    <><Wifi size={16} className="text-green-400" /><span className="text-green-400">Online</span></>
                  ) : (
                    <><WifiOff size={16} className="text-red-400" /><span className="text-red-400">Offline</span></>
                  )}
                </span>
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={toggleRun}
                disabled={!connected}
                className={`px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition shadow-lg disabled:opacity-30 ${
                  isRunning 
                    ? 'bg-red-500 hover:bg-red-600 text-white' 
                    : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
              >
                {isRunning ? <><Pause size={20} /> Pausar</> : <><Play size={20} /> Iniciar</>}
              </button>
              <button
                onClick={reset}
                disabled={!connected}
                className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-semibold flex items-center gap-2 transition shadow-lg disabled:opacity-30"
              >
                <RotateCcw size={20} /> Reset
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Área de Mineração */}
          <div className="col-span-2 bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-purple-500/30 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Database className="text-purple-400" /> Área de Mineração
              </h2>
              <div className="flex gap-2 text-sm">
                <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full font-semibold">
                  ⛏️ {miningMiners}
                </span>
                <span className="bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full font-semibold">
                  ⏳ {waitingMiners}
                </span>
              </div>
            </div>
            
            <div className="relative bg-slate-900 rounded-xl h-96 overflow-hidden border-2 border-purple-500/30">
              {/* Grid */}
              <div className="absolute inset-0" style={{
                backgroundImage: 'radial-gradient(circle, #8b5cf644 1px, transparent 1px)',
                backgroundSize: '30px 30px'
              }} />
              
              {/* Asteroides */}
              {resources.minerals > 30 && (
                <div 
                  className="absolute top-10 left-20 bg-gray-500 rounded-full opacity-60 transition-all duration-1000"
                  style={{ 
                    width: `${Math.max(32, (resources.minerals / 100) * 64)}px`,
                    height: `${Math.max(32, (resources.minerals / 100) * 64)}px`
                  }}
                />
              )}
              {resources.crystals > 15 && (
                <div 
                  className="absolute top-32 right-32 bg-blue-500 rounded-full opacity-70 transition-all duration-1000 shadow-lg"
                  style={{ 
                    width: `${Math.max(24, (resources.crystals / 50) * 48)}px`,
                    height: `${Math.max(24, (resources.crystals / 50) * 48)}px`
                  }}
                />
              )}
              {resources.minerals > 20 && (
                <div 
                  className="absolute bottom-20 left-48 bg-gray-600 rounded-full opacity-60 transition-all duration-1000"
                  style={{ 
                    width: `${Math.max(40, (resources.minerals / 100) * 80)}px`,
                    height: `${Math.max(40, (resources.minerals / 100) * 80)}px`
                  }}
                />
              )}

              {/* Mineradores */}
              {minersArray.map(miner => (
                <div
                  key={miner.id}
                  className="absolute transition-all duration-500 ease-out"
                  style={{
                    left: `${miner.x}px`,
                    top: `${miner.y}px`,
                    transform: 'translate(-50%, -50%)'
                  }}
                >
                  <div className="relative">
                    {miner.locked && (
                      <div className="absolute -top-10 left-1/2 transform -translate-x-1/2">
                        <div className="bg-yellow-500 rounded-full p-1 animate-bounce">
                          <Lock size={14} className="text-white" />
                        </div>
                      </div>
                    )}
                    
                    {miner.target && (
                      <div className="absolute -top-14 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                        <span className="text-xs font-bold text-white bg-purple-600 px-2 py-1 rounded">
                          {miner.target === 'minerals' ? '⛏️' : '💎'}
                        </span>
                      </div>
                    )}
                    
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center border-4 transition-all ${
                        miner.status === 'mining' ? 'animate-pulse scale-110' : ''
                      }`}
                      style={{ 
                        backgroundColor: miner.color,
                        borderColor: miner.locked ? '#fbbf24' : 'white',
                        boxShadow: miner.locked ? `0 0 20px ${miner.color}` : 'none'
                      }}
                    >
                      <Rocket className="text-white" size={24} />
                    </div>
                    
                    <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap flex flex-col items-center">
                      <span className="text-xs font-bold text-white bg-slate-800 px-2 py-1 rounded">
                        M{miner.id}
                      </span>
                      {miner.mined > 0 && (
                        <span className="text-xs font-bold text-green-400 bg-slate-800 px-2 py-0.5 rounded mt-1">
                          +{miner.mined}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {minersArray.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <Rocket size={64} className="text-slate-600 mx-auto mb-4 opacity-50" />
                    <p className="text-slate-400 text-lg">Nenhum minerador ativo</p>
                    <p className="text-slate-500 text-sm mt-2">Crie um minerador para começar</p>
                  </div>
                </div>
              )}
            </div>

            {/* Recursos */}
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="bg-slate-900 rounded-lg p-4 border border-gray-500/30">
                <div className="text-gray-400 text-sm mb-2 font-semibold">⛏️ Minerais</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-700 rounded-full h-3 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-gray-600 to-gray-400 h-full transition-all duration-500"
                      style={{ width: `${resources.minerals}%` }}
                    />
                  </div>
                  <span className="text-white font-bold text-lg w-12 text-right">
                    {Math.floor(resources.minerals)}
                  </span>
                </div>
              </div>
              
              <div className="bg-slate-900 rounded-lg p-4 border border-blue-500/30">
                <div className="text-blue-400 text-sm mb-2 font-semibold">💎 Cristais</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-700 rounded-full h-3 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-blue-600 to-blue-400 h-full transition-all duration-500"
                      style={{ width: `${(resources.crystals / 50) * 100}%` }}
                    />
                  </div>
                  <span className="text-white font-bold text-lg w-12 text-right">
                    {Math.floor(resources.crystals)}
                  </span>
                </div>
              </div>
              
              <div className="bg-slate-900 rounded-lg p-4 border border-yellow-500/30">
                <div className="text-yellow-400 text-sm mb-2 font-semibold">⚡ Energia</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-700 rounded-full h-3 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-yellow-600 to-yellow-400 h-full transition-all duration-500"
                      style={{ width: `${resources.energy}%` }}
                    />
                  </div>
                  <span className="text-white font-bold text-lg w-12 text-right">
                    {Math.floor(resources.energy)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Painel */}
          <div className="space-y-6">
            {/* Processos */}
            <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-purple-500/30 shadow-xl">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Users className="text-purple-400" /> Processos
              </h3>
              <button
                onClick={addMiner}
                disabled={activeMiners >= 6 || !connected}
                className={`w-full py-3 rounded-lg font-semibold mb-4 transition shadow-lg ${
                  activeMiners >= 6 || !connected
                    ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white'
                }`}
              >
                + Criar Minerador ({activeMiners}/6)
              </button>
              <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
                {minersArray.map(miner => (
                  <div key={miner.id} className="bg-slate-900 rounded-lg p-3 flex items-center justify-between border border-slate-700 hover:border-purple-500/50 transition">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-4 h-4 rounded-full animate-pulse" style={{ backgroundColor: miner.color }} />
                      <div className="flex-1">
                        <div className="text-white font-semibold text-sm flex items-center gap-2">
                          {miner.name}
                          {miner.locked && <Lock size={12} className="text-yellow-400" />}
                        </div>
                        <div className="text-slate-400 text-xs flex items-center gap-2">
                          {miner.status === 'mining' && <span className="text-green-400">⛏️ Minerando</span>}
                          {miner.status === 'waiting' && <span className="text-yellow-400">⏳ Aguardando</span>}
                          {miner.status === 'idle' && <span>💤 Ocioso</span>}
                          {miner.mined > 0 && <span className="text-purple-400">• {miner.mined}</span>}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeMiner(miner.id, miner.name)}
                      className="text-red-400 hover:text-red-300 text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 px-3 py-1 rounded transition"
                    >
                      Kill
                    </button>
                  </div>
                ))}
                {minersArray.length === 0 && (
                  <div className="text-slate-500 text-center py-8 text-sm">
                    <Users size={32} className="mx-auto mb-2 opacity-50" />
                    <p>Nenhum processo ativo</p>
                  </div>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-purple-500/30 shadow-xl">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Zap className="text-yellow-400" /> Estatísticas
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg">
                  <span className="text-slate-400 flex items-center gap-2">
                    <TrendingUp size={16} />Total:
                  </span>
                  <span className="text-white font-bold text-xl">{stats.totalMined}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg">
                  <span className="text-slate-400">Sincronizações:</span>
                  <span className="text-green-400 font-bold text-xl">{stats.synchronized}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg">
                  <span className="text-slate-400">Conflitos:</span>
                  <span className="text-red-400 font-bold text-xl">{stats.conflicts}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg">
                  <span className="text-slate-400">Processos:</span>
                  <span className="text-purple-400 font-bold text-xl">{activeMiners}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg border border-purple-500/30">
                  <span className="text-white font-semibold">Eficiência:</span>
                  <span className="text-white font-bold text-xl">{efficiency}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Logs */}
        <div className="mt-6 bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-purple-500/30 shadow-xl">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <AlertCircle className="text-blue-400" /> Log de Eventos
          </h3>
          <div className="bg-slate-900 rounded-lg p-4 max-h-40 overflow-y-auto custom-scrollbar">
            <div className="space-y-2">
              {logs.map((log, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <span className="text-slate-500 font-mono text-xs">{log.time}</span>
                  <span className={
                    log.level === 'success' ? 'text-green-400' :
                    log.level === 'error' ? 'text-red-400' :
                    log.level === 'warning' ? 'text-yellow-400' :
                    'text-slate-300'
                  }>
                    {log.message}
                  </span>
                </div>
              ))}
              <div ref={logsEndRef} />
              {logs.length === 0 && (
                <div className="text-slate-500 text-center py-4">Aguardando eventos...</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #1e293b;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #8b5cf6;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #a78bfa;
        }
      `}</style>
    </div>
  );
};

export default SpaceMiningGame