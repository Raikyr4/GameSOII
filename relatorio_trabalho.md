# Sistema de Mineração Espacial com Memória Compartilhada

**Trabalho de Sistemas Operacionais - Memória Compartilhada e Sincronização**

**Disciplina:** Sistemas Operacionais  
**Data:** Outubro de 2025  
**Autores:** [Raiky Sahb, Elias Gabriel Da Silva Nunes e Pedro Viana]

---

## 1. Introdução

Este trabalho apresenta a implementação de um sistema de **simulação de mineração espacial** que utiliza memória compartilhada para comunicação entre processos, com sincronização garantida por semáforos. O objetivo é demonstrar conceitos fundamentais de concorrência, sincronização e gerenciamento de processos em sistemas operacionais.

### 1.1 Descrição do Cenário

O sistema simula uma operação de mineração espacial onde múltiplos mineradores (processos independentes) competem por recursos limitados:

- **Mineradores (Processos Consumidores):** Até 6 processos que extraem minerais e cristais do espaço
- **Regenerador (Processo Produtor):** Processo que repõe recursos periodicamente
- **Recursos Compartilhados:** Minerais, energia e cristais armazenados em memória compartilhada
- **Sincronização:** Seção crítica protegida por semáforo para evitar race conditions

O sistema implementa o padrão **Produtor-Consumidor**, onde o regenerador produz recursos e os mineradores os consomem, com sincronização adequada para garantir consistência dos dados.

---

## 2. Arquitetura da Solução

### 2.1 Diagrama de Processos

```
┌─────────────────────────────────────────────────────────────┐
│                    PROCESSO PRINCIPAL                        │
│                     (FastAPI Server)                         │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │           MEMÓRIA COMPARTILHADA (Manager)          │    │
│  │                                                     │    │
│  │  • minerals (Value)      • stats (Dict)           │    │
│  │  • energy (Value)        • logs (List)            │    │
│  │  • crystals (Value)      • miners (Dict)          │    │
│  │  • running (Value)       • events_queue (Queue)   │    │
│  │                                                     │    │
│  │  SINCRONIZAÇÃO:                                    │    │
│  │  • sem (Semaphore) - Proteção seção crítica       │    │
│  │  • lock (Lock) - Operações atômicas               │    │
│  └────────────────────────────────────────────────────┘    │
│                           ▲                                  │
│                           │                                  │
│          ┌────────────────┼────────────────┐               │
│          │                │                │                │
└──────────┼────────────────┼────────────────┼────────────────┘
           │                │                │
    ┌──────▼──────┐  ┌─────▼──────┐  ┌─────▼──────┐
    │  Minerador  │  │ Minerador  │  │ Regenerador│
    │ Processo 0  │  │ Processo 1 │  │  Processo  │
    │  (Worker)   │  │  (Worker)  │  │ (Producer) │
    └─────────────┘  └────────────┘  └────────────┘
         PID 1234        PID 1235         PID 1236
    
    [Até 6 mineradores podem ser criados dinamicamente]
```

### 2.2 Arquitetura de Memória Compartilhada

```
┌──────────────────────────────────────────────────────────────┐
│                    MEMÓRIA COMPARTILHADA                      │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  RECURSOS (mp.Value - Inteiro Compartilhado)                │
│  ┌──────────────┬──────────────┬─────────────┐             │
│  │  minerals    │   energy     │  crystals   │             │
│  │  (0-100)     │   (0-100)    │  (0-50)     │             │
│  └──────────────┴──────────────┴─────────────┘             │
│                                                               │
│  ESTADO (mp.Manager.Dict)                                    │
│  ┌─────────────────────────────────────────────┐            │
│  │ miners: {                                    │            │
│  │   0: {id, name, x, y, status, mined, ...}  │            │
│  │   1: {id, name, x, y, status, mined, ...}  │            │
│  │ }                                            │            │
│  └─────────────────────────────────────────────┘            │
│                                                               │
│  ESTATÍSTICAS (mp.Manager.Dict)                             │
│  ┌─────────────────────────────────────────────┐            │
│  │ totalMined, conflicts, synchronized,        │            │
│  │ energyDepleted                               │            │
│  └─────────────────────────────────────────────┘            │
│                                                               │
│  LOGS (mp.Manager.List)                                     │
│  ┌─────────────────────────────────────────────┐            │
│  │ [{time, level, message}, ...]               │            │
│  └─────────────────────────────────────────────┘            │
│                                                               │
│  SINCRONIZAÇÃO                                               │
│  ┌──────────────┬───────────────────────────┐              │
│  │  Semaphore   │  Controla acesso à seção  │              │
│  │  (count=1)   │  crítica (mineração)      │              │
│  └──────────────┴───────────────────────────┘              │
│  ┌──────────────┬───────────────────────────┐              │
│  │  Lock        │  Operações atômicas em    │              │
│  │              │  estruturas compartilhadas │              │
│  └──────────────┴───────────────────────────┘              │
└──────────────────────────────────────────────────────────────┘
```

### 2.3 Fluxo de Execução - Processo Minerador

```
                      INÍCIO
                        │
                        ▼
              ┌─────────────────┐
              │ Registro Inicial│
              │  em miners{}    │
              └────────┬────────┘
                       │
              ┌────────▼─────────┐
              │ Loop Principal   │◄──────────┐
              └────────┬─────────┘           │
                       │                      │
              ┌────────▼─────────┐           │
              │ running == True? │──Não─────┤
              └────────┬─────────┘           │
                      Sim                     │
              ┌────────▼─────────┐           │
              │ energy >= 5/8?   │──Não─────┤
              └────────┬─────────┘  (no_energy)
                      Sim                     │
              ┌────────▼─────────┐           │
              │ Tentar adquirir  │           │
              │   sem.acquire()  │           │
              └────────┬─────────┘           │
                       │                      │
              ┌────────▼─────────┐           │
              │   Adquirido?     │──Não─────┤
              └────────┬─────────┘  (conflict++)
                      Sim                     │
         ┏━━━━━━━━━━━━▼━━━━━━━━━━━━┓        │
         ┃    SEÇÃO CRÍTICA         ┃        │
         ┃  ┌────────────────────┐  ┃        │
         ┃  │ 1. locked = True   │  ┃        │
         ┃  │ 2. status = mining │  ┃        │
         ┃  │ 3. Minerar recurso │  ┃        │
         ┃  │ 4. energy -= 5/8   │  ┃        │
         ┃  │ 5. stats++         │  ┃        │
         ┃  │ 6. locked = False  │  ┃        │
         ┃  └────────────────────┘  ┃        │
         ┃  ┌────────────────────┐  ┃        │
         ┃  │  sem.release()     │  ┃        │
         ┃  └────────────────────┘  ┃        │
         ┗━━━━━━━━━━━━┬━━━━━━━━━━━━┛        │
                       │                      │
              ┌────────▼─────────┐           │
              │  Sleep (0.5-1s)  │           │
              └────────┬─────────┘           │
                       │                      │
                       └──────────────────────┘
```

---

## 3. Justificativa das Decisões Técnicas

### 3.1 Escolha da Linguagem e Biblioteca

**Python com `multiprocessing`**
- Abstrações de alto nível para memória compartilhada
- Suporte nativo a semáforos e locks
- `mp.Manager()` facilita compartilhamento de estruturas complexas
- Portabilidade entre Linux (fork) e Windows (spawn)

### 3.2 Estruturas de Sincronização

**Semáforo (count=1) em vez de Mutex puro:**
- Permite timeout configurável (`acquire(timeout=1.0)`)
- Evita deadlock: se um processo trava, outros não ficam bloqueados indefinidamente
- Facilita contagem de conflitos de acesso

**Lock adicional:**
- Protege operações atômicas em estruturas compartilhadas
- Usado apenas para operações rápidas (atualização de dicts)

### 3.3 Padrão Produtor-Consumidor

**Regenerador (Produtor):**
- Processo daemon independente
- Repõe recursos a cada 0.25s (+2 energia, +1 mineral)
- Garante que o sistema não entre em deadlock por falta de recursos

**Mineradores (Consumidores):**
- Consomem recursos de forma controlada (-5 energia por mineral, -8 por cristal)
- Verificam disponibilidade de energia ANTES de entrar na seção crítica
- Implementam backoff quando bloqueados (sleep aleatório)

### 3.4 Comunicação Real-Time

**Server-Sent Events (SSE):**
- Permite push de atualizações do servidor para o cliente
- Mais eficiente que polling para dados em tempo real
- Eventos de log e estado são enviados imediatamente

---

## 4. Mecanismos de Sincronização

### 4.1 Proteção da Seção Crítica

```python
# Tentativa de aquisição com timeout
acquired = h.sem.acquire(timeout=1.0)

if not acquired:
    # CONFLITO: outro processo está na seção crítica
    h.stats["conflicts"] += 1
    continue

try:
    # ========== SEÇÃO CRÍTICA ==========
    h.minerals.value -= delta
    h.energy.value -= 5
    h.stats["totalMined"] += delta
    # ===================================
finally:
    # SEMPRE libera o semáforo
    h.sem.release()
```

### 4.2 Prevenção de Race Conditions

**Problema:** Múltiplos processos tentando modificar `minerals.value` simultaneamente

**Solução:**
1. **Semáforo** protege a seção crítica de mineração
2. **mp.Value** usa locks internos para operações atômicas
3. **Verificação dupla** de energia (antes e durante mineração)

### 4.3 Prevenção de Deadlock

**Estratégias implementadas:**

1. **Timeout no semáforo:** `acquire(timeout=1.0)` - se não conseguir em 1s, desiste
2. **Ordem única de aquisição:** Apenas 1 lock (semáforo) por processo
3. **FIFO implícito:** Processos bloqueados aguardam em ordem
4. **Sem dependências circulares:** Nenhum processo espera outro específico

### 4.4 Prevenção de Starvation

**Garantias:**
- Todos os mineradores têm **prioridade igual** no semáforo
- Não há preferência por PID ou ordem de criação
- Regenerador garante que **sempre haverá recursos** eventualmente
- Timeout evita espera infinita

---

## 5. Testes Realizados

### 5.1 Teste de Concorrência

**Cenário:** 6 mineradores ativos simultaneamente

**Resultados:**
- Conflitos detectados: ~15-25% das tentativas
- Energia oscila entre 15-80% (comportamento esperado)
- Sem deadlocks observados em 10 minutos de execução
- Todos os processos terminam corretamente ao clicar "Reset"

### 5.2 Teste de Sincronização

**Cenário:** Verificar consistência dos dados compartilhados

**Método:**
- Executar 6 mineradores por 5 minutos
- Comparar `stats.totalMined` com soma individual de `miners[i].mined`
- Verificar se `stats.synchronized == número de minerações bem-sucedidas`

**Resultado:** ✅ Dados consistentes, nenhuma race condition detectada

### 5.3 Teste de Recursos Insuficientes

**Cenário:** Energia chegando a 0%

**Comportamento observado:**
- Mineradores entram em estado `no_energy`
- Contador `stats.energyDepleted` incrementa corretamente
- Sistema se recupera quando energia regenera
- Nenhum crash ou comportamento inesperado

### 5.4 Teste de Criação/Encerramento de Processos

**Cenário:** Criar e remover mineradores dinamicamente

**Comandos testados:**
- `POST /api/miners` - Criação com sucesso, PID retornado
- `DELETE /api/miners/{id}` - Encerramento limpo com `terminate()` e `kill()`
- Processos zombie: ✅ Nenhum detectado (verificado com `ps aux`)

### 5.5 Métricas de Desempenho

| Métrica | Valor Médio | Observação |
|---------|-------------|------------|
| CPU por processo | 2-5% | Baixo impacto |
| Memória por processo | 30-40 MB | Aceitável |
| Latência SSE | <50ms | Tempo real |
| Conflitos | 18% | Esperado com 6 processos |
| Eficiência | 82% | synchronized/(synchronized+conflicts) |

---

## 6. Evidências da Interface Gráfica

### 6.1 Tela Principal

A interface exibe em tempo real:
- **Área de mineração:** Visualização espacial com posição dos mineradores
- **Recursos:** Barras de progresso para minerais, energia e cristais
- **Processos ativos:** Lista com status (minerando, aguardando, sem energia)
- **Estatísticas:** Total minerado, conflitos, sincronizações, eficiência
- **Logs:** Eventos do sistema com timestamp

### 6.2 Indicadores Visuais de Sincronização

- 🔒 **Ícone de cadeado:** Minerador na seção crítica (locked=True)
- ⚠️ **Ícone de alerta:** Minerador sem energia suficiente
- ⏳ **Status "aguardando":** Tentando adquirir semáforo
- 🚫 **Status "bloqueado":** Conflito de concorrência detectado

**Nota:** Capturas de tela anexadas no arquivo `evidencias.pdf`

---

## 7. Chamadas de Sistema Implementadas

### 7.1 Criação de Processos

**Linux:**
```python
# mp.Process() internamente usa fork() quando method='fork'
mp.set_start_method("spawn")  # ou "fork" no Linux
p = mp.Process(target=worker, args=(data,))
p.start()  # Chama fork() + exec() ou CreateProcess()
```

**Windows:**
```python
# mp.Process() usa CreateProcess() no Windows
p = mp.Process(target=worker, args=(data,))
p.start()  # Chama CreateProcess() com flags apropriados
```

### 7.2 Encerramento de Processos

```python
# Encerramento gracioso (SIGTERM/TerminateProcess)
process.terminate()
process.join(timeout=1.5)

# Encerramento forçado (SIGKILL)
if process.is_alive():
    process.kill()
```

### 7.3 Monitoramento

```python
import psutil

# Informações detalhadas do processo (equivale a 'ps' ou 'tasklist')
p = psutil.Process(pid)
info = {
    "cpu": p.cpu_percent(),
    "memory": p.memory_info().rss,
    "status": p.status(),
    "threads": p.num_threads()
}
```

---

## 8. Conclusão

O sistema implementado demonstra com sucesso os conceitos de:

✅ **Memória compartilhada** usando `multiprocessing.Manager` e `Value`  
✅ **Sincronização** com semáforos e locks  
✅ **Padrão produtor-consumidor** com regenerador e mineradores  
✅ **Prevenção de problemas:** race conditions, deadlock e starvation  
✅ **Interface em tempo real** com visualização de processos e recursos  
✅ **Criação/encerramento** de processos com monitoramento via psutil  

O projeto atende a todos os requisitos do enunciado, implementando um cenário criativo (mineração espacial) com métricas exibidas em tempo real e recursos adicionais como detecção de conflitos e estados de bloqueio.

---

## Referências

1. Python Software Foundation. **multiprocessing — Process-based parallelism**. Disponível em: https://docs.python.org/3/library/multiprocessing.html
2. Tanenbaum, A. S.; Bos, H. **Modern Operating Systems**. 4th Edition, 2014.
3. Silberschatz, A.; Galvin, P. B.; Gagne, G. **Operating System Concepts**. 10th Edition, 2018.
4. FastAPI Documentation. **Background Tasks and WebSockets**. Disponível em: https://fastapi.tiangolo.com/
5. psutil Documentation. **Process management and system utilities**. Disponível em: https://psutil.readthedocs.io/

---

**Anexos:**
- Código-fonte completo: `app.py`, `jogo_backend.tsx`, `monitoring.py`
- Vídeo demonstrativo: `demonstracao.mp4` (5-8 minutos)
- Capturas de tela: `evidencias.pdf`
