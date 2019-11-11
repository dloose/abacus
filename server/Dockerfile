FROM node:12

# Only copy the files needed to fetch the dependencies. This will also create
# the destination directories
COPY ./package.json ./yarn.lock /abacus-stock-server/

# Fetch the dependencies
WORKDIR  /abacus-stock-server
RUN yarn install --ignore-engines --frozen-lockfile && yarn cache clean

# Copy the rest of the code and build it
COPY . /abacus-stock-server
RUN yarn run build

CMD yarn run serve
