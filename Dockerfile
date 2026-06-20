# SLANEST — single-image build: compile the SPA, then serve SPA + /api from the
# stdlib Python server on port 8090 (same single-process model as the watchdog).
FROM node:20-slim AS web
WORKDIR /app
COPY package*.json ./
RUN npm ci || npm install
COPY . .
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
RUN pip install --no-cache-dir openpyxl xlrd
# backend code + the built SPA
COPY backend ./backend
COPY --from=web /app/dist ./dist
# storage is a volume so data + auth.json persist across restarts
VOLUME ["/app/storage"]
ENV PN_PORT=8090
EXPOSE 8090
CMD ["python", "backend/server.py"]
