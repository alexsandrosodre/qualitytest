import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { AuthService, type LoginResult, type MeResult } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

/** Rate limit mais restrito para endpoints sensíveis (login/refresh/reset). */
const SENSITIVE_ENDPOINT_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle(SENSITIVE_ENDPOINT_THROTTLE)
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Autentica e emite access token + refresh token.' })
  @ApiOkResponse({ description: 'Tokens emitidos e dados básicos do usuário.' })
  login(@Body() dto: LoginDto): Promise<LoginResult> {
    return this.authService.login(dto);
  }

  @Public()
  @Throttle(SENSITIVE_ENDPOINT_THROTTLE)
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotaciona o refresh token e emite novos tokens.' })
  @ApiOkResponse({ description: 'Novos tokens emitidos.' })
  refresh(@Body() dto: RefreshTokenDto): Promise<LoginResult> {
    return this.authService.refresh(dto);
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Revoga o refresh token informado.' })
  @ApiOkResponse({ description: 'Sessão revogada.' })
  logout(@Body() dto: RefreshTokenDto): Promise<{ success: true }> {
    return this.authService.logout(dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Usuário autenticado e seus vínculos ativos por projeto.' })
  @ApiOkResponse({ description: 'Usuário autenticado e projetos com papel.' })
  me(@CurrentUser() user: AuthenticatedUser): Promise<MeResult> {
    return this.authService.me(user);
  }

  @Public()
  @Throttle(SENSITIVE_ENDPOINT_THROTTLE)
  @Post('forgot-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Solicita redefinição de senha (nunca revela se o e-mail existe).' })
  @ApiOkResponse({ description: 'Mensagem genérica.' })
  forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ message: string }> {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Throttle(SENSITIVE_ENDPOINT_THROTTLE)
  @Post('reset-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Redefine a senha via token de uso único.' })
  @ApiOkResponse({ description: 'Senha redefinida e sessões revogadas.' })
  resetPassword(@Body() dto: ResetPasswordDto): Promise<{ success: true }> {
    return this.authService.resetPassword(dto);
  }

  @Post('change-password')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Altera a senha do usuário autenticado e revoga as demais sessões.' })
  @ApiOkResponse({ description: 'Senha alterada.' })
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ success: true }> {
    return this.authService.changePassword(user, dto);
  }
}
