FROM python:3.11-slim

# Define o diretório de trabalho dentro do container
WORKDIR /app

# Copia os arquivos do backend
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Expõe a porta do backend
EXPOSE 8000

# Comando padrão de execução
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
