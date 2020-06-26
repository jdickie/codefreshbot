FROM node:12 AS dev

ARG AWS_ACCESS_KEY_ID
ARG AWS_SECRET_ACCESS_KEY
ARG AWS_REGION

ENV AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
ENV AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
ENV AWS_REGION=${AWS_REGION}

COPY ./package* /application/
COPY lib /application/lib
COPY scripts /application/scripts
COPY index.js /application/
RUN mkdir /application/config
WORKDIR /application
RUN npm install
RUN npm run config
RUN ls /application/config/
CMD npm run dev

FROM dev AS prod
CMD npm run prod

