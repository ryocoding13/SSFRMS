# ==============================================================================
# SafeSpace SSFRMS — Frontend Web Dockerfile (React 19 + Vite + Nginx)
# ==============================================================================

# ─── Stage 1: Build Frontend Distribution Bundle ─────────────────────────────
FROM node:24-alpine AS build
WORKDIR /app

# Cài đặt dependencies với cache npm
COPY package.json package-lock.json ./
RUN npm ci

# Cấu hình biến môi trường build-time cho Vite bundle
ARG VITE_API_URL="/"
ARG VITE_USE_API="true"
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_USE_API=${VITE_USE_API}

# Sao chép mã nguồn và build production bundle
COPY . .
RUN npm run build

# ─── Stage 2: Production Nginx Server ─────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# Xóa cấu hình mặc định của Nginx
RUN rm -rf /etc/nginx/conf.d/* /usr/share/nginx/html/*

# Sao chép dist bundle
COPY --from=build /app/dist /usr/share/nginx/html

# Sao chép cấu hình Nginx (hỗ trợ SPA routing + reverse proxy /api sang container api)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# Health check kiểm tra Nginx server đang phản hồi
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
