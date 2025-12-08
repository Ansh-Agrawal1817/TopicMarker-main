// Plain JavaScript Vercel API - no frameworks
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const path = req.url?.split("?")[0] || "";
  
  try {
    // Debug endpoint - no dependencies
    if (path.includes("/debug")) {
      return res.status(200).json({
        status: "ok",
        timestamp: new Date().toISOString(),
        path: path,
        hasKindeDomain: !!process.env.KINDE_DOMAIN,
        hasKindeClientId: !!process.env.KINDE_CLIENT_ID,
        hasKindeClientSecret: !!process.env.KINDE_CLIENT_SECRET,
        hasKindeRedirectUri: !!process.env.KINDE_REDIRECT_URI,
        hasKindeLogoutRedirectUri: !!process.env.KINDE_LOGOUT_REDIRECT_URI,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
      });
    }

    // Login endpoint
    if (path.includes("/login")) {
      const kindeClient = await getKindeClient();
      const sessionManager = createCookieSessionManager(req, res);
      const loginUrl = await kindeClient.login(sessionManager);
      res.setHeader("Location", loginUrl.toString());
      return res.status(302).end();
    }

    // Register endpoint
    if (path.includes("/register")) {
      const kindeClient = await getKindeClient();
      const sessionManager = createCookieSessionManager(req, res);
      const registerUrl = await kindeClient.register(sessionManager);
      res.setHeader("Location", registerUrl.toString());
      return res.status(302).end();
    }

    // Callback endpoint
    if (path.includes("/callback")) {
      const kindeClient = await getKindeClient();
      const sessionManager = createCookieSessionManager(req, res);
      const fullUrl = `https://${req.headers.host}${req.url}`;
      await kindeClient.handleRedirectToApp(sessionManager, new URL(fullUrl));
      res.setHeader("Location", "/");
      return res.status(302).end();
    }

    // Logout endpoint
    if (path.includes("/logout")) {
      const kindeClient = await getKindeClient();
      const sessionManager = createCookieSessionManager(req, res);
      const logoutUrl = await kindeClient.logout(sessionManager);
      res.setHeader("Location", logoutUrl.toString());
      return res.status(302).end();
    }

    // Me endpoint
    if (path.includes("/me")) {
      const kindeClient = await getKindeClient();
      const sessionManager = createCookieSessionManager(req, res);
      const isAuthenticated = await kindeClient.isAuthenticated(sessionManager);
      if (!isAuthenticated) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const user = await kindeClient.getUserProfile(sessionManager);
      return res.status(200).json({ user });
    }

    return res.status(404).json({ error: "Not found", path });
  } catch (error) {
    console.error("API Error:", error);
    return res.status(500).json({ 
      error: "Server error", 
      message: error.message,
      stack: error.stack 
    });
  }
}

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

// Cookie-based session manager
function createCookieSessionManager(req, res) {
  const cookies = parseCookies(req.headers.cookie || "");
  const cookiesToSet = []; // Accumulate cookies to set
  
  return {
    async getSessionItem(key) {
      return cookies[key];
    },
    async setSessionItem(key, value) {
      const val = typeof value === "string" ? value : JSON.stringify(value);
      cookiesToSet.push(`${key}=${val}; HttpOnly; Secure; SameSite=Lax; Path=/`);
      // Set all accumulated cookies
      res.setHeader("Set-Cookie", cookiesToSet);
    },
    async removeSessionItem(key) {
      cookiesToSet.push(`${key}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
      res.setHeader("Set-Cookie", cookiesToSet);
    },
    async destroySession() {
      const keys = ["id_token", "access_token", "user", "refresh_token", "ac-state-key"];
      keys.forEach(key => {
        cookiesToSet.push(`${key}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
      });
      res.setHeader("Set-Cookie", cookiesToSet);
    },
  };
}

function parseCookies(cookieHeader) {
  const cookies = {};
  if (cookieHeader) {
    cookieHeader.split(";").forEach(cookie => {
      const [name, ...rest] = cookie.split("=");
      cookies[name.trim()] = rest.join("=").trim();
    });
  }
  return cookies;
}
