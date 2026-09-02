import type { AuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import type { Role } from "./domain";

export const authOptions: AuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Пароль", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        const user = await prisma.user.findUnique({ where: { email: credentials.email } });
        if (!user) return null;
        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      return session;
    },
  },
};

export interface SessionUser {
  id: string;
  role: Role;
  name: string;
  email: string;
}

/** Текущий пользователь для server actions / route handlers. Бросает при отсутствии сессии. */
export async function requireUser(): Promise<SessionUser> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Не выполнен вход");
  return {
    id: session.user.id,
    role: session.user.role as Role,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
  };
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    role: session.user.role as Role,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
  };
}
