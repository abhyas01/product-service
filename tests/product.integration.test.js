"use strict";

const request = require("supertest");
const { Pool } = require("pg");

// Import the real app — no mocks in this file
const app = require("../src/app");

// DB client (used for setup / teardown only)
const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "ecommerce",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "password",
  port: parseInt(process.env.DB_PORT || "5432", 10),
});

// Schema bootstrap
beforeAll(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id          SERIAL PRIMARY KEY,
      name        VARCHAR(255) NOT NULL,
      price       DECIMAL(10,2) NOT NULL,
      description TEXT,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// Clean the table between tests so each test starts with a known state
beforeEach(async () => {
  await pool.query("TRUNCATE TABLE products RESTART IDENTITY CASCADE");
});

afterAll(async () => {
  await pool.end();
});

//  Tests

describe("GET /health", () => {
  test("returns 200 OK", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.text).toBe("OK");
  });
});

describe("GET /products — integration", () => {
  test("returns empty array when table is empty", async () => {
    const res = await request(app).get("/products");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test("returns all seeded rows from the real database", async () => {
    await pool.query(`
      INSERT INTO products (name, price, description) VALUES
        ('Laptop',   999.99, 'High-performance laptop'),
        ('Mouse',     29.99, 'Wireless mouse'),
        ('Keyboard',  79.99, 'Mechanical keyboard')
    `);

    const res = await request(app).get("/products");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);

    const names = res.body.map((p) => p.name);
    expect(names).toContain("Laptop");
    expect(names).toContain("Mouse");
    expect(names).toContain("Keyboard");
  });

  test("each row has the expected shape", async () => {
    await pool.query(
      "INSERT INTO products (name, price, description) VALUES ('Monitor', 299.99, '4K display')",
    );

    const res = await request(app).get("/products");

    const p = res.body[0];
    expect(p).toHaveProperty("id");
    expect(p).toHaveProperty("name", "Monitor");
    expect(p).toHaveProperty("description", "4K display");
    expect(p).toHaveProperty("created_at");
    // price comes back as a string from pg DECIMAL
    expect(parseFloat(p.price)).toBeCloseTo(299.99, 2);
  });
});

describe("GET /products/:id — integration", () => {
  test("returns 200 with the correct product from the DB", async () => {
    const ins = await pool.query(
      "INSERT INTO products (name, price, description) VALUES ('Headphones', 149.99, 'Noise-cancelling') RETURNING id",
    );
    const id = ins.rows[0].id;

    const res = await request(app).get(`/products/${id}`);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Headphones");
    expect(parseFloat(res.body.price)).toBeCloseTo(149.99, 2);
  });

  test("returns 404 for a non-existent id", async () => {
    const res = await request(app).get("/products/99999");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Product not found");
  });

  test("returns 400 for a non-integer id", async () => {
    const res = await request(app).get("/products/abc");
    expect(res.status).toBe(400);
  });
});

describe("POST /products — integration", () => {
  test("creates a product and persists it to the DB", async () => {
    const res = await request(app)
      .post("/products")
      .send({ name: "Webcam", price: 89.99, description: "HD webcam" });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe("Webcam");

    // Verify it's actually in the DB
    const dbRes = await pool.query("SELECT * FROM products WHERE id = $1", [
      res.body.id,
    ]);
    expect(dbRes.rows).toHaveLength(1);
    expect(dbRes.rows[0].name).toBe("Webcam");
    expect(parseFloat(dbRes.rows[0].price)).toBeCloseTo(89.99, 2);
  });

  test("creating two products gives them different ids", async () => {
    const r1 = await request(app)
      .post("/products")
      .send({ name: "A", price: 1 });
    const r2 = await request(app)
      .post("/products")
      .send({ name: "B", price: 2 });

    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    expect(r1.body.id).not.toBe(r2.body.id);
  });

  test("created product appears in GET /products", async () => {
    await request(app).post("/products").send({ name: "SSD", price: 119.99 });

    const listRes = await request(app).get("/products");
    expect(listRes.body.some((p) => p.name === "SSD")).toBe(true);
  });

  test("returns 400 and does NOT insert when name is missing", async () => {
    const res = await request(app).post("/products").send({ price: 10 });

    expect(res.status).toBe(400);
    const countRes = await pool.query("SELECT COUNT(*) FROM products");
    expect(parseInt(countRes.rows[0].count, 10)).toBe(0);
  });

  test("returns 400 and does NOT insert when price is zero", async () => {
    const res = await request(app)
      .post("/products")
      .send({ name: "Freebie", price: 0 });

    expect(res.status).toBe(400);
    const countRes = await pool.query("SELECT COUNT(*) FROM products");
    expect(parseInt(countRes.rows[0].count, 10)).toBe(0);
  });
});
