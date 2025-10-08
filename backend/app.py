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

# Windows usa 'spawn'; defina o start method cedo
try:
    mp.set_start_method("spawn", force=True)
except RuntimeError:
    pass

# ----------------------------
# Handles compartilháveis (pickláveis)
# ----------------------------
@dataclass
class SharedHandles:
    minerals: Any        # mp.Value('i')
    energy: Any          # mp.Value('i')
    crystals: Any        # mp.Value('i')
    running: Any         # mp.Value('b')
    stats: Any           # manager.dict
    logs: Any            # manager.list
    shared_mem: Any      # manager.list
    miners: Any          # manager.dict
    sem: Any             # mp.Semaphore
    lock: Any            # mp.Lock
    events_queue: Any    # mp.Queue

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

# GLOBAL lazy
STATE: Optional[State] = None

def init_state() -> State:
    """Cria o STATE apenas quando chamado (p.ex. no startup)."""
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
        stats=manager.dict({"totalMined": 0, "conflicts": 0, "synchronized": 0}),
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
# Helpers compartilhados
# ----------------------------
COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']

def push_log(h: SharedHandles, message: str, level: str = "info") -> None:
    ts = time.strftime("%H:%M:%S")
    entry = {"time": ts, "level": level, "message": message}
    with h.lock:
        h.logs.append(entry)
        while len(h.logs) > 200:
            try:
                h.logs.pop(0)
            except Exception:
                break
    try:
        h.events_queue.put_nowait({"type": "log", "data": entry})
    except Exception:
        pass

def snapshot(s: State) -> Dict[str, Any]:
    miners = {int(k): dict(s.miners[k]) for k in list(s.miners.keys())}
    return {
        "resources": {
            "minerals": int(s.minerals.value),
            "energy": int(s.energy.value),
            "crystals": int(s.crystals.value),
        },
        "miners": miners,
        "stats": {
            "totalMined": int(s.stats.get("totalMined", 0)),
            "conflicts": int(s.stats.get("conflicts", 0)),
            "synchronized": int(s.stats.get("synchronized", 0)),
        },
        "logs": list(s.logs)[-50:],
        "isRunning": bool(s.running.value),
    }

# ----------------------------
# Workers
# ----------------------------
def miner_worker(miner_id: int, h: SharedHandles):
    random.seed(os.getpid() ^ int(time.time()))
    name = f"Minerador-{miner_id}"

    h.miners[miner_id] = {
        "id": miner_id,
        "name": name,
        "x": random.random() * 700,
        "y": random.random() * 400,
        "color": COLORS[miner_id % len(COLORS)],
        "status": "idle",
        "mined": 0,
        "locked": False,
        "target": None
    }
    push_log(h, f"✅ {name} iniciado (PID: {os.getpid()})", "success")

    try:
        while True:
            if not h.running.value:
                time.sleep(0.3)
                continue

            attempt = random.random() < 0.45
            target = "minerals" if (random.random() < 0.5) else "crystals"

            m = dict(h.miners[miner_id])
            m["target"] = target
            m["status"] = "waiting"
            m["locked"] = False
            h.miners[miner_id] = m

            if attempt:
                acquired = h.sem.acquire(timeout=0.5)
                if not acquired:
                    with h.lock:
                        h.stats["conflicts"] = int(h.stats.get("conflicts", 0)) + 1
                    time.sleep(0.2 + random.random() * 0.3)
                    continue

                try:
                    m = dict(h.miners[miner_id])
                    m["locked"] = True
                    m["status"] = "mining"
                    h.miners[miner_id] = m

                    time.sleep(0.15 + random.random() * 0.2)

                    with h.lock:
                        if target == "minerals" and h.minerals.value > 0:
                            delta = min(5, h.minerals.value)
                            h.minerals.value -= delta
                            h.energy.value = max(0, h.energy.value - 2)
                            h.stats["totalMined"] = int(h.stats.get("totalMined", 0)) + delta
                            h.stats["synchronized"] = int(h.stats.get("synchronized", 0)) + 1

                            m = dict(h.miners[miner_id])
                            m["mined"] = int(m.get("mined", 0)) + delta
                            h.miners[miner_id] = m

                            h.shared_mem.append({"ts": time.time(), "actor": name, "op": "mine_minerals", "amount": delta})
                            while len(h.shared_mem) > 200:
                                try:
                                    h.shared_mem.pop(0)
                                except Exception:
                                    break

                            push_log(h, f"⛏️ {name} minerou minerais ({delta})", "success")

                        elif target == "crystals" and h.crystals.value > 0:
                            delta = min(3, h.crystals.value)
                            h.crystals.value -= delta
                            h.energy.value = max(0, h.energy.value - 3)
                            h.stats["totalMined"] = int(h.stats.get("totalMined", 0)) + delta
                            h.stats["synchronized"] = int(h.stats.get("synchronized", 0)) + 1

                            m = dict(h.miners[miner_id])
                            m["mined"] = int(m.get("mined", 0)) + delta
                            h.miners[miner_id] = m

                            h.shared_mem.append({"ts": time.time(), "actor": name, "op": "mine_crystals", "amount": delta})
                            while len(h.shared_mem) > 200:
                                try:
                                    h.shared_mem.pop(0)
                                except Exception:
                                    break

                            push_log(h, f"💎 {name} coletou cristais ({delta})", "success")

                    # movimento aleatório
                    m = dict(h.miners[miner_id])
                    m["x"] = max(0, min(700, m["x"] + random.uniform(-60, 60)))
                    m["y"] = max(0, min(400, m["y"] + random.uniform(-40, 40)))
                    h.miners[miner_id] = m
                finally:
                    try:
                        m = dict(h.miners[miner_id])
                        m["locked"] = False
                        m["status"] = "idle"
                        m["target"] = None
                        h.miners[miner_id] = m
                    except Exception:
                        pass
                    h.sem.release()

            time.sleep(0.25 + random.random() * 0.3)
    except KeyboardInterrupt:
        pass
    except Exception as ex:
        push_log(h, f"❌ {name} falhou: {ex}", "error")
    finally:
        try:
            d = dict(h.miners.get(miner_id, {}))
            d["status"] = "terminated"
            h.miners[miner_id] = d
        except Exception:
            pass
        push_log(h, f"🛑 {name} finalizado", "warning")

def regenerator_worker(h: SharedHandles):
    try:
        while True:
            with h.lock:
                h.minerals.value = min(100, h.minerals.value + 1)
                h.energy.value   = min(100, h.energy.value + 2)
                c = h.crystals.value + 1 if (int(time.time()) % 4 == 0) else h.crystals.value
                h.crystals.value = min(50, c)

            snap = {
                "resources": {
                    "minerals": int(h.minerals.value),
                    "energy": int(h.energy.value),
                    "crystals": int(h.crystals.value),
                },
                "stats": {
                    "totalMined": int(h.stats.get("totalMined", 0)),
                    "conflicts": int(h.stats.get("conflicts", 0)),
                    "synchronized": int(h.stats.get("synchronized", 0)),
                },
                "miners": {int(k): dict(h.miners[k]) for k in list(h.miners.keys())},
                "isRunning": bool(h.running.value),
            }
            try:
                h.events_queue.put_nowait({"type": "state", "data": snap})
            except Exception:
                pass

            time.sleep(0.2)
    except KeyboardInterrupt:
        pass

# ----------------------------
# FastAPI
# ----------------------------
app = FastAPI(title="Shared Memory Mining - Python Backend", version="1.0.2")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # liberar geral no dev
    allow_credentials=False,      # precisa ser False para usar "*"
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def _startup():
    s = init_state()  # cria Manager/Values/etc aqui
    if s.regen_proc is None or not s.regen_proc.is_alive():
        p = mp.Process(target=regenerator_worker, args=(s.handles(),), daemon=True)
        p.start()
        s.regen_proc = p
        push_log(s.handles(), "🔧 Regenerador de recursos iniciado", "info")

@app.get("/api/state")
def get_state():
    s = init_state()
    return JSONResponse(snapshot(s))

@app.post("/api/start")
def start():
    s = init_state()
    s.running.value = True
    push_log(s.handles(), "▶️ Execução iniciada", "success")
    return {"ok": True, "isRunning": True}

@app.post("/api/pause")
def pause():
    s = init_state()
    s.running.value = False
    push_log(s.handles(), "⏸️ Execução pausada", "warning")
    return {"ok": True, "isRunning": False}

@app.post("/api/reset")
def reset():
    s = init_state()
    for mid, proc in list(s.processes.items()):
        if proc.is_alive():
            proc.terminate()
        proc.join(timeout=0.5)
        s.processes.pop(mid, None)

    with s.lock:
        s.miners.clear()
        s.logs[:] = []
        s.stats["totalMined"] = 0
        s.stats["conflicts"] = 0
        s.stats["synchronized"] = 0
        s.minerals.value = 100
        s.energy.value = 100
        s.crystals.value = 50
        s.running.value = False

    push_log(s.handles(), "🔄 Sistema reiniciado", "info")
    return {"ok": True}

@app.post("/api/miners")
def create_miner():
    s = init_state()
    if len(s.processes) >= 6:
        push_log(s.handles(), "⚠️ Máximo de 6 mineradores atingido", "warning")
        return JSONResponse({"error": "max_miners"}, status_code=400)

    new_id = 0
    while new_id in s.processes:
        new_id += 1

    p = mp.Process(target=miner_worker, args=(new_id, s.handles(),), daemon=True)
    p.start()
    s.processes[new_id] = p
    return {"ok": True, "id": new_id}

@app.delete("/api/miners/{miner_id}")
def kill_miner(miner_id: int):
    s = init_state()
    proc = s.processes.get(miner_id)
    if not proc:
        return JSONResponse({"error": "not_found"}, status_code=404)
    if proc.is_alive():
        proc.terminate()
    proc.join(timeout=0.5)
    s.processes.pop(miner_id, None)
    try:
        d = dict(s.miners.get(miner_id, {}))
        d["status"] = "terminated"
        s.miners[miner_id] = d
    except Exception:
        pass
    push_log(s.handles(), f"❌ Minerador-{miner_id} terminado", "error")
    return {"ok": True}

@app.get("/api/events")
def sse_events():
    s = init_state()
    def event_generator():
        try:
            initial = {"type": "state", "data": snapshot(s)}
            yield f"data: {json.dumps(initial)}\n\n"
        except Exception:
            pass
        while True:
            try:
                item = s.events_queue.get(timeout=1.0)
                yield f"data: {json.dumps(item)}\n\n"
            except Exception:
                yield "data: {\"type\":\"ping\"}\n\n"
                time.sleep(0.2)
    return StreamingResponse(event_generator(), media_type="text/event-stream")
