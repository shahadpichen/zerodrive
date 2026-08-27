FROM node:24-alpine AS build

WORKDIR /repo

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/studio/package.json apps/studio/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json

# Keep every workspace manifest present while resolving the filtered install.
# Omitting sibling manifests can make pnpm choose a different optional peer
# graph than the committed lockfile (notably Express 4 vs Express 5 types).
RUN pnpm install --frozen-lockfile --filter @zerodrive/api...

COPY . .

RUN pnpm -r --filter './packages/*' build
RUN pnpm --filter @zerodrive/api build

# Create a portable API package with an isolated production dependency tree.
# `pnpm prune` is not workspace-aware and can remove the package links needed
# by the compiled API at runtime.
RUN pnpm --filter @zerodrive/api --prod deploy --legacy /prod/api

FROM node:24-alpine AS runtime

ENV NODE_ENV=production

WORKDIR /app

COPY --from=build --chown=node:node /prod/api ./

# Fail the image build if the portable deployment is missing the compiled
# migration runner or critical runtime dependencies.
RUN test -f dist/scripts/migrate.js \
  && node -e "require.resolve('pg'); require.resolve('express')"

USER node

EXPOSE 3001

# The runtime image contains only the deployed API package and its production
# dependencies. Container startup performs no package-manager work.
CMD ["node", "dist/server.js"]
