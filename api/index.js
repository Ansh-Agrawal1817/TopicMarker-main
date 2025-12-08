// Vercel API route with Hono
import { Hono } from "hono";
import { handle } from "hono/vercel";
import { cors } from "hono/cors";

const app = new Hono().basePath("/api");

// Enable CORS
app.use("*", cors());

// Debug endpoint
app.get("/debug", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    hasKindeDomain: !!process.env.KINDE_DOMAIN,
    hasKindeClientId: !!process.env.KINDE_CLIENT_ID,
    hasKindeClientSecret: !!process.env.KINDE_CLIENT_SECRET,
    hasKindeRedirectUri: !!process.env.KINDE_REDIRECT_URI,
    hasKindeLogoutRedirectUri: !!process.env.KINDE_LOGOUT_REDIRECT_URI,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
  });
});

// Lazy Kinde client
let _kindeClient = null;
async function getKindeClient() {
  if (!_kindeClient) {
    const { createKindeServerClient, GrantType } = await import("@kinde-oss/kinde-typescript-sdk");
    _kindeClient = createKindeServerClient(GrantType.AUTHORIZATION_CODE, {
      authDomain: process.env.KINDE_DOMAIN,
      clientId: process.env.KINDE_CLIENT_ID,
      clientSecret: process.env.KINDE_CLIENT_SECRET,
      redirectURL: process.env.KINDE_REDIRECT_URI,
      logoutRedirectURL: process.env.KINDE_LOGOUT_REDIRECT_URI,
    });
  }
  return _kindeClient;
}

// Session manager helper
import { getCookie, setCookie, deleteCookie } from "hono/cookie";

function createSessionManager(c) {
  return {
    async getSessionItem(key) {
      return getCookie(c, key);
    },
    async setSessionItem(key, value) {
      const cookieOptions = { httpOnly: true, secure: true, sameSite: "Lax" };
      if (typeof value === "string") {
        setCookie(c, key, value, cookieOptions);
      } else {
        setCookie(c, key, JSON.stringify(value), cookieOptions);
      }
    },
    async removeSessionItem(key) {
      deleteCookie(c, key);
    },
    async destroySession() {
      ["id_token", "access_token", "user", "refresh_token"].forEach((key) => {
        deleteCookie(c, key);
      });
    },
  };
}

// Auth routes
app.get("/login", async (c) => {
  try {
    const kindeClient = await getKindeClient();
    const sessionManager = createSessionManager(c);
    const loginUrl = await kindeClient.login(sessionManager);
    return c.redirect(loginUrl.toString());
  } catch (error) {
    return c.json({ error: "Login failed", message: error.message }, 500);
  }
});

app.get("/register", async (c) => {
  try {
    const kindeClient = await getKindeClient();
    const sessionManager = createSessionManager(c);
    const registerUrl = await kindeClient.register(sessionManager);
    return c.redirect(registerUrl.toString());
  } catch (error) {
    return c.json({ error: "Register failed", message: error.message }, 500);
  }
});

app.get("/callback", async (c) => {
  try {
    const kindeClient = await getKindeClient();
    const sessionManager = createSessionManager(c);
    const url = new URL(c.req.url);
    await kindeClient.handleRedirectToApp(sessionManager, url);
    return c.redirect("/");
  } catch (error) {
    return c.json({ error: "Callback failed", message: error.message }, 500);
  }
});

app.get("/logout", async (c) => {
  try {
    const kindeClient = await getKindeClient();
    const sessionManager = createSessionManager(c);
    const logoutUrl = await kindeClient.logout(sessionManager);
    return c.redirect(logoutUrl.toString());
  } catch (error) {
    return c.json({ error: "Logout failed", message: error.message }, 500);
  }
});

app.get("/me", async (c) => {
  try {
    const kindeClient = await getKindeClient();
    const sessionManager = createSessionManager(c);
    const isAuthenticated = await kindeClient.isAuthenticated(sessionManager);
    if (!isAuthenticated) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    const user = await kindeClient.getUserProfile(sessionManager);
    return c.json({ user });
  } catch (error) {
    return c.json({ error: "Unauthorized", message: error.message }, 401);
  }
});

// Export handler
export default handle(app);
