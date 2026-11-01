const copies = {
  ru: {
    title: 'Установить DAYRIS', subtitle: 'Календарь будет открываться с иконки на главном экране.',
    ios: 'Добавь DAYRIS на экран «Домой»', android: 'Установка на Android', desktop: 'Установка на компьютер',
    share: 'Нажми «Поделиться» — квадрат со стрелкой вверх', chromeShare: 'В Chrome нажми «Поделиться» справа от адреса сайта',
    home: 'Прокрути список и выбери «На экран “Домой”»', add: 'Нажми «Добавить». Если есть «Открывать как веб-приложение», включи его',
    menu: 'Открой меню браузера ⋮', install: 'Выбери «Установить приложение» или «Добавить на главный экран»', confirm: 'Подтверди установку — иконка DAYRIS появится среди приложений',
    pcMenu: 'Открой меню Chrome или Edge ⋯', pcInstall: 'Выбери «Установить DAYRIS» в разделе приложений',
    fallback: 'Нет такого пункта? Открой этот сайт в Safari и повтори эти шаги.', embedded: 'Открой этот сайт в Safari на iPhone или в Chrome на Android через меню текущего браузера.',
    done: 'Понятно', close: 'Закрыть', action: 'Установить приложение', how: 'Как установить',
  },
  en: {
    title: 'Install DAYRIS', subtitle: 'Open your calendar from an icon on your Home Screen.',
    ios: 'Add DAYRIS to your Home Screen', android: 'Install on Android', desktop: 'Install on your computer',
    share: 'Tap Share — the square with an upward arrow', chromeShare: 'In Chrome, tap Share beside the website address',
    home: 'Scroll down and choose “Add to Home Screen”', add: 'Tap “Add”. Enable “Open as Web App” if shown',
    menu: 'Open the browser menu ⋮', install: 'Choose “Install app” or “Add to Home screen”', confirm: 'Confirm installation — the DAYRIS icon will appear among your apps',
    pcMenu: 'Open the Chrome or Edge menu ⋯', pcInstall: 'Choose “Install DAYRIS” in the apps section',
    fallback: 'Option missing? Open this website in Safari and follow these steps.', embedded: 'Use the current browser menu to open this website in Safari on iPhone or Chrome on Android.',
    done: 'Got it', close: 'Close', action: 'Install app', how: 'How to install',
  },
  uk: {
    title: 'Установити DAYRIS', subtitle: 'Відкривай календар з іконки на початковому екрані.',
    ios: 'Додай DAYRIS на початковий екран', android: 'Установлення на Android', desktop: 'Установлення на комп’ютер',
    share: 'Натисни «Поділитися» — квадрат зі стрілкою вгору', chromeShare: 'У Chrome натисни «Поділитися» праворуч від адреси сайту',
    home: 'Прокрути список і вибери «На початковий екран»', add: 'Натисни «Додати». Увімкни «Відкривати як вебзастосунок», якщо є',
    menu: 'Відкрий меню браузера ⋮', install: 'Вибери «Установити застосунок» або «Додати на початковий екран»', confirm: 'Підтвердь установлення — іконка DAYRIS з’явиться серед застосунків',
    pcMenu: 'Відкрий меню Chrome або Edge ⋯', pcInstall: 'Вибери «Установити DAYRIS» у розділі застосунків',
    fallback: 'Немає такого пункту? Відкрий сайт у Safari й повтори ці кроки.', embedded: 'Через меню поточного браузера відкрий сайт у Safari на iPhone або Chrome на Android.',
    done: 'Зрозуміло', close: 'Закрити', action: 'Установити застосунок', how: 'Як установити',
  },
  ro: {
    title: 'Instalează DAYRIS', subtitle: 'Deschide calendarul din pictograma de pe ecranul principal.',
    ios: 'Adaugă DAYRIS pe ecranul principal', android: 'Instalare pe Android', desktop: 'Instalare pe computer',
    share: 'Apasă „Distribuie” — pătratul cu săgeata în sus', chromeShare: 'În Chrome, apasă „Distribuie” lângă adresa site-ului',
    home: 'Derulează și alege „Adaugă pe ecranul principal”', add: 'Apasă „Adaugă”. Activează „Deschide ca aplicație web”, dacă apare',
    menu: 'Deschide meniul browserului ⋮', install: 'Alege „Instalează aplicația” sau „Adaugă pe ecranul principal”', confirm: 'Confirmă instalarea — pictograma DAYRIS va apărea printre aplicații',
    pcMenu: 'Deschide meniul Chrome sau Edge ⋯', pcInstall: 'Alege „Instalează DAYRIS” în secțiunea de aplicații',
    fallback: 'Lipsește opțiunea? Deschide site-ul în Safari și urmează acești pași.', embedded: 'Din meniul browserului actual, deschide site-ul în Safari pe iPhone sau Chrome pe Android.',
    done: 'Am înțeles', close: 'Închide', action: 'Instalează aplicația', how: 'Cum se instalează',
  },
  zh: {
    title: '安装 DAYRIS', subtitle: '通过主屏幕上的图标打开日历。',
    ios: '将 DAYRIS 添加到主屏幕', android: '在 Android 上安装', desktop: '在电脑上安装',
    share: '点击分享按钮（带向上箭头的方框）', chromeShare: '在 Chrome 中，点击网址旁的分享按钮',
    home: '向下滚动并选择“添加到主屏幕”', add: '点击“添加”。如有“作为网页 App 打开”，请开启',
    menu: '打开浏览器菜单 ⋮', install: '选择“安装应用”或“添加到主屏幕”', confirm: '确认安装后，DAYRIS 图标将出现在应用中',
    pcMenu: '打开 Chrome 或 Edge 菜单 ⋯', pcInstall: '在应用菜单中选择“安装 DAYRIS”',
    fallback: '找不到选项？请在 Safari 中打开此网站并按上述步骤操作。', embedded: '通过当前浏览器菜单，在 iPhone 上用 Safari 或在 Android 上用 Chrome 打开此网站。',
    done: '知道了', close: '关闭', action: '安装应用', how: '如何安装',
  },
};
export function installGuideCopy(language = 'ru') {
  const key = language === 'md' ? 'ro' : String(language).split('-')[0];
  return copies[key] || copies.ru;
}
