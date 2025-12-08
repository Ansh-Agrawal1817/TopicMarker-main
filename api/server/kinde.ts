import {
  createKindeServerClient,
  GrantType,
  type SessionManager,
  type UserType,
} from "@kinde-oss/kinde-typescript-sdk";
import { type Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";

// Lazy Kinde client initialization for serverless
let _kindeClient: ReturnType<typeof createKindeServerClient> | null = null;

function getKindeClient() {
  if (!_kindeClient) {
    _kindeClient = createKindeServerClient(
      GrantType.AUTHORIZATION_CODE,
      {
        authDomain: process.env.KINDE_DOMAIN!,
        clientId: process.env.KINDE_CLIENT_ID!,
        clientSecret: process.env.KINDE_CLIENT_SECRET!,
        redirectURL: process.env.KINDE_REDIRECT_URI!,
        logoutRedirectURL: process.env.KINDE_LOGOUT_REDIRECT_URI!,
      }
    );
  }
  return _kindeClient;
}

export const kindeClient = {
  login: (...args: Parameters<ReturnType<typeof createKindeServerClient>['login']>) => getKindeClient().login(...args),
  register: (...args: Parameters<ReturnType<typeof createKindeServerClient>['register']>) => getKindeClient().register(...args),
  logout: (...args: Parameters<ReturnType<typeof createKindeServerClient>['logout']>) => getKindeClient().logout(...args),
  handleRedirectToApp: (...args: Parameters<ReturnType<typeof createKindeServerClient>['handleRedirectToApp']>) => getKindeClient().handleRedirectToApp(...args),
  isAuthenticated: (...args: Parameters<ReturnType<typeof createKindeServerClient>['isAuthenticated']>) => getKindeClient().isAuthenticated(...args),
  getUserProfile: (...args: Parameters<ReturnType<typeof createKindeServerClient>['getUserProfile']>) => getKindeClient().getUserProfile(...args),
};

let store: Record<string, unknown> = {};

export const sessionManager = (c: Context): SessionManager => ({
  async getSessionItem(key: string) {
    const result = getCookie(c, key);
    return result;
  },
  async setSessionItem(key: string, value: unknown) {
    const cookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    } as const;
    if (typeof value === "string") {
      setCookie(c, key, value, cookieOptions);
    } else {
      setCookie(c, key, JSON.stringify(value), cookieOptions);
    }
  },
  async removeSessionItem(key: string) {
    deleteCookie(c, key);
  },
  async destroySession() {
    ["id_token", "access_token", "user", "refresh_token"].forEach((key) => {
      deleteCookie(c, key);
    });
  },
});

type Env = {
  Variables: {
    user: UserType;
  };
};

export const getUser = createMiddleware<Env>(async (c, next) => {
  try {
    const manager = sessionManager(c);
    const isAuthenticated = await kindeClient.isAuthenticated(manager);
    if (!isAuthenticated) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    const user = await kindeClient.getUserProfile(manager);
    c.set("user", user);
    await next();
  } catch (e) {
    console.error(e);
    return c.json({ error: "Unauthorized" }, 401);
  }
});
