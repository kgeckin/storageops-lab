FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY storageops ./storageops
EXPOSE 8000
CMD ["uvicorn", "storageops.api:app", "--host", "0.0.0.0", "--port", "8000"]
