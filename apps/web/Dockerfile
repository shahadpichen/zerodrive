# Build stage
FROM node:24-alpine AS builder

WORKDIR /repo

RUN corepack enable

# React embeds these public values in the browser bundle at build time. Never
# pass server secrets through a REACT_APP_* build argument.
ARG REACT_APP_API_URL
ARG REACT_APP_SITE_ORIGIN=https://zerodrive.xyz
ARG REACT_APP_RSA_PBKDF2_SALT
ENV REACT_APP_API_URL=${REACT_APP_API_URL}
ENV REACT_APP_SITE_ORIGIN=${REACT_APP_SITE_ORIGIN}
ENV REACT_APP_RSA_PBKDF2_SALT=${REACT_APP_RSA_PBKDF2_SALT}

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/studio/package.json apps/studio/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json

# Resolve the same workspace/peer graph recorded by the monorepo lockfile while
# installing only the frontend and its workspace dependencies.
RUN pnpm install --frozen-lockfile --filter @zerodrive/web...

COPY . .

RUN pnpm -r --filter './packages/*' build
RUN pnpm --filter @zerodrive/web build

# Production stage
FROM nginx:alpine

# Copy built app from builder
COPY --from=builder /repo/apps/web/build /usr/share/nginx/html

# Copy nginx config
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
