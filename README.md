# 🚀 Sistema de Mineração Espacial - Memória Compartilhada

[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18.0+-61DAFB.svg)](https://reactjs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> Sistema distribuído de simulação espacial demonstrando **memória compartilhada**, **sincronização entre processos** e comunicação em **tempo real** usando Python multiprocessing e React.

---

## 🎯 Sobre o Projeto

Este projeto implementa um **simulador de mineração espacial** onde múltiplos processos (mineradores) competem por recursos compartilhados em memória, utilizando mecanismos de sincronização para garantir consistência e evitar race conditions.

### O que o sistema faz?

- 🤖 Gerencia até **6 processos mineradores** independentes
- 💎 Processa recursos compartilhados (minerais, energia, cristais)
- 🔒 Implementa **seção crítica** protegida por semáforo
- 📊 Monitora conflitos, sincronizações e eficiência em tempo real
- 🌐 Interface web responsiva com atualizações instantâneas via SSE
- ⚡ Demonstra conceitos fundamentais de **Sistemas Operacionais**

---

## ✨ Características

### Funcionalidades Principais

- ✅ **Memória Compartilhada:** Uso de `multiprocessing.Manager`, `Value` e estruturas compartilhadas
- ✅ **Sincronização:** Semáforos, locks e prevenção de deadlock/starvation
- ✅ **Multi-Processo:** Criação, monitoramento e encerramento dinâmico de processos
- ✅ **Tempo Real:** Server-Sent Events (SSE) para atualizações instantâneas
- ✅ **Padrão Produtor-Consumidor:** Regenerador produz, mineradores consomem
- ✅ **Métricas Detalhadas:** Conflitos, sincronizações, eficiência, consumo de energia
- ✅ **Interface Moderna:** React com Tailwind CSS e animações fluidas

### Recursos Avançados

- 🔄 Regeneração automática de recursos
- 📈 Estatísticas de desempenho em tempo real
- 🎨 Visualização espacial com posicionamento dinâmico
- 🔔 Sistema de logs com níveis (info, success, warning, error)
- ⚠️ Detecção de energia insuficiente e bloqueios
- 🎯 Controle fino sobre cada processo individual

---

## 🧠 Conceitos de SO Implementados

Este projeto é uma demonstração prática de:

| Conceito | Implementação |
|----------|---------------|
| **Memória Compartilhada** | `mp.Value`, `mp.Manager().dict/list` |
| **Sincronização** | `mp.Semaphore(1)`, `mp.Lock()` |
| **Exclusão Mútua** | Seção crítica protegida por semáforo |
| **Prevenção de Deadlock** | Timeout no `acquire()`, ordem única de locks |
| **Prevenção de Starvation** | FIFO implícito, todos com prioridade igual |
| **Criação de Processos** | `mp.Process()` (fork/spawn/CreateProcess) |
| **Encerramento** | `terminate()`, `kill()`, cleanup adequado |
| **IPC** | Memória compartilhada + Queue para eventos |
| **Produtor-Consumidor** | Regenerador × Mineradores |
| **Race Conditions** | Eliminadas via sincronização adequada |

---

## 🛠 Tecnologias

### Backend
- ![Python](https://img.shields.io/badge/-Python-3776AB?logo=python&logoColor=white) **Python 3.8+**
- ![FastAPI](https://img.shields.io/badge/-FastAPI-009688?logo=fastapi&logoColor=white) **FastAPI** - Framework web assíncrono
- **multiprocessing** - Gerenciamento de processos
- **Uvicorn** - Servidor ASGI
- **psutil** (opcional) - Monitoramento de processos

### Frontend
- ![React](https://img.shields.io/badge/-React-61DAFB?logo=react&logoColor=black) **React 18+** com TypeScript
- **Tailwind CSS** - Estilização
- **Lucide React** - Ícones
- **EventSource API** - Server-Sent Events

---

## 🏗 Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                   CLIENTE (React)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │ Interface│  │   SSE    │  │   HTTP   │               │
│  │  Gráfica │◄─┤ Events   │  │   API    │               │
│  └──────────┘  └─────┬────┘  └────┬─────┘               │
└──────────────────────┼────────────┼─────────────────────┘
                       │            │
                    WebSocket    REST API
                       │            │
┌──────────────────────▼────────────▼────────────────────┐
│             SERVIDOR (FastAPI)                         │
│  ┌────────────────────────────────────────────┐        │
│  │        Memória Compartilhada               │        │
│  │  • minerals, energy, crystals (Values)     │        │
│  │  • stats, logs, miners (Manager)           │        │
│  │  • sem (Semaphore), lock (Lock)            │        │
│  └───────────────────┬────────────────────────┘        │
│                      │                                 │
│  ┌───────────────────▼────────────────┐                │
│  │         Processos Workers          │                │
│  │  ┌──────────┐  ┌──────────┐        │                │
│  │  │Minerador │  │Minerador │  ...   │                │
│  │  │    0     │  │    1     │        │                │
│  │  └──────────┘  └──────────┘        │                │
│  │                                    │                │
│  │  ┌──────────────────────┐          │                │
│  │  │   Regenerador        │          │                │
│  │  │   (Produtor)         │          │                │
│  │  └──────────────────────┘          │                │
│  └────────────────────────────────────┘                │
└────────────────────────────────────────────────────────┘
```

**Fluxo de Dados:**
1. Regenerador adiciona recursos a cada 250ms
2. Mineradores tentam adquirir semáforo para entrar na seção crítica
3. Mineração consome energia e recursos
4. Estado atualizado é enviado via SSE para o frontend
5. Interface reflete mudanças em tempo real

---

## 📦 Instalação

### Pré-requisitos

- Python 3.8 ou superior
- Node.js 16+ e npm/yarn (para o frontend)
- pip (gerenciador de pacotes Python)

### Backend

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/mining-system.git
cd mining-system/backend

# Crie um ambiente virtual
python -m venv .venv

# Ative o ambiente virtual
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

# Instale as dependências
pip install -r requirements.txt
```

**requirements.txt:**
```txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
psutil==5.9.6
```

### Frontend

```bash
cd ../frontend

# Instale as dependências
npm install
# ou
yarn install
```

---

## 🚀 Como Usar

### 1️⃣ Inicie o Backend

```bash
cd backend
source .venv/bin/activate  # ou .venv\Scripts\activate no Windows

# Modo desenvolvimento
uvicorn app:app --host 0.0.0.0 --port 8000 --reload

# Modo produção (recomendado para evitar duplicação de processos)
uvicorn app:app --host 0.0.0.0 --port 8000
```

O servidor estará disponível em `http://localhost:8000`

**Documentação interativa:** `http://localhost:8000/docs`

### 2️⃣ Inicie o Frontend

```bash
cd frontend
npm start
# ou
yarn start
```

O frontend estará em `http://localhost:3000` (ou porta configurada)

### 3️⃣ Use o Sistema

1. **Criar mineradores:** Clique em "Criar Minerador" (máx. 6)
2. **Iniciar simulação:** Clique em "Iniciar"
3. **Observar:** Veja os processos minerando, conflitos acontecendo, energia sendo consumida
4. **Pausar:** Clique em "Pausar" para congelar a execução
5. **Remover:** Clique em "Kill" para encerrar processos individuais
6. **Resetar:** Clique em "Reset" para reiniciar tudo

---

## 📡 Endpoints da API

### Estado e Controle

#### `GET /api/state`
Retorna snapshot completo do sistema.

**Resposta:**
```json
{
  "resources": {
    "minerals": 85,
    "energy": 67,
    "crystals": 32
  },
  "stats": {
    "totalMined": 234,
    "conflicts": 45,
    "synchronized": 189,
    "energyDepleted": 12
  },
  "miners": {
    "0": {
      "id": 0,
      "name": "Minerador-0",
      "status": "mining",
      "mined": 47,
      "locked": true
    }
  },
  "isRunning": true,
  "logs": [...]
}
```

#### `POST /api/start`
Inicia a execução dos mineradores.

**Resposta:** `{ "ok": true, "isRunning": true }`

#### `POST /api/pause`
Pausa a execução (processos continuam vivos, mas inativos).

**Resposta:** `{ "ok": true, "isRunning": false }`

#### `POST /api/reset`
Encerra todos os processos e reinicia o estado.

**Resposta:** `{ "ok": true }`

### Gerenciamento de Processos

#### `POST /api/miners`
Cria um novo processo minerador.

**Resposta:**
```json
{
  "ok": true,
  "id": 3,
  "pid": 12345
}
```

**Erros:**
- `400` - Máximo de 6 mineradores atingido

#### `DELETE /api/miners/{id}`
Encerra um minerador específico.

**Parâmetros:**
- `id` (path) - ID do minerador

**Resposta:** `{ "ok": true }`

**Erros:**
- `404` - Minerador não encontrado

### Eventos em Tempo Real

#### `GET /api/events`
Stream de Server-Sent Events.

**Formato dos eventos:**
```javascript
// Evento de estado
{
  "type": "state",
  "data": { /* snapshot completo */ }
}

// Evento de log
{
  "type": "log",
  "data": {
    "time": "14:32:17",
    "level": "success",
    "message": "⛏️ Minerador-0 minerou 5 minerais"
  }
}
```

**Uso no cliente:**
```javascript
const es = new EventSource('http://localhost:8000/api/events');
es.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data);
};
```

---

## 📁 Estrutura do Projeto

```
GameSOII/
├── backend/
│   ├── app.py                 # Backend FastAPI + multiprocessing
│   ├── monitoring.py          # Módulo de monitoramento (opcional)
│   ├── requirements.txt       # Dependências Python
│   └── .venv/                 # Ambiente virtual
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── SpaceMiningGame.tsx   # Componente React principal
│   │   ├── App.tsx
│   │   └── index.tsx
│   ├── package.json
│   └── tailwind.config.js
│
|
│── relatorio.md           # Relatório técnico
|── screenshots/           # Capturas de tela
│
├── README.md                  # Este arquivo
```

---

## 🗺 Roadmap

- [x] Implementação básica de memória compartilhada
- [x] Sincronização com semáforo
- [x] Interface React com SSE
- [x] Detecção de conflitos e energia
- [ ] Monitoramento avançado com psutil (CPU, RAM por processo)
- [ ] Modo debug com visualização de locks
- [ ] Persistência de estatísticas (SQLite)
- [ ] Suporte a múltiplos tipos de recursos
- [ ] Sistema de achievements/conquistas
- [ ] Modo competitivo (equipes de mineradores)

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Siga os passos:

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/NovaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona NovaFeature'`)
4. Push para a branch (`git push origin feature/NovaFeature`)
5. Abra um Pull Request

### Diretrizes

- Mantenha o código limpo e documentado
- Adicione testes quando aplicável
- Siga os padrões Python (PEP 8)
- Atualize o README se necessário

---

## 📚 Referências

- [Python multiprocessing Documentation](https://docs.python.org/3/library/multiprocessing.html)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React SSE Guide](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- Tanenbaum, A. S. - Modern Operating Systems (2014)
- Silberschatz, A. - Operating System Concepts (2018)

---
<div align="center">
Feito com ❤️ e ☕ para a disciplina de Sistemas Operacionais

</div>
