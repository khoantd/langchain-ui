import { prismaClient } from "./prisma";

const SYSTEM_USER_EMAIL = "system@langchain-ui.local";

export async function getOrCreateSystemUser() {
  let systemUser = await prismaClient.user.findUnique({
    where: { email: SYSTEM_USER_EMAIL },
  });

  if (!systemUser) {
    systemUser = await prismaClient.user.create({
      data: {
        email: SYSTEM_USER_EMAIL,
        name: "System User",
        id: "system-user",
      },
    });
  }

  return systemUser;
}

export function isAuthEnabled() {
  return process.env.GITHUB_AUTH_ENABLED === "true";
}