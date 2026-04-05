"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProductsController = getProductsController;
exports.getProductByIdController = getProductByIdController;
exports.createProductController = createProductController;
const ProductService_1 = require("../services/ProductService");
async function getProductsController(_request, response) {
    try {
        const products = await ProductService_1.productService.listProducts();
        response.status(200).json(products);
    }
    catch (error) {
        console.error("[PRODUCT_LIST_ERROR]", error);
        response.status(500).json({ message: "Failed to load products." });
    }
}
async function getProductByIdController(request, response) {
    try {
        const productIdParam = request.params.id;
        const productId = Array.isArray(productIdParam)
            ? productIdParam[0]?.trim()
            : productIdParam?.trim();
        if (!productId) {
            response.status(400).json({ message: "Product id is required." });
            return;
        }
        const product = await ProductService_1.productService.getProductById(productId);
        if (!product) {
            response.status(404).json({ message: "Product not found." });
            return;
        }
        response.status(200).json(product);
    }
    catch (error) {
        console.error("[PRODUCT_DETAIL_ERROR]", error);
        response.status(500).json({ message: "Failed to load product." });
    }
}
async function createProductController(request, response) {
    try {
        const body = request.body;
        const product = await ProductService_1.productService.createProduct({
            title: body.title ?? "",
            description: body.description ?? "",
            price: Number(body.price),
            gameId: body.gameId ?? "",
            type: body.type ?? "",
            sellerId: body.sellerId ?? "",
        });
        response.status(201).json(product);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create product.";
        const statusCode = message.includes("was not found") ? 404 : 400;
        response.status(statusCode).json({ message });
    }
}
