describe("Product Service", () => {
  test("should validate product has name", () => {
    const product = { name: "Laptop", price: 999.99 };
    expect(product.name).toBeDefined();
  });

  test("should validate product has price", () => {
    const product = { name: "Laptop", price: 999.99 };
    expect(product.price).toBeGreaterThan(0);
  });
});
