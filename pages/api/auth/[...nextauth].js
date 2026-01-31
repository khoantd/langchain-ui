import NextAuth from "next-auth";
import GithubProvider from "next-auth/providers/github";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prismaClient } from "@/lib/prisma";
import { getOrCreateSystemUser } from "@/lib/auth";

const isGitHubAuthEnabled = process.env.GITHUB_AUTH_ENABLED === "true";

const providers = [];
if (isGitHubAuthEnabled) {
  providers.push(
    GithubProvider({
      clientId: process.env.NEXT_PUBLIC_GITHUB_ID,
      clientSecret: process.env.NEXT_PUBLIC_GITHUB_SECRET,
    })
  );
}

export const authOptions = {
  adapter: isGitHubAuthEnabled ? PrismaAdapter(prismaClient) : undefined,
  providers,
  pages: {
    signIn: "/",
    signOut: "/user/logout",
  },
  callbacks: {
    session: async ({ session, token }) => {
      if (!isGitHubAuthEnabled) {
        // Return system user session when auth is disabled
        const systemUser = await getOrCreateSystemUser();
        return {
          ...session,
          user: {
            ...session.user,
            id: systemUser.id,
            email: systemUser.email,
            name: systemUser.name,
          },
        };
      }
      
      if (token?.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
    jwt: async ({ user, token }) => {
      if (user) {
        token.uid = user.id;
      }
      return token;
    },
  },
};

export default NextAuth(authOptions);
