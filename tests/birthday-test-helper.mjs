export async function selectBirthday(page, value) {
  const [year, month, day] = value.split('-');
  await page.locator('#life-birthday .birthday-year select').selectOption(year);
  await page.locator('#life-birthday .birthday-month select').selectOption(month);
  await page.locator('#life-birthday .birthday-day select').selectOption(day);
}
