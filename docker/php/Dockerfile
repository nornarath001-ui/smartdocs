FROM php:8.4-fpm

# 1. System libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    git unzip libpq-dev libzip-dev libpng-dev libonig-dev libicu-dev poppler-utils \
 && rm -rf /var/lib/apt/lists/*

# 2. PHP extensions, one at a time, single compile job (-j1) to save memory
RUN docker-php-ext-install -j1 pdo_pgsql
RUN docker-php-ext-install -j1 zip
RUN docker-php-ext-install -j1 bcmath
RUN docker-php-ext-install -j1 pcntl
RUN docker-php-ext-install -j1 intl
RUN docker-php-ext-install -j1 gd

# 3. Redis extension
RUN pecl install redis && docker-php-ext-enable redis

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

RUN printf "upload_max_filesize=100M\npost_max_size=100M\nmemory_limit=512M\n" \
    > /usr/local/etc/php/conf.d/uploads.ini

WORKDIR /var/www/html

# ---- Document conversion ----
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-writer fonts-liberation fonts-khmeros \
    fonts-crosextra-carlito fonts-crosextra-caladea \
    python3 python3-venv \
 && rm -rf /var/lib/apt/lists/*

RUN python3 -m venv /opt/pdfenv \
 && /opt/pdfenv/bin/pip install --upgrade pip

ENV PIP_DEFAULT_TIMEOUT=180 PIP_RETRIES=15 PIP_RESUME_RETRIES=30
RUN --mount=type=cache,target=/root/.cache/pip /opt/pdfenv/bin/pip install opencv-python-headless
RUN --mount=type=cache,target=/root/.cache/pip /opt/pdfenv/bin/pip install pymupdf
RUN --mount=type=cache,target=/root/.cache/pip /opt/pdfenv/bin/pip install pdf2docx
