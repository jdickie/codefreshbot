FROM node:10

RUN mkdir /application
WORKDIR /application
COPY ./package* /application/
RUN ls && npm install
CMD npm run dev
