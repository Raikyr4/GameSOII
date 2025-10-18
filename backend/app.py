import os
import time
import json
import random
import multiprocessing as mp
from dataclasses import dataclass
from typing import Any, Dict, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

# Windows usa 'spawn'; defina cedo
if __name__ != "__main__":
    try:
        mp.set_start_method("spawn", force=True)
    except RuntimeError:
        pass

# ----------------------------
# Handles compartilháveis (pickláveis)
# ----------------------------
@dataclass
class SharedHandles:
    minerals: Any
    energy: Any
    crystals: Any
    running: Any
    stats: Any
    logs: Any
    shared_mem: Any
    miners: Any
    sem: Any
    lock: Any
    events_queue: Any

# ----------------------------
# Estado (apenas no processo-pai)
# ----------------------------
@dataclass
class State:
    manager: Any
    minerals: Any
    energy: Any
    crystals: Any
    running: Any
    stats: Any
    logs: Any
    shared_mem: Any
    miners: Any
    sem: Any
    lock: Any
    events_queue: Any
    processes: Dict[int, mp.Process]
    regen_proc: Optional[mp.Process] = None

    def handles(self) -> SharedHandles:
        return SharedHandles(
            minerals=self.minerals,
            energy=self.energy,
            crystals=self.crystals,
            running=self.running,
            stats=self.stats,
            logs=self.logs,
            shared_mem=self.shared_mem,
            miners=self.miners,
            sem=self.sem,
            lock=self.lock,
            events_queue=self.events_queue,
        )

STATE: Optional[State] = None

def init_state() -> State:
    global STATE
    if STATE is not None:
        return STATE
    manager = mp.Manager()
    STATE = State(
        manager=manager,
        minerals=mp.Value('i', 100),
        energy=mp.Value('i', 100),
        crystals=mp.Value('i', 50),
        running=mp.Value('b', False),
        stats=manager.dict({
            "totalMined": 0, 
            "conflicts": 0, 
            "synchronized": 0,
            "energyDepleted": 0
        }),
        logs=manager.list(),
        shared_mem=manager.list(),
        miners=manager.dict(),
        sem=mp.Semaphore(1),
        lock=mp.Lock(),
        events_queue=mp.Queue(maxsize=1000),
        processes={}
    )
    return STATE

# ----------------------------
# Helpers
# ----------------------------
COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']

def push_log(h: SharedHandles, message: str, level: str = "info") -> None:
    ts = time.strftime("%H:%M:%S")
    entry = {"time": ts, "level": level, "message": message}
    try:
        h.logs.append(entry)
        while len(h.logs) > 200:
            try:
                h.logs.pop(0)
            except:
                break
    except:
        pass
    
    try:
        h.events_queue.put_nowait({"type": "log", "data": entry})
    except:
        pass

def make_state_from_handles(h: SharedHandles) -> Dict[str, Any]:
    try:
        return {
            "resources": {
                "minerals": int(h.minerals.value),
                "energy": int(h.energy.value),
                "crystals": int(h.crystals.value),
            },
            "stats": {
                "totalMined": int(h.stats.get("totalMined", 0)),
                "conflicts": int(h.stats.get("conflicts", 0)),
                "synchronized": int(h.stats.get("synchronized", 0)),
                "energyDepleted": int(h.stats.get("energyDepleted", 0)),
            },
            "miners": {int(k): dict(h.miners[k]) for k in list(h.miners.keys())},
            "isRunning": bool(h.running.value),
        }
    except:
        return {
            "resources": {"minerals": 0, "energy": 0, "crystals": 0},
            "stats": {"totalMined": 0, "conflicts": 0, "synchronized": 0, "energyDepleted": 0},
            "miners": {},
            "isRunning": False,
        }

def snapshot(s: State) -> Dict[str, Any]:
    base = make_state_from_handles(s.handles())
    try:
        base["logs"] = list(s.logs)[-50:]
    except:
        base["logs"] = []
    return base

def emit_state(s: State) -> None:
    try:
        s.events_queue.put_nowait({"type": "state", "data": make_state_from_handles(s.handles())})
    except:
        pass

# ----------------------------
# Workers
# ----------------------------
def miner_worker(miner_id: int, h: SharedHandles):
    random.seed(os.getpid() ^ int(time.time()))
    name = f"Minerador-{miner_id}"
    
    print(f"[WORKER {miner_id}] Iniciando processo PID={os.getpid()}")

    # Registro inicial
    try:
        h.miners[miner_id] = {
            "id": miner_id,
            "name": name,
            "x": random.random() * 650 + 25,
            "y": random.random() * 350 + 25,
            "color": COLORS[miner_id % len(COLORS)],
            "status": "idle",
            "mined": 0,
            "locked": False,
            "target": None
        }
        push_log(h, f"✅ {name} iniciado (PID: {os.getpid()})", "success")
    except Exception as e:
        print(f"[WORKER {miner_id}] Erro no registro: {e}")
        return

    try:
        iteration = 0
        while True:
            iteration += 1
            
            # Verifica se deve continuar
            try:
                is_running = h.running.value
            except:
                break

            if not is_running:
                time.sleep(0.5)
                # Movimento sutil quando pausado
                if random.random() < 0.2:
                    try:
                        m = dict(h.miners.get(miner_id, {}))
                        m["x"] = max(25, min(675, m["x"] + random.uniform(-10, 10)))
                        m["y"] = max(25, min(375, m["y"] + random.uniform(-10, 10)))
                        m["status"] = "idle"
                        h.miners[miner_id] = m
                    except:
                        pass
                continue

            # Decide se vai tentar minerar
            attempt = random.random() < 0.7
            target = "minerals" if random.random() < 0.6 else "crystals"

            # Atualiza status: aguardando
            try:
                m = dict(h.miners.get(miner_id, {}))
                m["target"] = target
                m["status"] = "waiting"
                m["locked"] = False
                h.miners[miner_id] = m
            except:
                pass

            if attempt:
                # VERIFICA ENERGIA ANTES DE TENTAR MINERAR
                energy_needed = 5 if target == "minerals" else 8
                
                if h.energy.value < energy_needed:
                    # Sem energia suficiente!
                    try:
                        m = dict(h.miners.get(miner_id, {}))
                        m["status"] = "no_energy"
                        m["target"] = None
                        h.miners[miner_id] = m
                        
                        if random.random() < 0.15:  # Log ocasional
                            push_log(h, f"⚠️ {name} sem energia suficiente", "warning")
                            h.stats["energyDepleted"] = int(h.stats.get("energyDepleted", 0)) + 1
                    except:
                        pass
                    
                    time.sleep(0.8)
                    continue
                
                # Tenta adquirir semáforo
                acquired = h.sem.acquire(timeout=1.0)
                
                if not acquired:
                    # Conflito!
                    try:
                        h.stats["conflicts"] = int(h.stats.get("conflicts", 0)) + 1
                        m = dict(h.miners.get(miner_id, {}))
                        m["status"] = "blocked"
                        h.miners[miner_id] = m
                        print(f"[WORKER {miner_id}] Conflito detectado!")
                    except:
                        pass
                    time.sleep(0.4 + random.random() * 0.5)
                    continue

                # Entrou na seção crítica
                try:
                    # Marca como minerando
                    try:
                        m = dict(h.miners.get(miner_id, {}))
                        m["locked"] = True
                        m["status"] = "mining"
                        h.miners[miner_id] = m
                    except:
                        pass

                    # Simula tempo de mineração
                    time.sleep(0.4 + random.random() * 0.5)

                    # VERIFICA ENERGIA NOVAMENTE (pode ter sido consumida por outro)
                    if h.energy.value < energy_needed:
                        push_log(h, f"⚠️ {name} ficou sem energia durante mineração", "warning")
                        h.stats["energyDepleted"] = int(h.stats.get("energyDepleted", 0)) + 1
                    else:
                        # Minera recurso
                        try:
                            if target == "minerals" and h.minerals.value > 0:
                                delta = min(5, h.minerals.value)
                                h.minerals.value -= delta
                                h.energy.value = max(0, h.energy.value - 5)  # CONSUMO AUMENTADO
                                h.stats["totalMined"] = int(h.stats.get("totalMined", 0)) + delta
                                h.stats["synchronized"] = int(h.stats.get("synchronized", 0)) + 1

                                m = dict(h.miners[miner_id])
                                m["mined"] = int(m.get("mined", 0)) + delta
                                h.miners[miner_id] = m

                                push_log(h, f"⛏️ {name} minerou {delta} minerais (-5 energia)", "success")
                                print(f"[WORKER {miner_id}] Minerou {delta} minerais (Energia: {h.energy.value})")

                            elif target == "crystals" and h.crystals.value > 0:
                                delta = min(3, h.crystals.value)
                                h.crystals.value -= delta
                                h.energy.value = max(0, h.energy.value - 8)  # CONSUMO AUMENTADO
                                h.stats["totalMined"] = int(h.stats.get("totalMined", 0)) + delta
                                h.stats["synchronized"] = int(h.stats.get("synchronized", 0)) + 1

                                m = dict(h.miners[miner_id])
                                m["mined"] = int(m.get("mined", 0)) + delta
                                h.miners[miner_id] = m

                                push_log(h, f"💎 {name} coletou {delta} cristais (-8 energia)", "success")
                                print(f"[WORKER {miner_id}] Coletou {delta} cristais (Energia: {h.energy.value})")

                            # Move após minerar
                            m = dict(h.miners[miner_id])
                            m["x"] = max(25, min(675, m["x"] + random.uniform(-80, 80)))
                            m["y"] = max(25, min(375, m["y"] + random.uniform(-60, 60)))
                            h.miners[miner_id] = m

                        except Exception as e:
                            print(f"[WORKER {miner_id}] Erro ao minerar: {e}")

                finally:
                    # Libera lock e semáforo
                    try:
                        m = dict(h.miners.get(miner_id, {}))
                        m["locked"] = False
                        m["status"] = "idle"
                        m["target"] = None
                        h.miners[miner_id] = m
                    except:
                        pass
                    
                    h.sem.release()
                    
                    # EMITE ESTADO APÓS MINERAÇÃO
                    try:
                        h.events_queue.put_nowait({"type": "state", "data": make_state_from_handles(h)})
                    except:
                        pass

            else:
                # Movimento sem minerar
                try:
                    m = dict(h.miners.get(miner_id, {}))
                    m["x"] = max(25, min(675, m["x"] + random.uniform(-20, 20)))
                    m["y"] = max(25, min(375, m["y"] + random.uniform(-15, 15)))
                    m["status"] = "idle"
                    m["target"] = None
                    h.miners[miner_id] = m
                except:
                    pass

            # Pausa entre ações
            time.sleep(0.5 + random.random() * 0.7)

    except KeyboardInterrupt:
        print(f"[WORKER {miner_id}] Interrompido por usuário")
    except Exception as ex:
        print(f"[WORKER {miner_id}] Erro fatal: {ex}")
        push_log(h, f"❌ {name} falhou: {ex}", "error")
    finally:
        try:
            if miner_id in h.miners:
                d = dict(h.miners[miner_id])
                d["status"] = "terminated"
                h.miners[miner_id] = d
        except:
            pass
        push_log(h, f"🛑 {name} finalizado", "warning")
        print(f"[WORKER {miner_id}] Processo finalizado")

def regenerator_worker(h: SharedHandles):
    print("[REGEN] Processo de regeneração iniciado")
    try:
        tick = 0
        while True:
            tick += 1
            try:
                # REGENERAÇÃO MAIS LENTA E BALANCEADA
                h.minerals.value = min(100, h.minerals.value + 1)  # Reduzido de 2 para 1
                h.energy.value = min(100, h.energy.value + 2)      # Reduzido de 3 para 2
                
                # Cristais a cada 5 ticks (~1.25 segundos)
                if tick % 5 == 0:
                    h.crystals.value = min(50, h.crystals.value + 1)
                
                # Log de energia baixa
                if h.energy.value < 20 and tick % 8 == 0:
                    push_log(h, f"⚡ Energia baixa: {h.energy.value}%", "warning")
                    
            except Exception as e:
                print(f"[REGEN] Erro ao regenerar: {e}")

            try:
                h.events_queue.put_nowait({"type": "state", "data": make_state_from_handles(h)})
            except:
                pass

            time.sleep(0.25)  # 4 vezes por segundo
    except KeyboardInterrupt:
        print("[REGEN] Interrompido")
    except Exception as e:
        print(f"[REGEN] Erro: {e}")

# ----------------------------
# FastAPI
# ----------------------------
app = FastAPI(title="Shared Memory Mining", version="2.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def _startup():
    print("=" * 60)
    print("🚀 Iniciando servidor FastAPI")
    print("=" * 60)
    s = init_state()
    if s.regen_proc is None or not s.regen_proc.is_alive():
        p = mp.Process(target=regenerator_worker, args=(s.handles(),), daemon=True)
        p.start()
        s.regen_proc = p
        print(f"✅ Regenerador iniciado (PID: {p.pid})")
        push_log(s.handles(), "🔧 Regenerador de recursos iniciado", "info")
        emit_state(s)

@app.get("/api/state")
def get_state():
    s = init_state()
    return JSONResponse(snapshot(s))

@app.post("/api/start")
def start():
    s = init_state()
    s.running.value = True
    push_log(s.handles(), "▶️ Execução iniciada", "success")
    emit_state(s)
    print("▶️ Execução INICIADA")
    return {"ok": True, "isRunning": True}

@app.post("/api/pause")
def pause():
    s = init_state()
    s.running.value = False
    push_log(s.handles(), "⏸️ Execução pausada", "warning")
    emit_state(s)
    print("⏸️ Execução PAUSADA")
    return {"ok": True, "isRunning": False}

@app.post("/api/reset")
def reset():
    s = init_state()
    print("🔄 Iniciando RESET...")
    
    # Pausa execução
    s.running.value = False
    time.sleep(0.3)
    
    # Encerra todos os mineradores
    for mid, proc in list(s.processes.items()):
        print(f"  Encerrando minerador {mid}...")
        if proc.is_alive():
            proc.terminate()
        proc.join(timeout=1.5)
        if proc.is_alive():
            proc.kill()
        s.processes.pop(mid, None)

    # Limpa tudo
    s.miners.clear()
    s.logs[:] = []
    s.stats["totalMined"] = 0
    s.stats["conflicts"] = 0
    s.stats["synchronized"] = 0
    s.stats["energyDepleted"] = 0
    s.minerals.value = 100
    s.energy.value = 100
    s.crystals.value = 50

    push_log(s.handles(), "🔄 Sistema reiniciado", "info")
    emit_state(s)
    print("✅ RESET completo!")
    return {"ok": True}

@app.post("/api/miners")
def create_miner():
    s = init_state()
    
    # Limpa processos mortos
    for mid, proc in list(s.processes.items()):
        if not proc.is_alive():
            s.processes.pop(mid, None)
            if mid in s.miners:
                try:
                    del s.miners[mid]
                except:
                    pass
    
    active_count = len(s.processes)
    
    if active_count >= 6:
        push_log(s.handles(), "⚠️ Máximo de 6 mineradores atingido", "warning")
        emit_state(s)
        return JSONResponse({"error": "max_miners", "message": "Máximo de 6 mineradores"}, status_code=400)

    # Encontra ID disponível
    new_id = 0
    while new_id in s.processes:
        new_id += 1

    print(f"➕ Criando minerador {new_id}...")
    p = mp.Process(target=miner_worker, args=(new_id, s.handles(),), daemon=True)
    p.start()
    s.processes[new_id] = p
    
    push_log(s.handles(), f"➕ Minerador-{new_id} criado (PID: {p.pid})", "info")
    print(f"✅ Minerador {new_id} criado com PID {p.pid}")
    
    time.sleep(0.15)
    emit_state(s)
    return {"ok": True, "id": new_id, "pid": p.pid}

@app.delete("/api/miners/{miner_id}")
def kill_miner(miner_id: int):
    s = init_state()
    
    print(f"❌ Tentando matar minerador {miner_id}")
    print(f"   Processos ativos: {list(s.processes.keys())}")
    
    proc = s.processes.get(miner_id)
    if not proc:
        print(f"   Minerador {miner_id} não encontrado!")
        return JSONResponse({"error": "not_found", "message": f"Minerador {miner_id} não existe"}, status_code=404)
    
    print(f"   Processo encontrado, terminando...")
    if proc.is_alive():
        proc.terminate()
    proc.join(timeout=1.5)
    if proc.is_alive():
        proc.kill()
    
    s.processes.pop(miner_id, None)
    
    # Marca como terminado
    try:
        if miner_id in s.miners:
            d = dict(s.miners[miner_id])
            d["status"] = "terminated"
            s.miners[miner_id] = d
            # Remove após 1s
            time.sleep(0.5)
            del s.miners[miner_id]
    except:
        pass
    
    push_log(s.handles(), f"❌ Minerador-{miner_id} terminado", "error")
    emit_state(s)
    print(f"✅ Minerador {miner_id} encerrado")
    return {"ok": True}

@app.get("/api/events")
def sse_events():
    s = init_state()
    
    def event_generator():
        # Estado inicial
        try:
            initial = {"type": "state", "data": snapshot(s)}
            yield f"data: {json.dumps(initial)}\n\n"
        except Exception as e:
            print(f"Erro ao enviar estado inicial SSE: {e}")
        
        # Loop de eventos
        while True:
            try:
                item = s.events_queue.get(timeout=1.5)
                yield f"data: {json.dumps(item)}\n\n"
            except:
                # Heartbeat
                yield ": ping\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )

if __name__ == "__main__":
    import uvicorn
    print("🚀 Iniciando servidor na porta 8000...")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")