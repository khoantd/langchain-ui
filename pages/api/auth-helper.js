import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { prismaClient } from "../../lib/prisma";
import { getOrCreateSystemUser, isAuthEnabled } from "../../lib/auth";

export async function authenticateRequest(request, response) {
  if (isAuthEnabled()) {
    // Standard authentication flow
    const session = await getServerSession(request, response, authOptions);
    if (!session || !session.user) {
      response.status(401).json({ error: "Unauthorized" });
      return null;
    }

    const user = await prismaClient.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      response.status(401).json({ error: "User not found" });
      return null;
    }

    return user;
  } else {
    // Use system user when auth is disabled
    const systemUser = await getOrCreateSystemUser();
    return systemUser;
  }
}

export function checkAuthRestrictions(request, response) {
  if (!isAuthEnabled()) {
    const isDevelopment = process.env.NODE_ENV === "development";
    const isLocalhost = 
      request.headers.host?.includes('localhost') || 
      request.headers.host?.includes('127.0.0.1');

    if (!isDevelopment && !isLocalhost) {
      response.status(403).json({ 
        error: "Authentication is disabled and only available in development/localhost" 
      });
      return false;
    }
  }
  return true;
}