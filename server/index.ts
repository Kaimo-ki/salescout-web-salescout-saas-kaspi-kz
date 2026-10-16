import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHmac } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Request, type Response, type NextFunction } from 'express';
import { calculatePrice } from '../src/pricing';
import type { PriceResult, Product } from '../src/types';

interface Account {
  id: string;
  name: string;
  storeName: string;
  email: string;
  passwordSalt: string;
  passwordHash: string;
  products: Product[];
  history: Array<{ createdAt: string; results: PriceResult[] }>;
}

interface Database { accounts: Account[] }
interface AuthenticatedRequest extends Request { accountId?: string }

const app = express();
const port = Number(process.env.API_PORT ?? process.env.PORT ?? 3001);
const dataDirectory = path.resolve(process.cwd(), '.data');
const databasePath = path.join(dataDirectory, 'accounts.json');
const authSecret = process.env.AUTH_SECRET ?? 'local-demo-secret-change-before-deploying';

if (process.env.NODE_ENV === 'production' && !process.env.AUTH_SECRET) {
  throw new Error('Set AUTH_SECRET before starting in production.');
}

const starterProducts: Product[] = [
  { sku: 'SM-A556E', name: 'Samsung Galaxy A55 5G, 256 ГБ', myPrice: 214990, minPrice: 199000, maxPrice: 239990, step: 100, competitors: [{ seller: 'SmartPoint', price: 212990, inStock: true }, { seller: 'Gadget City', price: 215000, inStock: true }, { seller: 'Mobile Zone', price: 209990, inStock: false }] },
  { sku: 'XIA-REDMI13', name: 'Xiaomi Redmi Note 13 Pro, 8/256 ГБ', myPrice: 164990, minPrice: 154000, maxPrice: 179990, step: 50, competitors: [{ seller: 'TechnoLife', price: 163500, inStock: true }, { seller: 'KZ Mobile', price: 165000, inStock: true }] },
  { sku: 'APP-IP15-128', name: 'Apple iPhone 15, 128 ГБ, чёрный', myPrice: 389990, minPrice: 379000, maxPrice: 429990, step: 100, competitors: [{ seller: 'iStore KZ', price: 388990, inStock: true }, { seller: 'Apple Room', price: 392000, inStock: true }] },
  { sku: 'SONY-WH1000', name: 'Наушники Sony WH-1000XM5', myPrice: 189990, minPrice: 175000, maxPrice: 209990, step: 250, competitors: [{ seller: 'AudioLab', price: 188990, inStock: true }] },
  { sku: 'DYSON-V15', name: 'Пылесос Dyson V15 Detect Absolute', myPrice: 369990, minPrice: 345000, maxPrice: 399990, step: 100, competitors: [] },
];

async function readDatabase(): Promise<Database> {
  try { return JSON.parse(await readFile(databasePath, 'utf8')) as Database; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return { accounts: [] };
  }
}

async function writeDatabase(database: Database): Promise<void> {
  await mkdir(dataDirectory, { recursive: true });
  const temporaryPath = `${databasePath}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(database, null, 2), 'utf8');
  await rename(temporaryPath, databasePath);
}

function makeToken(accountId: string): string {
  const payload = Buffer.from(JSON.stringify({ sub: accountId, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })).toString('base64url');
  const signature = createHmac('sha256', authSecret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function readToken(token: string): string | null {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = createHmac('sha256', authSecret).update(payload).digest();
  let actual: Buffer;
  try { actual = Buffer.from(signature, 'base64url'); } catch { return null; }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { sub?: string; exp?: number };
    return decoded.sub && decoded.exp && decoded.exp > Date.now() ? decoded.sub : null;
  } catch { return null; }
}

function requireAccount(request: Request, response: Response, next: NextFunction): void {
  const authorization = request.header('authorization') ?? '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  const accountId = readToken(token);
  if (!accountId) { response.status(401).json({ error: 'Войдите в аккаунт, чтобы продолжить.' }); return; }
  (request as AuthenticatedRequest).accountId = accountId;
  next();
}

async function getAccount(request: Request): Promise<{ database: Database; account: Account } | null> {
  const accountId = (request as AuthenticatedRequest).accountId;
  if (!accountId) return null;
  const database = await readDatabase();
  const account = database.accounts.find((item) => item.id === accountId);
  return account ? { database, account } : null;
}

function safeAccount(account: Account) {
  return { id: account.id, name: account.name, storeName: account.storeName, email: account.email };
}

function isProduct(value: unknown): value is Product {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<Product>;
  return typeof item.sku === 'string' && item.sku.trim().length > 0
    && typeof item.name === 'string' && item.name.trim().length > 0
    && [item.myPrice, item.minPrice, item.maxPrice, item.step].every((number) => typeof number === 'number' && Number.isFinite(number) && number >= 0)
    && item.minPrice! <= item.maxPrice!
    && Array.isArray(item.competitors)
    && item.competitors.every((competitor) => typeof competitor.seller === 'string' && typeof competitor.price === 'number' && Number.isFinite(competitor.price) && competitor.price >= 0 && typeof competitor.inStock === 'boolean');
}

app.use(express.json({ limit: '1mb' }));

app.post('/api/auth/register', async (request, response) => {
  const { name, storeName, email, password } = request.body as Record<string, unknown>;
  if (typeof name !== 'string' || !name.trim() || typeof storeName !== 'string' || !storeName.trim()
    || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)
    || typeof password !== 'string' || password.length < 8) {
    response.status(400).json({ error: 'Укажите имя, название магазина, корректную почту и пароль не короче 8 символов.' }); return;
  }
  const database = await readDatabase();
  const normalizedEmail = email.trim().toLowerCase();
  if (database.accounts.some((account) => account.email === normalizedEmail)) {
    response.status(409).json({ error: 'Аккаунт с такой почтой уже зарегистрирован.' }); return;
  }
  const salt = randomBytes(16).toString('hex');
  const account: Account = {
    id: randomUUID(), name: name.trim(), storeName: storeName.trim(), email: normalizedEmail,
    passwordSalt: salt, passwordHash: scryptSync(password, salt, 64).toString('hex'),
    products: structuredClone(starterProducts), history: [],
  };
  database.accounts.push(account);
  await writeDatabase(database);
  response.status(201).json({ token: makeToken(account.id), account: safeAccount(account) });
});

app.post('/api/auth/login', async (request, response) => {
  const { email, password } = request.body as Record<string, unknown>;
  if (typeof email !== 'string' || typeof password !== 'string') { response.status(400).json({ error: 'Введите почту и пароль.' }); return; }
  const database = await readDatabase();
  const account = database.accounts.find((item) => item.email === email.trim().toLowerCase());
  const candidate = account ? scryptSync(password, account.passwordSalt, 64) : Buffer.alloc(64);
  const correct = account && timingSafeEqual(candidate, Buffer.from(account.passwordHash, 'hex'));
  if (!correct || !account) { response.status(401).json({ error: 'Почта или пароль не подошли.' }); return; }
  response.json({ token: makeToken(account.id), account: safeAccount(account) });
});

app.get('/api/account', requireAccount, async (request, response) => {
  const data = await getAccount(request);
  if (!data) { response.status(404).json({ error: 'Аккаунт не найден.' }); return; }
  response.json(safeAccount(data.account));
});

app.patch('/api/account', requireAccount, async (request, response) => {
  const data = await getAccount(request);
  if (!data) { response.status(404).json({ error: 'Аккаунт не найден.' }); return; }
  const { name, storeName } = request.body as Record<string, unknown>;
  if (typeof name !== 'string' || !name.trim() || typeof storeName !== 'string' || !storeName.trim()) {
    response.status(400).json({ error: 'Имя и название магазина не могут быть пустыми.' }); return;
  }
  data.account.name = name.trim(); data.account.storeName = storeName.trim();
  await writeDatabase(data.database);
  response.json(safeAccount(data.account));
});

app.get('/api/products', requireAccount, async (request, response) => {
  const data = await getAccount(request);
  if (!data) { response.status(404).json({ error: 'Аккаунт не найден.' }); return; }
  response.json(data.account.products);
});

app.post('/api/products', requireAccount, async (request, response) => {
  const data = await getAccount(request);
  if (!data) { response.status(404).json({ error: 'Аккаунт не найден.' }); return; }
  if (!isProduct(request.body)) { response.status(400).json({ error: 'Проверьте поля товара и диапазон минимальной/максимальной цены.' }); return; }
  if (data.account.products.some((item) => item.sku.toLowerCase() === request.body.sku.trim().toLowerCase())) {
    response.status(409).json({ error: 'Товар с таким SKU уже есть.' }); return;
  }
  data.account.products.push({ ...request.body, sku: request.body.sku.trim() });
  await writeDatabase(data.database);
  response.status(201).json(data.account.products.at(-1));
});

app.put('/api/products/:sku', requireAccount, async (request, response) => {
  const data = await getAccount(request);
  if (!data) { response.status(404).json({ error: 'Аккаунт не найден.' }); return; }
  if (!isProduct(request.body)) { response.status(400).json({ error: 'Проверьте поля товара и диапазон минимальной/максимальной цены.' }); return; }
  const index = data.account.products.findIndex((item) => item.sku === request.params.sku);
  if (index < 0) { response.status(404).json({ error: 'Товар не найден.' }); return; }
  if (request.body.sku !== request.params.sku && data.account.products.some((item) => item.sku === request.body.sku)) {
    response.status(409).json({ error: 'Товар с таким SKU уже есть.' }); return;
  }
  data.account.products[index] = request.body;
  await writeDatabase(data.database);
  response.json(request.body);
});

app.delete('/api/products/:sku', requireAccount, async (request, response) => {
  const data = await getAccount(request);
  if (!data) { response.status(404).json({ error: 'Аккаунт не найден.' }); return; }
  const before = data.account.products.length;
  data.account.products = data.account.products.filter((item) => item.sku !== request.params.sku);
  if (data.account.products.length === before) { response.status(404).json({ error: 'Товар не найден.' }); return; }
  await writeDatabase(data.database);
  response.status(204).end();
});

app.get('/api/history', requireAccount, async (request, response) => {
  const data = await getAccount(request);
  if (!data) { response.status(404).json({ error: 'Аккаунт не найден.' }); return; }
  response.json(data.account.history);
});

app.post('/api/reprice', requireAccount, async (request, response) => {
  const data = await getAccount(request);
  if (!data) { response.status(404).json({ error: 'Аккаунт не найден.' }); return; }
  const results = data.account.products.map(calculatePrice);
  const resultBySku = new Map(results.map((result) => [result.sku, result]));
  data.account.products = data.account.products.map((product) => ({ ...product, myPrice: resultBySku.get(product.sku)?.newPrice ?? product.myPrice }));
  data.account.history.unshift({ createdAt: new Date().toISOString(), results });
  data.account.history = data.account.history.slice(0, 100);
  await writeDatabase(data.database);
  response.json(results);
});

// Keep the assignment endpoint public: it accepts Product[] and returns PriceResult[].
app.post('/reprice', (request, response) => {
  if (!Array.isArray(request.body) || !request.body.every(isProduct)) {
    response.status(400).json({ error: 'Тело запроса должно быть массивом корректных товаров.' }); return;
  }
  response.json((request.body as Product[]).map(calculatePrice));
});

if (process.env.NODE_ENV === 'production') {
  const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  app.use(express.static(path.join(projectRoot, 'dist')));
  app.get('*', (_request, response) => response.sendFile(path.join(projectRoot, 'dist', 'index.html')));
}

app.listen(port, '0.0.0.0', () => {
  console.log(`SaleScout API запущен: http://localhost:${port}`);
});
