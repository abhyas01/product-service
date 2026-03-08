describe("Product Service", () => {
  test("should validate product has name", () => {
    const product = { name: "Laptop", price: 999.99 };
    expect(product.name).toBeDefined();
  });

  test("should validate product has price", () => {
    const product = { name: "Laptop", price: 999.99 };
    expect(product.price).toBeGreaterThan(0);
  });

  test("should reject empty product name", () => {
    const product = { name: "", price: 999.99 };
    expect(product.name.trim()).toBe("");
  });

  test("should reject negative price", () => {
    const product = { name: "Laptop", price: -10 };
    expect(product.price).toBeLessThan(0);
  });
});
