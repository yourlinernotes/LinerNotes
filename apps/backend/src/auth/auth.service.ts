import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

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
    // TODO: Implement Google token verification using google-auth-library
    // For now, this is a placeholder that throws an error
    throw new BadRequestException('Google login not yet implemented. Please install and configure google-auth-library.');

    // Future implementation:
    // 1. Verify Google ID token using OAuth2Client from google-auth-library
    // 2. Extract user info (email, name, picture) from verified token
    // 3. Find or create user in database
    // 4. Generate and return JWT token
    //
    // Example code structure:
    // const ticket = await googleClient.verifyIdToken({
    //   idToken,
    //   audience: process.env.GOOGLE_CLIENT_ID,
    // });
    // const payload = ticket.getPayload();
    // const { email, name, picture } = payload;
    //
    // let user = await this.usersService.findByEmail(email);
    // if (!user) {
    //   // Generate unique handle from email
    //   const baseHandle = email.split('@')[0];
    //   let handle = baseHandle;
    //   let counter = 1;
    //   while (await this.usersService.findByHandle(handle).catch(() => null)) {
    //     handle = `${baseHandle}${counter}`;
    //     counter++;
    //   }
    //
    //   user = await this.usersService.create({
    //     email,
    //     name,
    //     displayName: name,
    //     handle,
    //     avatarUrl: picture,
    //   });
    // }
    //
    // const token = this.generateToken(user.id, user.email);
    // return { user, token };
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
