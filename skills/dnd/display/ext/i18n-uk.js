/* i18n-uk.js — Ukrainian interface for the display companion.
 *
 * Active when <html data-ui-lang="uk"> (set from the campaign's
 * `ui_language: uk` session flag, the DND_UI_LANG env var, or ?lang=uk).
 *
 * The companion builds most of its chrome in JS, so instead of threading a
 * translation call through thousands of lines this module translates the
 * rendered UI: exact-match strings and a few patterns, applied to text nodes
 * and to placeholder / title / aria-label attributes, and re-applied by a
 * MutationObserver whenever the UI changes. Narration (#text-content) and
 * anything the player types are never touched.
 */
(function () {
  'use strict';
  if (document.documentElement.getAttribute('data-ui-lang') !== 'uk') return;

  var EXACT = {
    // phone controller
    'Move': 'Хід', 'Roll': 'Кидок', 'Sheet': 'Аркуш', 'Map': 'Карта',
    'Enter action or dialogue…': 'Що робить твій герой? Дія або репліка…',
    'Stage': 'Надіслати', 'Skip Turn': 'Пропустити хід', 'Skip': 'Пропустити',
    "Skip this character's turn": 'Пропустити хід цього героя',
    'Everybody': 'Усі', 'Ready': 'Готово', '✓ Ready': '✓ Готово', 'Remove': 'Прибрати',
    '✎ Your move — type your action below': '✎ Твій хід — опиши дію нижче',
    '↑ Sending…': '↑ Надсилаю…',
    '✓ Sent to the DM — sit tight': '✓ Надіслано ведучому — чекай',
    '⟳ The DM is narrating…': '⟳ Ведучий розповідає…',
    '✓ The DM has your move': '✓ Ведучий отримав твій хід',
    '✓ Rolled — waiting for DM': '✓ Кинуто — чекаємо ведучого',
    'Phone Controller': 'Телефон гравця', 'Who are you playing?': 'Кого ти граєш?',
    'Loading party…': 'Завантажую загін…', 'Loading…': 'Завантаження…',
    '← Back to display': '← Назад до екрана',
    'No character bound — open with ?char=<Name>': 'Героя не обрано — відкрий з ?char=<Ім’я>',
    'Awaiting approval…': 'Чекаємо дозволу ведучого…', 'Access denied': 'Доступ заборонено',
    // dice pad
    'Name': 'Ім’я', 'Straight': 'Звичайний', 'Adv ▲': 'Перевага ▲', 'Dis ▼': 'Перешкода ▼',
    'Roll one d20': 'Один d20', 'Roll two d20s, keep higher': 'Два d20, береться більший',
    'Roll two d20s, keep lower': 'Два d20, береться менший',
    'Advantage / disadvantage applies only to d20 rolls.': 'Перевага й перешкода діють лише на d20.',
    'Mod': 'Бонус', 'decrease modifier': 'зменшити бонус', 'increase modifier': 'збільшити бонус',
    'Label (e.g. Stealth) — optional': 'Підпис (напр. Непомітність) — необов’язково',
    'roll failed': 'кидок не вдався', '— request cancelled by DM —': '— ведучий скасував запит —',
    // TV chrome
    'Party Input': 'Дії гравців', 'Party input': 'Дії гравців', 'Party': 'Гравці',
    'Next Turn': 'Наступний хід', 'Dice': 'Кубики', 'Dice roller': 'Кубики',
    'Settings': 'Налаштування', 'Display settings': 'Налаштування екрана', 'Display controls': 'Керування екраном',
    '◈ DM Help': '◈ Підказка', '◈ Thinking…': '◈ Думаю…', '◈ Running…': '◈ Працюю…',
    'Request a DM hint for the current scene': 'Попросити в ведучого підказку до сцени',
    'DM Help requested — thinking…': 'Підказку запитано — ведучий думає…',
    'A hint is already on the way…': 'Підказка вже готується…',
    'DM hint ready ↓': 'Підказка готова ↓',
    'DM Help isn’t available right now': 'Підказка зараз недоступна',
    'Couldn’t reach the server for DM Help': 'Не вдалося зв’язатися із сервером',
    '📱 Phone Mode': '📱 Режим телефона', 'Phone': 'Телефон', '👁 Full Display': '👁 Повний екран',
    'Use this device as a phone input controller': 'Використати цей пристрій як телефон гравця',
    'Switch to full DM display (read narration off this device)': 'Перейти на повний екран ведучого',
    '◀ Hide': '◀ Сховати', '▶ Stats': '▶ Герої', 'Hide ▶': 'Сховати ▶', '◀ Settings': '◀ Налаштування',
    'Toggle character sidebar': 'Показати / сховати героїв', 'Hide the settings column': 'Сховати налаштування',
    'New ↓': 'Нове ↓', 'Jump to newest narration': 'До найновішого',
    'Sound Effects': 'Звуки', 'Sound effects (triggered by narration)': 'Звукові ефекти з розповіді',
    'Narration': 'Довжина розповіді', 'Narration length target in words': 'Довжина розповіді в словах',
    'Narration length the DM targets each turn — shorter = faster turns': 'Скільки слів ведучий пише за хід — коротше = швидше',
    'Type Speed': 'Швидкість тексту', 'Typing speed — click to cycle': 'Швидкість друку — натисни, щоб змінити',
    'Normal': 'Звичайна', 'Fast': 'Швидка', 'Instant': 'Миттєво',
    'Auto Narrate': 'Читати вголос', 'Auto-narrate new blocks in this browser only': 'Автоматично озвучувати на цьому пристрої',
    'Listen to narration': 'Слухати', 'Stop narration': 'Зупинити', 'Select narrator voice': 'Голос оповідача',
    'Theme': 'Тема', 'Dark': 'Темна', 'Light': 'Світла', 'Auto': 'Авто', 'On': 'Увімк.', 'Off': 'Вимк.',
    'Style': 'Стиль', 'Display style': 'Стиль екрана', 'Vellum': 'Пергамент', 'Editorial': 'Журнал', 'Ash': 'Попіл',
    '🗺 Map': '🗺 Карта', 'Voices': 'Голоси',
    // sidebar
    'HP': 'Хіти', 'XP': 'Досвід', 'AC': 'КЗ', 'Spd': 'Швид.', 'HD': 'КХ', 'Init': 'Ініц.',
    'threat': 'загроза', 'active': 'триває', 'resolved': 'виконано', 'failed': 'провалено',
    'Allied': 'Союзники', 'Friendly': 'Дружні', 'Neutral': 'Нейтральні', 'Suspicious': 'Підозріливі', 'Hostile': 'Ворожі',
    // character sheet (markdown headings and labels from the campaign file)
    'Identity': 'Особа', 'Character Pillar': 'Стрижень персонажа', 'Campaign History': 'Історія кампаній',
    'Combat Stats': 'Бій', 'Saving Throws': 'Рятівні кидки', 'Skills': 'Навички',
    'Spell Slots (if applicable)': 'Комірки заклинань', 'Spell Slots': 'Комірки заклинань',
    'Known Spells / Cantrips': 'Заклинання й замовляння', 'Features & Traits': 'Уміння й риси',
    'Equipment & Inventory': 'Спорядження', 'Backstory & Notes': 'Передісторія й нотатки',
    'Player:': 'Гравець:', 'Campaign:': 'Кампанія:', 'Last Updated:': 'Оновлено:',
    'Race:': 'Раса:', 'Class:': 'Клас:', 'Level:': 'Рівень:', 'Background:': 'Передісторія:',
    'Alignment:': 'Світогляд:', 'XP:': 'Досвід:', "Player's sentence:": 'Слова гравця:',
    'Derived pillar:': 'Стрижень:', 'Active hooks:': 'Зачіпки:', 'Origin campaign:': 'Перша кампанія:',
    'Previous campaigns:': 'Попередні кампанії:', 'HP:': 'Хіти:', 'Temp HP:': 'Тимч. хіти:', 'AC:': 'КЗ:',
    'Initiative:': 'Ініціатива:', 'Speed:': 'Швидкість:', 'Hit Dice:': 'Кістки хітів:', 'Death Saves:': 'Рятівні від смерті:',
    'Weapons:': 'Зброя:', 'Armour:': 'Обладунок:', 'Adventuring Gear:': 'Спорядження:', 'Currency:': 'Гроші:',
    'STR': 'СИЛ', 'DEX': 'СПР', 'CON': 'СТА', 'INT': 'ІНТ', 'WIS': 'МУД', 'CHA': 'ХАР',
    'Skill': 'Навичка', 'Ability': 'Характ.', 'Bonus': 'Бонус', 'Proficient': 'Майст.',
    'Attack Bonus': 'Атака', 'Damage': 'Шкода', 'Type': 'Тип', 'Notes': 'Примітки',
    'Level': 'Рівень', 'Total': 'Усього', 'Used': 'Витрачено',
    'Roll on screen': 'Кидати на екрані',
    'Open the dice roller on this screen when the DM calls for a roll (for games without phones)': 'Відкривати кубики на цьому екрані, коли ведучий просить кидок (для гри без телефонів)',
    'Text Size': 'Розмір тексту', 'Reading text size — font size, not page zoom': 'Розмір шрифту для читання',
    'Smaller text': 'Менший текст', 'Bigger text': 'Більший текст',
    'Rolls': 'Кидки', 'Players': 'Гравці кидають', 'Close': 'Закрити', 'Close (Esc)': 'Закрити (Esc)',
    'New device requesting input access': 'Новий пристрій просить доступ', 'Approve': 'Дозволити', 'Deny': 'Відхилити',
    'Factions': 'Фракції', 'Quests': 'Завдання', 'Round': 'Раунд',
    'Warning': 'Увага', 'Milestone': 'Віха',
    // character sheet
    'Ability Scores': 'Характеристики', 'Cantrips': 'Замовляння', 'Prepared': 'Підготовлено',
    'Relationships': 'Стосунки', 'Inspiration': 'Натхнення', '✦ Inspiration': '✦ Натхнення',
    'Temp HP': 'Тимч. хіти', 'Speed': 'Швидкість', 'Hit Dice': 'Кістки хітів', 'Init': 'Ініц.',
    'Attacks': 'Атаки', 'Features': 'Уміння', 'Inventory': 'Інвентар', 'Spells': 'Заклинання',
    'Full sheet not loaded — run /dnd load to restore.': 'Аркуш ще не завантажено — ведучий має виконати /dnd load.',
    // scenes
    '— The Inn —': '— Таверна —', 'The Inn': 'Таверна', 'The Dungeon': 'Підземелля', 'The Mine': 'Шахта',
    'The Cavern': 'Печера', 'The Forest': 'Ліс', 'The Castle': 'Замок', 'The Mountains': 'Гори',
    'The Sea': 'Море', 'The Desert': 'Пустеля', 'The Ruins': 'Руїни', 'The Swamp': 'Болото',
    'The Crypt': 'Склеп', 'The Fire': 'Вогонь', 'The Arcane': 'Магія', 'The Town': 'Місто',
    'The Night': 'Ніч', 'The Temple': 'Храм'
  };

  var PATTERNS = [
    [/^— (The [A-Za-z ]+) —$/, function (m, a) { return EXACT[a] ? '— ' + EXACT[a] + ' —' : null; }],
    [/^Waiting on: (.+)$/, 'Чекаємо на: $1'],
    [/^\+(\d+) temp$/, '+$1 тимч.'],
    [/^⏳ Queued — fires on DM Enter$/, '⏳ У черзі — піде, коли ведучий натисне Enter'],
    [/^Queued — fires on DM Enter$/, 'У черзі — піде, коли ведучий натисне Enter'],
    [/^Loading (.+)…$/, 'Завантажую $1…'],
    [/^XP\s+(.+)$/, 'Досвід $1'],
    [/^Retrying \((\d+)\)…$/, 'Повторюю ($1)…'],
    [/^Network error — (.*)$/, 'Помилка мережі — $1'],
    [/^Could not load sheet \((\d+)\)$/, 'Не вдалося завантажити аркуш ($1)'],
    [/^Display theme — (.*)$/, 'Тема екрана — $1'],
    [/^No sheet found for '(.+)' in campaign '(.*)'$/, 'Аркуш «$1» не знайдено']
  ];

  var SKIP = '#text-content, textarea, input, script, style, svg';
  var ATTRS = ['placeholder', 'title', 'aria-label'];

  function tr(s) {
    if (!s) return null;
    var lead = s.match(/^\s*/)[0], trail = s.match(/\s*$/)[0], core = s.trim();
    if (!core) return null;
    if (Object.prototype.hasOwnProperty.call(EXACT, core)) return lead + EXACT[core] + trail;
    for (var i = 0; i < PATTERNS.length; i++) {
      var p = PATTERNS[i], m = core.match(p[0]);
      if (!m) continue;
      var out = typeof p[1] === 'function' ? p[1].apply(null, m) : core.replace(p[0], p[1]);
      if (out != null && out !== core) return lead + out + trail;
    }
    return null;
  }

  function skip(el) { return !el || (el.closest && el.closest(SKIP)); }

  function doText(node) {
    if (skip(node.parentElement)) return;
    var v = tr(node.nodeValue);
    if (v != null && v !== node.nodeValue) node.nodeValue = v;
  }
  function doAttrs(el) {
    if (el.closest && el.closest('#text-content, svg')) return;
    for (var i = 0; i < ATTRS.length; i++) {
      var a = el.getAttribute && el.getAttribute(ATTRS[i]);
      if (!a) continue;
      var v = tr(a);
      if (v != null && v !== a) el.setAttribute(ATTRS[i], v);
    }
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1) return;
    doAttrs(root);
    if (skip(root)) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null);
    var n;
    while ((n = w.nextNode())) {
      if (n.nodeType === 3) doText(n); else doAttrs(n);
    }
  }

  function start() {
    walk(document.body);
    new MutationObserver(function (list) {
      for (var i = 0; i < list.length; i++) {
        var r = list[i];
        if (r.type === 'characterData') doText(r.target);
        else if (r.type === 'attributes') doAttrs(r.target);
        else for (var j = 0; j < r.addedNodes.length; j++) walk(r.addedNodes[j]);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.DndT = tr;
})();
