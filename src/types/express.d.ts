// Agrega `req.user` al tipo Request de Express (lo llena el middleware requireAuth).
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: "customer" | "admin" };
    }
  }
}

export {};
