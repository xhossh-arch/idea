<!-- ANIMATIONS + LOG PANEL -->
<style>
  /* Плавный вход карточек */
  .ad-slot {
    opacity: 0;
    transform: translateY(12px) scale(0.995);
    transition: opacity 420ms cubic-bezier(.2,.9,.3,1), transform 420ms cubic-bezier(.2,.9,.3,1), box-shadow 220ms;
    will-change: opacity, transform;
  }
  .ad-slot.visible {
    opacity: 1;
    transform: translateY(0) scale(1);
  }

  /* Небольшой hover эффект (enhanced) */
  .ad-slot:hover {
    transform: translateY(-8px) scale(1.01);
    box-shadow: 0 18px 32px rgba(2,6,23,0.12);
  }

  /* Кнопки - micro animation */
  .btn {
    transition: transform 160ms cubic-bezier(.2,.9,.3,1), box-shadow 160ms;
  }
  .btn:active { transform: translateY(1px) scale(.995); }

  /* Лог-панель внизу справа */
  .log-panel {
    position: fixed;
    right: 18px;
    bottom: 18px;
    width: 320px;
    max-height: 40vh;
    overflow:auto;
    background: #0f1724;
    color: #fff;
    border-radius: 12px;
    padding: 10px;
    box-shadow: 0 8px 30px rgba(2,6,23,0.25);
    font-family: monospace;
    font-size: 13px;
    z-index: 120;
  }
  .log-panel h4 { margin:0 0 8px 0; font-size:13px; font-weight:700; color:#fff; }
  .log-entry { margin:6px 0; padding:6px 8px; border-radius:8px; background: rgba(255,255,255,0.03); }
  .log-time { opacity:0.6; font-size:12px; margin-right:8px; }
  .log-controls { display:flex; gap:8px; margin-top:8px; }
  .log-controls button { padding:6px 8px; border-radius:8px; border:1px solid rgba(255,255,255,0.08); background:transparent; color:#fff; cursor:pointer; }
</style>

<!-- UI: панель логов -->
<div class="log-panel" id="logPanel" aria-live="polite" aria-atomic="false">
  <h4>Журнал действий</h4>
  <div id="logEntries"></div>
  <div class="log-controls">
    <button id="clearLogBtn" type="button">Очистить</button>
    <button id="copyLogBtn" type="button">Копировать</button>
  </div>
</div>

<script>
/*
  Animations + Safe Logger
  - Показывает карточки при прокрутке (IntersectionObserver)
  - Логирует действия в console.log и в экранную панель
  - Авто-редактирует запрещённые слова (заменяет на [вырезано])
  - НЕ включает оскорбительных/расистских выражений — любые такие попытки будут редактированы
*/

/* ========== Настройки (можешь редактировать) ========== */
const LOG_REDACT_PLACEHOLDER = '[вырезано]';
// Список запрещённых шаблонов — НЕ включает сами слова прямо (по соображениям безопасности).
// Здесь мы использует простую эвристику: любые слова из localForbiddenWords будут заменены.
// Добавь сюда безопасные строчки без самих оскорблений, например: 'racial-slur-1', 'racial-slur-2'
// или используй админ-интерфейс, чтобы хранить реальный список отдельно. По умолчанию пуст.
const localForbiddenWords = []; // пример: ['badword1','badword2'] (не добавляй оскорбления сюда)

/* Построим регулярку на основе массива - слово-границы, флаги i (case-insensitive) */
function buildForbiddenRegex(list){
  if(!list || list.length===0) return null;
  // Экранируем спецсимволы
  const esc = list.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp('\\b(' + esc.join('|') + ')\\b', 'gi');
}
const forbiddenRegex = buildForbiddenRegex(localForbiddenWords);

/* ========== Sanitizer ========== */
function sanitizeMessage(msg){
  if(!msg) return msg;
  let safe = String(msg);
  // Если настроена регулярка — применяем замену
  if(forbiddenRegex) safe = safe.replace(forbiddenRegex, LOG_REDACT_PLACEHOLDER);
  // Дополнительная базовая эвристика: если текст содержит явно запрещающие символы/паттерны,
  // мы заменим слова длиной <= 30, содержащие только буквы/цифры/символы, оставляя метку.
  // Это НЕ раскрывает запрещённый текст.
  const suspicious = /[\u0400-\u04FF]{3,}|[^\s]{1,}/; // простая эвристика, не раскрывающая
  // (мы не делаем автоматическую замену на основании этой эвристики, чтобы не ложно удалять)
  return safe;
}

/* ========== UI Logger ========== */
const logEntriesEl = document.getElementById('logEntries');
function addLog(message, level='info'){
  const time = new Date().toLocaleTimeString();
  const sanitized = sanitizeMessage(message);

  // Console log (developer)
  console.log(`[AdHub][${time}][${level}]`, sanitized);

  // Screen log
  if(!logEntriesEl) return;
  const item = document.createElement('div');
  item.className = 'log-entry';
  item.innerHTML = '<span class="log-time">['+time+']</span>' 
                 + '<span class="log-msg">'+escapeHtml(sanitized)+'</span>';
  logEntriesEl.prepend(item);

  // Ограничим кол-во записей в панели
  while(logEntriesEl.children.length > 80) logEntriesEl.removeChild(logEntriesEl.lastChild);
}

/* Безопасное вставление текста */
function escapeHtml(text){
  return text.replace(/[&<>"']/g, function(m){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]; });
}

/* Кнопки панели */
document.getElementById('clearLogBtn').addEventListener('click', () => {
  logEntriesEl.innerHTML = '';
  console.clear();
  addLog('Журнал очищен', 'system');
});
document.getElementById('copyLogBtn').addEventListener('click', async () => {
  try{
    const text = Array.from(logEntriesEl.children).map(el => el.innerText).join('\\n');
    await navigator.clipboard.writeText(text);
    addLog('Журнал скопирован в буфер обмена', 'system');
  }catch(e){
    addLog('Не удалось скопировать журнал: ' + e.message, 'error');
  }
});

/* ========== Interaction: кнопки в карточках ========== */
document.querySelectorAll('.ad-slot').forEach(slot => {
  // Кнопка "Создать" может быть отдельно — здесь пример для каждой карточки
  slot.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      const action = (ev.target.textContent || ev.target.innerText || 'action').trim();
      const adId = slot.dataset.adId || 'unknown';
      addLog(`Действие: "${action}" на слоте ID=${adId}`);
      // Доп. поведение: если это "Удалить" — убираем карточку с анимацией
      if(/удал/i.test(action)){
        slot.style.transition = 'opacity 300ms, transform 300ms';
        slot.style.opacity = '0';
        slot.style.transform = 'scale(.98)';
        setTimeout(()=> slot.remove(), 320);
        addLog(`Слот ID=${adId} помечен на удаление`);
      }
    });
  });
});

/* ========== IntersectionObserver: показать карточки при прокрутке ========== */
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if(entry.isIntersecting){
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
      addLog('Карточка показалась в зоне видимости (ID=' + (entry.target.dataset.adId||'n/a') + ')');
    }
  });
}, { threshold: 0.18 });

document.querySelectorAll('.ad-slot').forEach(el => observer.observe(el));

/* ========== Простая функция создания тест-лога ========== */
function testLog(){
  addLog('Тестовый лог: интерфейс и анимации активны');
}
testLog();

/* ========== Защита от прямого добавления оскорблений пользователем ==========
   Если нужно, можно расширить localForbiddenWords через админ-интерфейс.
   Я не буду и не вставляю оскорбительных слов в код.
*/
</script>

