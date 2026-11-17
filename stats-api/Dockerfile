FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json ./
RUN composer install --no-dev --no-interaction --prefer-dist --no-scripts
COPY . .
RUN composer dump-autoload --optimize

FROM php:8.3-fpm-alpine
RUN apk add --no-cache nginx postgresql-dev && docker-php-ext-install pdo pdo_pgsql
RUN addgroup -S app && adduser -S app -G app
WORKDIR /var/www/html
COPY --from=vendor /app .
COPY nginx.conf /etc/nginx/http.d/default.conf
RUN mkdir -p storage/framework/{cache,sessions,views} storage/logs bootstrap/cache && chown -R app:app storage bootstrap/cache
USER app
EXPOSE 8081
CMD ["sh","-c","php-fpm -D && nginx -g 'daemon off;'"]
