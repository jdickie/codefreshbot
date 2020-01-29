FROM node:10 AS dev

RUN mkdir /application
WORKDIR /application
COPY ./package* /application/
RUN ls && npm install
CMD npm run dev

FROM node:10 AS prod

COPY ./package* /application/
COPY lib /application/
COPY index.js /application/
COPY config /application/
RUN npm install
CMD npm run prod

