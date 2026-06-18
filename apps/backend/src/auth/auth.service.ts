import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { UsersService } from '../users/users.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {
    // Initialize Google OAuth client with your client ID
    this.googleClient = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID || '985992092131-9e67ajva2nob5efot6bfj1asikhdrdml.apps.googleusercontent.com'
    );
  }

  async signup(signupDto: SignupDto) {
    const { email, password, handle, displayName } = signupDto;

    // Check if user already exists
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Check if handle is taken
    const existingHandle = await this.usersService.findByHandle(handle).catch(() => null);
    if (existingHandle) {
      throw new ConflictException('Handle is already taken');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = await this.usersService.create({
      email,
      passwordHash,
      handle,
      displayName,
      name: displayName, // For NextAuth compatibility
    });

    // Generate JWT token
    const token = this.generateToken(user.id, user.email);

    return {
      user: {
        id: user.id,
        email: user.email,
        handle: user.handle,
        displayName: user.displayName,
      },
      token,
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Validate user credentials
    const user = await this.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Generate JWT token
    const token = this.generateToken(user.id, user.email);

    return {
      user: {
        id: user.id,
        email: user.email,
        handle: user.handle,
        displayName: user.displayName,
      },
      token,
    };
  }

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.passwordHash) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  async googleLogin(idToken: string) {
    try {
      // Verify Google ID token
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID || '985992092131-9e67ajva2nob5efot6bfj1asikhdrdml.apps.googleusercontent.com',
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        throw new UnauthorizedException('Invalid Google token');
      }

      const { email, name, picture } = payload;

      // Find or create user
      let user = await this.usersService.findByEmail(email);

      if (!user) {
        // Generate unique handle from email
        const baseHandle = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
        let handle = baseHandle;
        let counter = 1;

        while (await this.usersService.findByHandle(handle).catch(() => null)) {
          handle = `${baseHandle}${counter}`;
          counter++;
        }

        // Create new user from Google account
        user = await this.usersService.create({
          email,
          name: name || email.split('@')[0],
          displayName: name || email.split('@')[0],
          handle,
          avatarUrl: picture,
          passwordHash: null, // Google users don't have password
        });
      }

      // Generate JWT token
      const token = this.generateToken(user.id, user.email);

      return {
        user: {
          id: user.id,
          email: user.email,
          handle: user.handle,
          displayName: user.displayName,
          name: user.name,
          avatarUrl: user.avatarUrl,
        },
        token,
      };
    } catch (error) {
      console.error('Google login error:', error);
      throw new UnauthorizedException('Failed to authenticate with Google');
    }
  }

  private generateToken(userId: string, email: string): string {
    const payload = { sub: userId, email };
    return this.jwtService.sign(payload);
  }

  async getUserFromToken(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }
}
