FROM golang:1.23-bookworm AS builder

# Install build dependencies for CGo and MuPDF
RUN apt-get update && apt-get install -y gcc pkg-config && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy all source files first
COPY . .

# Download and tidy up dependencies (this creates go.sum inside the container based on imports)
RUN go mod tidy && go mod download

# Build the Go application with CGO enabled (required for go-fitz/MuPDF)
RUN CGO_ENABLED=1 GOOS=linux go build -ldflags="-w -s" -o tile-server ./main.go

# Stage 2: Minimal runtime image
FROM debian:bookworm-slim

# Install runtime certificates and text rendering libs just in case
RUN apt-get update && apt-get install -y ca-certificates fontconfig && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/tile-server /app/tile-server

# Create directory for tmp PDF storage from Express downloads
RUN mkdir -p /tmp/pdfs && chown -R nobody:nogroup /tmp/pdfs

USER nobody
EXPOSE 8080

CMD ["./tile-server"]
