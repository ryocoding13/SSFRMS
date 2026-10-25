process.env.VITE_WORKFLOW_DEMO = "true";
process.env.MOCK_API_PORT ||= "5299";
console.log("MÔ PHỎNG TOÀN BỘ FE: không dùng cho giao dịch thật. Dữ liệu bổ sung lưu trong trình duyệt.");
await import("./dev-business.mjs");
