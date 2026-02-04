// ============================================
// КОНФИГУРАЦИЯ POS KASSIR
// Для проекта: mpwyzefkazbgnastcahd
// ============================================

window.POS_CONFIG = {
  // ┌─────────────────────────────────────────┐
  // │ НАСТРОЙКИ SUPABASE                      │
  // └─────────────────────────────────────────┘
  
  // URL вашего проекта (уже правильный)
  SUPABASE_URL: "https://mpwyzefkazbgnastcahd.supabase.co",
  
  // ⚠️ ЗАМЕНИТЕ на ваш anon public key
  // Где взять: Supabase Dashboard → Settings → API → anon public
  SUPABASE_KEY: "ВСТАВЬТЕ_СЮДА_ВАШ_ANON_PUBLIC_KEY",
  
  // ┌─────────────────────────────────────────┐
  // │ ID КОМПАНИИ                             │
  // └─────────────────────────────────────────┘
  
  // Вариант 1: Используйте этот ID по умолчанию
  COMPANY_ID: "18b94000-046c-476b-a0f9-ab813e57e3d7",
  
  // Вариант 2: Или замените на ID вашей компании из таблицы companies
  // COMPANY_ID: "ваш-company-id-из-базы",
  
  // ┌─────────────────────────────────────────┐
  // │ ПАРОЛЬ АДМИНИСТРАТОРА                   │
  // └─────────────────────────────────────────┘
  
  // Для удаления операций (можете изменить)
  ADMIN_PASSWORD: "admin123"
};

// ============================================
// ИНСТРУКЦИЯ ПО ИСПОЛЬЗОВАНИЮ:
// ============================================
//
// 1. Получите ваш anon public key:
//    - Откройте: https://supabase.com/dashboard/project/mpwyzefkazbgnastcahd
//    - Settings → API
//    - Скопируйте ключ из поля "anon public"
//    - Вставьте выше в SUPABASE_KEY
//
// 2. Сохраните этот файл как config.js
//
// 3. Подключите в index.html и login.html ПЕРЕД app.js:
//    <script src="config.js"></script>
//    <script src="app.js"></script>
//
// 4. Обновите страницу (Ctrl + F5)
//
// ============================================

console.log('✓ Конфигурация загружена');
console.log('📊 URL:', window.POS_CONFIG.SUPABASE_URL);
console.log('🏢 Company ID:', window.POS_CONFIG.COMPANY_ID);
console.log('🔑 Key установлен:', window.POS_CONFIG.SUPABASE_KEY.length > 20 ? 'Да ✓' : 'НЕТ ⚠️ ЗАМЕНИТЕ!');
