FROM rust:1.87-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo 'fn main(){}' > src/main.rs && cargo build --release && rm src/main.rs
COPY src ./src
COPY migrations ./migrations
RUN touch src/main.rs && cargo build --release

FROM debian:bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y libssl3 ca-certificates curl && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/shop-api .
COPY migrations ./migrations
ENV DATABASE_URL=sqlite:./shop.db
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s CMD curl -f http://localhost:8080/healthz || exit 1
CMD ["./shop-api"]
