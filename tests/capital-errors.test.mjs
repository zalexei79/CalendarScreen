import test from 'node:test';
import assert from 'node:assert/strict';
import { friendlyCapitalError } from '../src/features/capital/capitalErrors.js';

const copy = { accountSetup: 'Capital setup incomplete.', proRequired: 'PRO required.' };

test('missing RPC/schema messages become an actionable Capital setup message', () => {
  for (const error of [
    { code: 'PGRST202', message: 'Could not find the function public.capital_create_asset' },
    { code: 'PGRST205', message: 'Could not find the table capital_assets' },
    { message: 'Account not found. The function public.capital_create_asset does not exist' },
  ]) assert.equal(friendlyCapitalError(error, 'en', copy), copy.accountSetup);
});

test('access and transient operation failures are localized without exposing database internals', () => {
  assert.equal(friendlyCapitalError({ message: 'PRO access required' }, 'ru', copy), copy.proRequired);
  assert.match(friendlyCapitalError({ code: '42501', message: 'raw database policy details' }, 'ru', copy), /Проверьте соединение/);
});
