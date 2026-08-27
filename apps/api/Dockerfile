FROM node:24-alpine

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

RUN CI=true pnpm prune --prod --ignore-scripts

RUN chown -R node:node /repo
USER node

EXPOSE 3001

# The production image is fully built and pruned above. Execute the compiled
# server directly so container startup never invokes pnpm or attempts to
# reconcile node_modules at runtime.
CMD ["node", "apps/api/dist/server.js"]
