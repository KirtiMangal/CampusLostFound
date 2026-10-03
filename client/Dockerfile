FROM node:24-bookworm-slim AS build

WORKDIR /app
COPY client/package.json client/package-lock.json ./client/
RUN cd client && npm ci

COPY client/index.html client/vite.config.js client/postcss.config.js client/tailwind.config.js ./client/
COPY client/src ./client/src
COPY shared ./shared

ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}
RUN cd client && npm run build

FROM nginx:stable-alpine AS runtime
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/client/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
