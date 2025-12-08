import { Hono } from "hono";
import { handle } from "hono/vercel";
import { logger } from "hono/logger";
import { cors } from "hono/cors";

// Import routes from server
import { authRoute } from "../server/routes/auth";
import { topicsRoute } from "../server/routes/topics";
import { ragRoute } from "../server/routes/rag";
import { lessonPlansRoute } from "../server/routes/lessonPlans";

// Set runtime to edge for better performance (optional, can use nodejs too)
export const config = {
  runtime: "nodejs",
};

const app = new Hono().basePath("/api");

// Enable CORS
app.use("*", cors());
app.use("*", logger());

// Mount routes
const apiRoutes = app
  .route("/topics", topicsRoute)
  .route("/rag", ragRoute)
  .route("/lessonPlans", lessonPlansRoute)
  .route("/", authRoute);

export default handle(app);
export type ApiRoutes = typeof apiRoutes;

