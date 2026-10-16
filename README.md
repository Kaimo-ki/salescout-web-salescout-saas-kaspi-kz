# SaleScout — мини-прайс-бот для Kaspi.kz

Демо SaaS-интерфейса для продавца на Kaspi: Express API рассчитывает новую цену относительно конкурентов, а React-страница показывает старую и новую цену, величину изменения и причину. Для наглядности в интерфейсе есть анимированная визуализация рынка; реальное подключение к Kaspi не входит в тестовое задание.

## Требования

- Node.js 20+
- npm

## Запуск

```bash
npm install
npm run dev
```

Vite откроет фронтенд на `http://localhost:5173`, Express API работает на `http://localhost:3001`. Vite перенаправляет запросы `/reprice` на API. Порт API можно изменить переменной `PORT`.

```bash
npm test       # тесты calculatePrice
npm run build  # проверка TypeScript и production-сборка фронтенда
```

## API

`POST /reprice` принимает массив объектов `Product` и возвращает массив `PriceResult` в исходном порядке. Если тело запроса не является массивом, API отвечает `400`.

```bash
curl -X POST http://localhost:3001/reprice \
  -H "Content-Type: application/json" \
  --data-binary @data/products.json
```

Формат товаров показан в [`data/products.json`](data/products.json). Алгоритм находится в `src/pricing.ts`: берутся только конкуренты в наличии, кандидат округляется вниз до целого тенге и ограничивается `minPrice` и `maxPrice`. При отсутствии конкурентов возвращается `maxPrice`. `myPrice` используется только как `oldPrice`.

В проекте используется несколько директорий по назначению: `src/` — функция расчёта и интерфейс, `server/` — API, `data/` — пример входа.
