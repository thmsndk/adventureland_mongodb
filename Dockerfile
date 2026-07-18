FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    git ca-certificates curl python3 python3-pip python3-venv \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Pin common_engine for reproducible private images; override at build with --build-arg
ARG COMMON_ENGINE_SHA=fa74fabf5d3782503712621e037bfb934ecb8439
ARG COMMON_ENGINE_REPO=https://github.com/kaansoral/common_engine.git

COPY package.json ./
COPY node/package.json ./node/
RUN npm install --omit=dev && cd node && npm install --omit=dev \
    && npm install -g nodemon@3

COPY . .
RUN if [ ! -d common/.git ] && [ ! -f common/init.js ]; then \
      rm -rf common && git clone --depth 1 "${COMMON_ENGINE_REPO}" common \
      && cd common && git fetch --depth 1 origin "${COMMON_ENGINE_SHA}" && git checkout "${COMMON_ENGINE_SHA}"; \
    fi

ENV DOCKER=1
ENV NODE_ENV=production

EXPOSE 8090 7192

COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh docker/*.sh 2>/dev/null || chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["backend"]
