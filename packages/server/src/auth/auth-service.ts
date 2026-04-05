import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const BCRYPT_ROUNDS = 12;
const JWT_EXPIRY = '7d';

export interface TokenPayload {
  username: string;
  iat: number;
  exp: number;
}

export class AuthService {
  constructor(private jwtSecret: string) {}

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  generateToken(username: string): string {
    return jwt.sign({ username }, this.jwtSecret, { expiresIn: JWT_EXPIRY });
  }

  verifyToken(token: string): TokenPayload {
    return jwt.verify(token, this.jwtSecret) as TokenPayload;
  }
}
