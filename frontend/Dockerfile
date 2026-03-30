# Multi-stage build for minimal final image
FROM node:18-alpine AS builder
WORKDIR /app
COPY . .
# If using React/Vue build step, run it here:
# RUN npm ci && npm run build

# ---- Production Stage ----
FROM nginx:alpine

# Copy static files
COPY --from=builder /app/index.html /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Runtime: inject BACKEND_HOST env variable into nginx config
# ECS Task will set BACKEND_HOST environment variable
RUN apk add --no-cache bash
COPY docker-entrypoint.sh /
RUN chmod +x /docker-entrypoint.sh

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost/health || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]