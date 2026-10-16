import express from 'express';
import { calculatePrice } from '../src/pricing';
import type { Product } from '../src/types';

const app = express();
const port = Number(process.env.PORT ?? 3001);

app.use(express.json());

app.post('/reprice', (request, response) => {
  if (!Array.isArray(request.body)) {
    response.status(400).json({ error: 'Тело запроса должно быть массивом товаров.' });
    return;
  }

  try {
    const results = (request.body as Product[]).map(calculatePrice);
    response.json(results);
  } catch {
    response.status(400).json({ error: 'Не удалось обработать товары. Проверьте структуру данных.' });
  }
});

app.listen(port, () => {
  console.log(`SaleScout API запущен: http://localhost:${port}`);
});
