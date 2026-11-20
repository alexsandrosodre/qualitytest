import { Injectable } from '@nestjs/common';
import { hash as argon2Hash, verify as argon2Verify } from 'argon2';

import { ARGON2_OPTIONS } from './argon2-options';

/** Hash e verificação de senhas com argon2id. Nunca armazena senha em texto puro. */
@Injectable()
export class PasswordService {
  hash(plainPassword: string): Promise<string> {
    return argon2Hash(plainPassword, ARGON2_OPTIONS);
  }

  async verify(passwordHash: string, plainPassword: string): Promise<boolean> {
    try {
      return await argon2Verify(passwordHash, plainPassword);
    } catch {
      return false;
    }
  }
}
