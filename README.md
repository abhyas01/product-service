# Product Service

REST API for product catalog management — part of the ecommerce microservices platform.

## Tech Stack

- Node.js + Express
- PostgreSQL

## Prerequisites

- Node.js 18+
- PostgreSQL (or use Docker Compose from root)

## Setup

```bash
cd src
npm install
```

## Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

| Variable    | Default   | Description       |
| ----------- | --------- | ----------------- |
| DB_HOST     | localhost | Database host     |
| DB_NAME     | ecommerce | Database name     |
| DB_USER     | postgres  | Database user     |
| DB_PASSWORD | password  | Database password |
| PORT        | 3001      | Service port      |

## Running Locally

```bash
npm start
```

## Running Tests

```bash
npm test
```

## API Endpoints

| Method | Path          | Description       |
| ------ | ------------- | ----------------- |
| GET    | /health       | Health check      |
| GET    | /products     | List all products |
| GET    | /products/:id | Get product by ID |
| POST   | /products     | Create product    |

## Docker

```bash
docker build -t abhyas01/product-service .
docker run -p 3001:3001 abhyas01/product-service
```
