ARG POSTGRES_IMAGE=postgres:17.10-alpine3.23@sha256:8189a1f6e40904781fc9e2612687877791d21679866db58b1de996b31fc312e4

FROM ${POSTGRES_IMAGE} AS vector-builder

ARG PGVECTOR_COMMIT=778dacf20c07caf904557a88705142631818d8cb
ARG PGVECTOR_SHA256=4c33cf053329784ba6d992d05c9588b93789e907a7511f20ff5a5a5b8a0703c1

USER root
RUN apk add --no-cache build-base
ADD --checksum=sha256:${PGVECTOR_SHA256} \
    https://github.com/pgvector/pgvector/archive/${PGVECTOR_COMMIT}.tar.gz \
    /tmp/pgvector.tar.gz
RUN mkdir -p /tmp/pgvector \
    && tar --extract --gzip --file /tmp/pgvector.tar.gz --directory /tmp/pgvector --strip-components=1 \
    && make -C /tmp/pgvector OPTFLAGS="" with_llvm=no \
    && make -C /tmp/pgvector DESTDIR=/opt/pgvector-root with_llvm=no install

FROM ${POSTGRES_IMAGE}

LABEL org.opencontainers.image.title="CareerTwin PostgreSQL with pgvector" \
      org.opencontainers.image.description="PostgreSQL 17.10 with pgvector 0.8.1 and a current privilege-drop helper" \
      org.opencontainers.image.source="https://github.com/fsantibanezleal/CAOS_CareerTwin"

USER root
RUN apk add --no-cache su-exec \
    && rm /usr/local/bin/gosu \
    && ln -s /sbin/su-exec /usr/local/bin/gosu
COPY --from=vector-builder /opt/pgvector-root/ /
