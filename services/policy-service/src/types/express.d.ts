import { UserContext } from '../shared/types/auth.types';

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      organizationId?: string;
      roles?: string[];
      permissions?: string[];
    }
    
    interface Request {
      user?: User;
    }
  }
}

export {};