import { bilingualSchema, moneySchema } from './contracts';

describe('bilingualSchema', () => {
  it('should accept one language alone, in either language', () => {
    expect(bilingualSchema.safeParse({ ar: 'قمصان' }).success).toBe(true);
    expect(bilingualSchema.safeParse({ en: 'Shirts' }).success).toBe(true);
  });

  it('should refuse neither language', () => {
    expect(bilingualSchema.safeParse({}).success).toBe(false);
  });

  it('should reject unknown keys rather than strip them', () => {
    expect(
      bilingualSchema.safeParse({ en: 'Shirts', fr: 'Chemises' }).success,
    ).toBe(false);
  });
});

describe('moneySchema', () => {
  it.each(['149.99', '0.00', '12', '99999999.99'])(
    'should accept %s as a string',
    (value) => {
      expect(moneySchema.safeParse(value).success).toBe(true);
    },
  );

  it.each([149.99, '149.999', '-10.00', 'free', ''])(
    'should refuse %s',
    (value) => {
      expect(moneySchema.safeParse(value).success).toBe(false);
    },
  );
});
