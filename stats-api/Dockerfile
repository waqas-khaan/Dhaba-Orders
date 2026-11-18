
FROM composer:2 AS vendor

WORKDIR /app

COPY composer.json ./
RUN composer install --no-dev --no-interaction --prefer-dist --no-scripts

COPY . .
RUN composer dump-autoload --optimize --no-dev

FROM php:8.3-fpm-alpine

RUN apk add --no-cache nginx postgresql-dev libxml2-dev oniguruma-dev \
    && docker-php-ext-install pdo_pgsql mbstring xml \
    && addgroup -S app \
    && adduser -S app -G app \
    && sed -i 's/^user nginx;/# user nginx;/' /etc/nginx/nginx.conf \
    && mkdir -p /var/lib/nginx/tmp/client_body /var/lib/nginx/tmp/proxy \
       /var/lib/nginx/tmp/fastcgi /var/lib/nginx/tmp/uwsgi \
       /var/lib/nginx/tmp/scgi /var/log/nginx /run/nginx /tmp/nginx \
       /var/www/html/storage/framework/cache \
       /var/www/html/storage/framework/sessions \
       /var/www/html/storage/framework/views \
       /var/www/html/storage/logs /var/www/html/bootstrap/cache \
    && chown -R app:app /var/lib/nginx /var/log/nginx /run/nginx /tmp/nginx /var/www/html

WORKDIR /var/www/html

COPY --from=vendor --chown=app:app /app/ /var/www/html/
COPY nginx.conf /etc/nginx/http.d/default.conf

RUN sed -i 's/^user = .*/user = app/; s/^group = .*/group = app/; s|^;*listen.owner = .*|listen.owner = app|; s|^;*listen.group = .*|listen.group = app|' /usr/local/etc/php-fpm.d/www.conf \
    && sed -i 's|^pid = .*|pid = /tmp/php-fpm.pid|' /usr/local/etc/php-fpm.conf \
    && sed -i 's|^;*daemonize = .*|daemonize = yes|' /usr/local/etc/php-fpm.conf

ENV REDIS_CLIENT=predis

USER app

EXPOSE 8081

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -q -O /dev/null http://127.0.0.1:8081/up || exit 1

CMD ["sh", "-c", "php-fpm -D && exec nginx -g 'daemon off; pid /tmp/nginx.pid;'"]

