
# Shared Memory + React UI (Python backend)

Este projeto demonstra **memória compartilhada** e **sincronização** (semáforo, lock) com **múltiplos processos** em Python, expondo uma API e um canal **SSE** para um front-end React.

## Como rodar (backend)

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# Linux/Mac: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000
```

## Endpoints principais

- `GET /api/state` – Snapshot atual (recursos, mineradores, stats, logs).
- `GET /api/events` – SSE de eventos (logs e estados).
- `POST /api/start` / `POST /api/pause` – Inicia/Pausa execução.
- `POST /api/reset` – Reseta tudo.
- `POST /api/miners` – Cria um novo minerador (máx. 6).
- `DELETE /api/miners/{id}` – Mata um minerador.

## Front-end

Use o arquivo `jogo_backend.tsx` como base do seu componente React. Ele consome os endpoints acima e se conecta ao SSE para atualizações em tempo real.

## Observações

- Implementa processos separados com `multiprocessing`.
- Usa `Semaphore` e `Lock` para garantir exclusão mútua na "seção crítica".
- A fila `events_queue` é a ponte para streaming em tempo real.
- Testado com execução local; em produção, desabilite auto-reload do Uvicorn para evitar duplicação de processos.
