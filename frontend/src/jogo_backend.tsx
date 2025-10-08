
import React, { useState, useEffect, useRef } from 'react';
import { Rocket, Zap, Database, Users, Play, Pause, RotateCcw, AlertCircle, Lock } from 'lucide-react';

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

const API = (path: string) => `http://localhost:8000${path}`;

const SpaceMiningGameBackend = () => {
  const [miners, setMiners] = useState<Record<number, Miner>>({});
  const [resources, setResources] = useState<Resources>({ minerals: 100, energy: 100, crystals: 50 });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [stats, setStats] = useState<Stats>({ totalMined: 0, conflicts: 0, synchronized: 0 });

  // Initial fetch + SSE
  useEffect(() => {
    fetch(API('/api/state'))
      .then(r => r.json())
      .then(snap => {
        setResources(snap.resources);
        setMiners(snap.miners);
        setStats(snap.stats);
        setLogs(snap.logs);
        setIsRunning(snap.isRunning);
      });

    const es = new EventSource(API('/api/events'));
    es.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === 'state') {
          const d = msg.data;
          setResources(d.resources);
          setMiners(d.miners);
          setStats(d.stats);
          setIsRunning(d.isRunning);
        } else if (msg.type === 'log') {
          setLogs(prev => [...prev.slice(-49), msg.data]);
        }
      } catch { /* ignore */ }
    };
    es.onerror = () => { /* network or server unreachable */ };

    return () => es.close();
  }, []);

  const toggleRun = async () => {
    const path = isRunning ? '/api/pause' : '/api/start';
    const r = await fetch(API(path), { method: 'POST' });
    const data = await r.json();
    setIsRunning(data.isRunning);
  };

  const reset = async () => {
    await fetch(API('/api/reset'), { method: 'POST' });
    const snap = await (await fetch(API('/api/state'))).json();
    setResources(snap.resources);
    setMiners(snap.miners);
    setStats(snap.stats);
    setLogs(snap.logs);
    setIsRunning(snap.isRunning);
  };

  const addMiner = async () => {
    await fetch(API('/api/miners'), { method: 'POST' });
  };

  const removeMiner = async (id: number) => {
    await fetch(API(`/api/miners/${id}`), { method: 'DELETE' });
  };

  // UI (idêntico ao original, mas sem simulação local)
  const minersArray = Object.values(miners);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-purple-500/30">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
                🚀 Batalha de Mineração Espacial
              </h1>
              <p className="text-slate-400 mt-2">Sistema de Memória Compartilhada com Sincronização Multi-Processo (Python backend)</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={toggleRun}
                className={`px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all ${
                  isRunning 
                    ? 'bg-red-500 hover:bg-red-600 text-white' 
                    : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
              >
                {isRunning ? <><Pause size={20} /> Pausar</> : <><Play size={20} /> Iniciar</>}
              </button>
              <button
                onClick={reset}
                className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-semibold flex items-center gap-2 transition-all"
              >
                <RotateCcw size={20} /> Reset
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Área de Mineração */}
          <div className="col-span-2 bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/30">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <Database className="text-purple-400" /> Área de Mineração (Memória Compartilhada)
            </h2>
            <div className="relative bg-slate-900 rounded-xl h-96 overflow-hidden border-2 border-purple-500/30">
              {/* Grid de fundo */}
              <div className="absolute inset-0" style={{
                backgroundImage: 'radial-gradient(circle, #8b5cf644 1px, transparent 1px)',
                backgroundSize: '30px 30px'
              }} />
              
              {/* Asteroides (recursos) */}
              {resources.minerals > 50 && (
                <div className="absolute top-10 left-20 w-16 h-16 bg-gray-500 rounded-full opacity-60" />
              )}
              {resources.crystals > 30 && (
                <div className="absolute top-32 right-32 w-12 h-12 bg-blue-500 rounded-full opacity-60" />
              )}
              {resources.minerals > 30 && (
                <div className="absolute bottom-20 left-48 w-20 h-20 bg-gray-600 rounded-full opacity-60" />
              )}

              {/* Mineradores (posições vindas do backend) */}
              {minersArray.map(miner => (
                <div
                  key={miner.id}
                  className="absolute transition-all duration-500"
                  style={{
                    left: `${miner.x}px`,
                    top: `${miner.y}px`,
                    transform: 'translate(-50%, -50%)'
                  }}
                >
                  <div className="relative">
                    {miner.locked && (
                      <div className="absolute -top-8 left-1/2 transform -translate-x-1/2">
                        <Lock size={16} className="text-yellow-400 animate-pulse" />
                      </div>
                    )}
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center border-4 transition-all ${
                        miner.status === 'mining' ? 'animate-pulse scale-110' : ''
                      }`}
                      style={{ 
                        backgroundColor: miner.color,
                        borderColor: miner.locked ? '#fbbf24' : 'white'
                      }}
                    >
                      <Rocket className="text-white" size={24} />
                    </div>
                    <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                      <span className="text-xs font-bold text-white bg-slate-800 px-2 py-1 rounded">
                        M{miner.id}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Recursos */}
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="bg-slate-900 rounded-lg p-4 border border-gray-500/30">
                <div className="text-gray-400 text-sm mb-1">Minerais</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-700 rounded-full h-3 overflow-hidden">
                    <div 
                      className="bg-gray-500 h-full transition-all duration-300"
                      style={{ width: `${resources.minerals}%` }}
                    />
                  </div>
                  <span className="text-white font-bold">{Math.floor(resources.minerals)}</span>
                </div>
              </div>
              <div className="bg-slate-900 rounded-lg p-4 border border-blue-500/30">
                <div className="text-blue-400 text-sm mb-1">Cristais</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-700 rounded-full h-3 overflow-hidden">
                    <div 
                      className="bg-blue-500 h-full transition-all duration-300"
                      style={{ width: `${(resources.crystals / 50) * 100}%` }}
                    />
                  </div>
                  <span className="text-white font-bold">{Math.floor(resources.crystals)}</span>
                </div>
              </div>
              <div className="bg-slate-900 rounded-lg p-4 border border-yellow-500/30">
                <div className="text-yellow-400 text-sm mb-1">Energia</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-700 rounded-full h-3 overflow-hidden">
                    <div 
                      className="bg-yellow-500 h-full transition-all duration-300"
                      style={{ width: `${resources.energy}%` }}
                    />
                  </div>
                  <span className="text-white font-bold">{Math.floor(resources.energy)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Painel de Controle */}
          <div className="space-y-6">
            {/* Gerenciador de Processos */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/30">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Users className="text-purple-400" /> Processos
              </h3>
              <button
                onClick={addMiner}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white py-3 rounded-lg font-semibold mb-4 transition-all"
              >
                + Criar Minerador
              </button>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {minersArray.map(miner => (
                  <div key={miner.id} className="bg-slate-900 rounded-lg p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: miner.color }} />
                      <div>
                        <div className="text-white font-semibold text-sm">{miner.name}</div>
                        <div className="text-slate-400 text-xs">
                          {miner.status === 'mining' && '⛏️ Minerando'}
                          {miner.status === 'waiting' && '⏳ Aguardando'}
                          {miner.status === 'idle' && '💤 Ocioso'}
                          {miner.status === 'terminated' && '🛑 Encerrado'}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeMiner(miner.id)}
                      className="text-red-400 hover:text-red-300 text-xs"
                    >
                      Kill
                    </button>
                  </div>
                ))}
                {minersArray.length === 0 && (
                  <div className="text-slate-500 text-center py-4 text-sm">
                    Nenhum processo ativo
                  </div>
                )}
              </div>
            </div>

            {/* Estatísticas */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/30">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Zap className="text-yellow-400" /> Estatísticas
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Total Minerado:</span>
                  <span className="text-white font-bold">{stats.totalMined}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Sincronizações:</span>
                  <span className="text-green-400 font-bold">{stats.synchronized}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Conflitos:</span>
                  <span className="text-red-400 font-bold">{stats.conflicts}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Processos Ativos:</span>
                  <span className="text-purple-400 font-bold">{minersArray.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Log de Eventos */}
        <div className="mt-6 bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/30">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <AlertCircle className="text-blue-400" /> Log de Eventos (Sincronização)
          </h3>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {logs.map((log, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <span className="text-slate-500 font-mono">{log.time}</span>
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
            {logs.length === 0 && (
              <div className="text-slate-500 text-center py-4">Aguardando eventos...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpaceMiningGameBackend;
