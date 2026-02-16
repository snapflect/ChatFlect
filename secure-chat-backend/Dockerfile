FROM php:8.2-fpm-alpine

# Security: Create non-root user
RUN addgroup -g 1000 chatflect && adduser -u 1000 -G chatflect -s /bin/sh -D chatflect

# Install dependencies (Minimal)
RUN apk add --no-cache \
    nginx \
    supervisor \
    curl \
    libzip-dev \
    zip \
    && docker-php-ext-install pdo pdo_mysql mysqli opcache zip

# Copy Configuration
COPY config/php.ini /usr/local/etc/php/conf.d/custom.ini
COPY config/nginx.conf /etc/nginx/http.d/default.conf
COPY config/supervisord.conf /etc/supervisord.conf

# Application Code
WORKDIR /var/www/html
COPY --chown=chatflect:chatflect . .

# Permissions
RUN chown -R chatflect:chatflect /var/www/html \
    && touch /var/run/nginx.pid \
    && chown -R chatflect:chatflect /var/run/nginx.pid \
    && chown -R chatflect:chatflect /var/lib/nginx/logs \
    && chown -R chatflect:chatflect /var/lib/nginx/tmp

# Switch to non-root
USER chatflect

# Expose Port
EXPOSE 8080

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s \
  CMD curl -f http://localhost:8080/api/status.php || exit 1

# Start Supervisor (Runs Nginx + PHP-FPM)
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
