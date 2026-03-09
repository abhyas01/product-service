// tests/product.unit.test.js
"use strict";

const request = require("supertest");

const mockQuery = jest.fn();
jest.mock("pg", () => ({
  Pool: jest.fn().mockImplementation(() => ({ query: mockQuery })),
}));

const app = require("../src/app");

// Mirrors exactly what Postgres returns for a products row
const makeProduct = (overrides = {}) => ({
  id: 1,
  name: "Laptop",
  price: "999.99",
  description: "High-performance laptop",
  created_at: "2024-01-15T10:00:00.000Z",
  ...overrides,
});

beforeEach(() => jest.clearAllMocks());

describe("GET /health", () => {
  test("returns 200 with text OK", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.text).toBe("OK");
  });
});

describe("GET /products", () => {
  test("returns 200 with all rows from DB", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        makeProduct({ id: 1, name: "Laptop", price: "999.99" }),
        makeProduct({ id: 2, name: "Mouse", price: "29.99" }),
        makeProduct({ id: 3, name: "Keyboard", price: "79.99" }),
      ],
    });

    const res = await request(app).get("/products");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/json/);
    expect(res.body).toHaveLength(3);
    expect(res.body[0].name).toBe("Laptop");
    expect(res.body[1].name).toBe("Mouse");
    expect(res.body[2].name).toBe("Keyboard");
  });

  test("returns 200 with empty array when no products exist", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get("/products");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(0);
  });

  test("each product in response has all expected fields", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [makeProduct()] });

    const res = await request(app).get("/products");

    const p = res.body[0];
    expect(p).toHaveProperty("id");
    expect(p).toHaveProperty("name");
    expect(p).toHaveProperty("price");
    expect(p).toHaveProperty("description");
    expect(p).toHaveProperty("created_at");
  });

  test("returns 500 with error field when DB throws", async () => {
    mockQuery.mockRejectedValueOnce(new Error("connection refused"));

    const res = await request(app).get("/products");

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("error");
  });

  test("does not expose DB error details in response", async () => {
    mockQuery.mockRejectedValueOnce(
      new Error("pg internal: password authentication failed"),
    );

    const res = await request(app).get("/products");

    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
    expect(JSON.stringify(res.body)).not.toMatch(/authentication/i);
  });
});

describe("GET /products/:id", () => {
  test("returns 200 with full product when found", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        makeProduct({
          id: 5,
          name: "Keyboard",
          price: "79.99",
          description: "Mechanical",
        }),
      ],
    });

    const res = await request(app).get("/products/5");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/json/);
    expect(res.body.id).toBe(5);
    expect(res.body.name).toBe("Keyboard");
    expect(res.body.price).toBe("79.99");
    expect(res.body.description).toBe("Mechanical");
    expect(res.body).toHaveProperty("created_at");
  });

  test("queries DB with the correct product id", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [makeProduct({ id: 42 })] });

    await request(app).get("/products/42");

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0][1]).toEqual(["42"]);
  });

  test("returns 404 with error message when product not found", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get("/products/999");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Product not found");
  });

  test("returns 400 for alphabetic ID — does not query DB", async () => {
    const res = await request(app).get("/products/abc");

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid product ID");
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test("returns 400 for float ID — does not query DB", async () => {
    const res = await request(app).get("/products/1.5");

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid product ID");
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test("passes negative ID to DB and returns 404 when not found", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get("/products/-1");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Product not found");
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  test("passes zero ID to DB and returns 404 when not found", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get("/products/0");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Product not found");
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  test("returns 500 with error field when DB throws", async () => {
    mockQuery.mockRejectedValueOnce(new Error("query timeout"));

    const res = await request(app).get("/products/1");

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("error");
  });
});

describe("POST /products", () => {
  test("returns 201 with the created product row", async () => {
    const created = makeProduct({
      id: 10,
      name: "Monitor",
      price: "299.99",
      description: "4K display",
    });
    mockQuery.mockResolvedValueOnce({ rows: [created] });

    const res = await request(app)
      .post("/products")
      .send({ name: "Monitor", price: 299.99, description: "4K display" });

    expect(res.status).toBe(201);
    expect(res.headers["content-type"]).toMatch(/json/);
    expect(res.body.id).toBe(10);
    expect(res.body.name).toBe("Monitor");
    expect(res.body.price).toBe("299.99");
    expect(res.body.description).toBe("4K display");
    expect(res.body).toHaveProperty("created_at");
  });

  test("passes name, price, description to DB query in correct order", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [makeProduct()] });

    await request(app)
      .post("/products")
      .send({ name: "Laptop", price: 999.99, description: "Gaming laptop" });

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const args = mockQuery.mock.calls[0][1];
    expect(args[0]).toBe("Laptop");
    expect(args[1]).toBe(999.99);
    expect(args[2]).toBe("Gaming laptop");
  });

  test("trims whitespace from name before passing to DB", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [makeProduct({ name: "Monitor" })],
    });

    await request(app)
      .post("/products")
      .send({ name: "  Monitor  ", price: 299.99 });

    const args = mockQuery.mock.calls[0][1];
    expect(args[0]).toBe("Monitor");
  });

  test("uses empty string for description when not provided", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [makeProduct()] });

    await request(app)
      .post("/products")
      .send({ name: "Laptop", price: 999.99 });

    const args = mockQuery.mock.calls[0][1];
    expect(args[2]).toBe("");
  });

  test("coerces price string to a number before passing to DB", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [makeProduct()] });

    await request(app)
      .post("/products")
      .send({ name: "Laptop", price: "299.99" });

    const args = mockQuery.mock.calls[0][1];
    expect(typeof args[1]).toBe("number");
    expect(args[1]).toBe(299.99);
  });

  test("returns 400 when name is missing — does not query DB", async () => {
    const res = await request(app).post("/products").send({ price: 99.99 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Product name is required");
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test("returns 400 when name is an empty string — does not query DB", async () => {
    const res = await request(app)
      .post("/products")
      .send({ name: "", price: 99.99 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Product name is required");
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test("returns 400 when name is only whitespace — does not query DB", async () => {
    const res = await request(app)
      .post("/products")
      .send({ name: "   ", price: 99.99 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Product name is required");
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test("returns 400 when name is not a string — does not query DB", async () => {
    const res = await request(app)
      .post("/products")
      .send({ name: 123, price: 99.99 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Product name is required");
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test("returns 400 when price is missing — does not query DB", async () => {
    const res = await request(app).post("/products").send({ name: "Laptop" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Price must be a positive number");
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test("returns 400 when price is zero — does not query DB", async () => {
    const res = await request(app)
      .post("/products")
      .send({ name: "Laptop", price: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Price must be a positive number");
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test("returns 400 when price is negative — does not query DB", async () => {
    const res = await request(app)
      .post("/products")
      .send({ name: "Laptop", price: -1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Price must be a positive number");
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test("returns 400 when price is a non-numeric string — does not query DB", async () => {
    const res = await request(app)
      .post("/products")
      .send({ name: "Laptop", price: "free" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Price must be a positive number");
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test("returns 500 with error field when DB throws on insert", async () => {
    mockQuery.mockRejectedValueOnce(new Error("disk full"));

    const res = await request(app)
      .post("/products")
      .send({ name: "Laptop", price: 999.99 });

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("error");
  });
});
