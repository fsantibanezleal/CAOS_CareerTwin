ARG POSTGRES_IMAGE=postgres:17.10-bookworm@sha256:4f736ae292687621d4dbe0d499ffd024a36bd2ee7d8ca6f2ccd4c800f047b394

FROM ${POSTGRES_IMAGE} AS vector-builder

ARG PGVECTOR_COMMIT=778dacf20c07caf904557a88705142631818d8cb
ARG PGVECTOR_SHA256=4c33cf053329784ba6d992d05c9588b93789e907a7511f20ff5a5a5b8a0703c1

USER root
RUN apt-get update \
    && apt-get install --yes --no-install-recommends \
        build-essential \
        ca-certificates \
        postgresql-server-dev-17 \
    && rm -rf /var/lib/apt/lists/*
ADD --checksum=sha256:${PGVECTOR_SHA256} \
    https://github.com/pgvector/pgvector/archive/${PGVECTOR_COMMIT}.tar.gz \
    /tmp/pgvector.tar.gz
RUN mkdir -p /tmp/pgvector \
    && tar --extract --gzip --file /tmp/pgvector.tar.gz --directory /tmp/pgvector --strip-components=1 \
    && make -C /tmp/pgvector OPTFLAGS="" with_llvm=no \
    && make -C /tmp/pgvector DESTDIR=/opt/pgvector-root with_llvm=no install

FROM ${POSTGRES_IMAGE}

LABEL org.opencontainers.image.title="CareerTwin PostgreSQL with pgvector" \
      org.opencontainers.image.description="PostgreSQL 17.10 on glibc with pgvector 0.8.1 and verifiable collation provenance" \
      org.opencontainers.image.source="https://github.com/fsantibanezleal/CAOS_CareerTwin"

COPY --from=vector-builder /opt/pgvector-root/ /
