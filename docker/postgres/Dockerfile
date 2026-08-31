ARG WOLFI_IMAGE=cgr.dev/chainguard/wolfi-base:latest@sha256:e624c5d5e42382ce7165ddafcbbf8e6769a24cbd02ea6114b880b05ae5ba2a8d

FROM ${WOLFI_IMAGE} AS postgres-builder

ARG POSTGRES_VERSION=17.11
ARG POSTGRES_SHA256=dd27f2b3c59e73ed14aa3324901242bf69a032a6347805f274e6260322d42979
ARG PGVECTOR_COMMIT=8ee86c96f0fd72390f890aa8a336fda6d3ab4c6c
ARG PGVECTOR_SHA256=d076a3098010905fd60256649327809651f6288327db6413f0938305f62ea299

RUN apk add --no-cache \
        build-base=1-r9 \
        bison=3.8.2-r62 \
        bzip2-dev=1.0.8-r23 \
        ca-certificates-bundle=20260611-r0 \
        flex=2.6.4-r11 \
        icu-dev=78.3-r3 \
        libedit-dev=3.1-r19 \
        libxml2-dev=2.15.3-r3 \
        libxslt-dev=1.1.45-r4 \
        lz4-dev=1.10.0-r10 \
        openssl-dev=3.6.4-r0 \
        perl=5.44.0-r0 \
        postgresql-17-oci-entrypoint=17.10-r1 \
        util-linux-dev=2.42.2-r4 \
        zlib-dev=1.3.2-r5 \
        zstd-dev=1.5.7-r8
ADD --checksum=sha256:${POSTGRES_SHA256} \
    https://ftp.postgresql.org/pub/source/v${POSTGRES_VERSION}/postgresql-${POSTGRES_VERSION}.tar.bz2 \
    /tmp/postgresql.tar.bz2
RUN mkdir -p /tmp/postgresql \
    && tar --extract --bzip2 --file /tmp/postgresql.tar.bz2 \
        --directory /tmp/postgresql --strip-components=1 \
    && cd /tmp/postgresql \
    && ./configure \
        --prefix=/usr \
        --bindir=/usr/lib/postgresql17 \
        --datadir=/usr/share/postgresql17 \
        --includedir=/usr/include/postgresql/17 \
        --libdir=/usr/lib \
        --mandir=/usr/share/postgresql17/man \
        --with-icu \
        --with-libedit-preferred \
        --with-libxml \
        --with-libxslt \
        --with-lz4 \
        --with-openssl \
        --with-uuid=e2fs \
        --with-zstd \
    && make -j2 \
    && make install \
    && make -C contrib -j2 \
    && make -C contrib install
ADD --checksum=sha256:${PGVECTOR_SHA256} \
    https://github.com/pgvector/pgvector/archive/${PGVECTOR_COMMIT}.tar.gz \
    /tmp/pgvector.tar.gz
RUN mkdir -p /tmp/pgvector \
    && tar --extract --gzip --file /tmp/pgvector.tar.gz --directory /tmp/pgvector --strip-components=1 \
    && make -C /tmp/pgvector PG_CONFIG=/usr/lib/postgresql17/pg_config OPTFLAGS="" with_llvm=no \
    && make -C /tmp/pgvector PG_CONFIG=/usr/lib/postgresql17/pg_config with_llvm=no install \
    && test -f /usr/share/postgresql17/extension/vector.control

FROM ${WOLFI_IMAGE}

RUN addgroup -S -g 70 postgres \
    && adduser -S -D -u 70 -G postgres -h /home/postgres -s /bin/sh postgres \
    && apk add --no-cache \
        bash=5.3-r12 \
        ca-certificates-bundle=20260611-r0 \
        glibc-2.44-locale-en=2.44-r1 \
        gosu=1.19-r16 \
        libcrypto3=3.6.4-r0 \
        libedit=3.1-r19 \
        libicu78=78.3-r3 \
        liblz4-1=1.10.0-r10 \
        libssl3=3.6.4-r0 \
        libuuid=2.42.2-r4 \
        libxml2-16=2.15.3-r3 \
        libxslt=1.1.45-r4 \
        libzstd1=1.5.7-r8 \
        posix-libc-utils-bin-2.44=2.44-r1 \
        tzdata=2026c-r0 \
        zlib=1.3.2-r5 \
    && mkdir -p /var/lib/postgres/initdb /var/lib/postgresql/data /var/run/postgresql \
    && chown -R postgres:postgres /var/lib/postgres /var/lib/postgresql /var/run/postgresql

COPY --from=postgres-builder /usr/bin/docker-entrypoint.sh /usr/bin/docker-entrypoint.sh
COPY --from=postgres-builder /usr/lib/postgresql /usr/lib/postgresql
COPY --from=postgres-builder /usr/lib/postgresql17 /usr/lib/postgresql17
COPY --from=postgres-builder /usr/lib/libecpg.so* /usr/lib/
COPY --from=postgres-builder /usr/lib/libecpg_compat.so* /usr/lib/
COPY --from=postgres-builder /usr/lib/libpgtypes.so* /usr/lib/
COPY --from=postgres-builder /usr/lib/libpq.so* /usr/lib/
COPY --from=postgres-builder /usr/share/postgresql17 /usr/share/postgresql17

ENV LANG=en_US.UTF-8 \
    PATH=/usr/lib/postgresql17:/usr/local/sbin:/usr/local/bin:/usr/bin:/usr/sbin:/sbin:/bin \
    PGDATA=/var/lib/postgresql/data \
    PG_MAJOR=17 \
    PG_VERSION=17.11

LABEL org.opencontainers.image.title="CareerTwin PostgreSQL with pgvector" \
      org.opencontainers.image.description="PostgreSQL 17.11 from verified upstream source on Wolfi/glibc 2.44 with pgvector 0.8.6" \
      org.opencontainers.image.source="https://github.com/fsantibanezleal/CAOS_CareerTwin" \
      org.opencontainers.image.version="17.11"

RUN test "$(postgres --version)" = "postgres (PostgreSQL) 17.11" \
    && test -f /usr/share/postgresql17/extension/vector.control \
    && ! command -v cc \
    && ! command -v make

ENTRYPOINT ["/usr/bin/docker-entrypoint.sh"]
CMD ["postgres"]
