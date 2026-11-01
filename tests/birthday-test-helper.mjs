export async function selectBirthday(page, value) {
  const [year, month, day] = value.split('-');
  const fields = page.locator('#life-birthday select');
  await page.locator('#life-birthday input').fill(year);
  await fields.nth(1).selectOption(month);
  await fields.nth(0).selectOption(day);
}
