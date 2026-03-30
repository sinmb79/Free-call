export interface OtpProvider {
  verify(phone: string, otpCode: string): Promise<boolean>;
}

export class DevOtpProvider implements OtpProvider {
  async verify(_phone: string, otpCode: string): Promise<boolean> {
    return otpCode === "000000";
  }
}
