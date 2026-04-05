import dotenv from "dotenv";

dotenv.config({ override: true });

import { createApp } from "./app";

const port = Number(process.env.PORT ?? 4000);
const app = createApp();

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});