FROM node:12 AS dev

COPY ./package* /application/
COPY lib /application/
COPY index.js /application/
COPY config /application/
RUN npm install

FROM node:12 AS prod
CMD npm run prod

