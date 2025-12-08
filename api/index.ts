import { Hono } from "hono";
import { handle } from "hono/vercel";
import { logger } from "hono/logger";
import { cors } from "hono/cors";

// Import routes from server
import { authRoute } from "../server/routes/auth";
import { topicsRoute } from "../server/routes/topics";
import { ragRoute } from "../server/routes/rag";
import { lessonPlansRoute } from "../server/routes/lessonPlans";

const app = new Hono().basePath("/api");

// Enable CORS
app.use("*", cors());
app.use("*", logger());

// Mount routes
app.route("/topics", topicsRoute);
app.route("/rag", ragRoute);
app.route("/lessonPlans", lessonPlansRoute);
app.route("/", authRoute);

export default handle(app);
