FROM node:24-alpine AS frontend
WORKDIR /app
COPY frontend/package*.json ./frontend/
RUN npm install --prefix frontend
COPY frontend ./frontend
RUN npm run build --prefix frontend

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=4000
COPY backend/package*.json ./backend/
RUN npm install --prefix backend
COPY backend ./backend
COPY --from=frontend /app/frontend/dist ./frontend/dist
EXPOSE 4000
CMD ["npm","start","--prefix","backend"]
