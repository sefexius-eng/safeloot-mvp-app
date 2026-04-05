"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ override: true });
const app_1 = require("./app");
const port = Number(process.env.PORT ?? 4000);
const app = (0, app_1.createApp)();
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
