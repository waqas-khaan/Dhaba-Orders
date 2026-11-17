FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
ARG APP_VERSION=dev
ENV APP_VERSION=${APP_VERSION}
RUN npm run build

FROM nginx:1.27-alpine
RUN addgroup -S app && adduser -S app -G app \
    && sed -i 's/^user .*/# user/' /etc/nginx/nginx.conf \
    && sed -i 's|/run/nginx.pid|/tmp/nginx.pid|' /etc/nginx/nginx.conf \
    && mkdir -p /var/cache/nginx /var/log/nginx /etc/nginx/conf.d \
    && chown -R app:app /var/cache/nginx /var/log/nginx /etc/nginx

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build --chown=app:app /app/dist /usr/share/nginx/html

USER app

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -q -O /dev/null http://127.0.0.1:80/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
