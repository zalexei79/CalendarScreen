export async function selectBirthday(page, value) {
  const [year, month, day] = value.split('-');
  const fields = page.locator('#life-birthday select');
  await fields.nth(2).selectOption(year);
  await fields.nth(1).selectOption(month);
  await fields.nth(0).selectOption(day);
}
