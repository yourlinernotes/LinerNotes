import "next-auth";

declare module "next-auth" {
  /**
   * Extend the default session user
   */
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      handle: string;
      displayName: string;
    };
  }

  interface User {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
    handle?: string;
    displayName?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sub: string;
  }
}
