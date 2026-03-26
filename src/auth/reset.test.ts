process.env.JWT_SECRET = 'test-secret';
import { register, login, resetPassword } from './auth';
import { AppError } from '../errors';

describe('resetPassword', () => {
  const email = 'test@example.com';
  const password = 'Password123';
  const newPassword = 'NewPassword123';

  it('resets password successfully', () => {
    register(email, password, password);

    expect(() => {
      resetPassword(email, newPassword, newPassword);
    }).not.toThrow();

    const token = login(email, newPassword);
    expect(token).toHaveProperty('userID');
    expect(token).toHaveProperty('token');
  });

  it('throws error if user does not exist', () => {
    expect(() => {
      resetPassword('nouser@example.com', newPassword, newPassword);
    }).toThrow(AppError);
  });

  it('throws error if passwords do not match', () => {
    register('another@example.com', password, password);

    expect(() => {
      resetPassword('another@example.com', newPassword, 'WrongConfirm');
    }).toThrow(AppError);
  });
});