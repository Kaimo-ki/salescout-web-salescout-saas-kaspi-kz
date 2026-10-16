import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Activity, ArrowDownRight, ArrowRight, Bell, ChevronDown, CircleHelp, LayoutDashboard, LogOut, Package, Plus, RefreshCw, Search, Settings2, ShieldCheck, Store, Target, Trash2, TrendingDown, X, Pencil, Zap } from 'lucide-react';
import AuthPage, { type AccountInfo } from './AuthPage';
import { apiRequest } from './api';
import type { PriceResult, Product, Reason } from './types';

type View = 'overview' | 'products' | 'competitors' | 'analytics' | 'settings' | 'support';
type Filter = 'all' | 'changed' | 'setup';
interface HistoryEntry { createdAt: string; results: PriceResult[] }
interface Session { token: string; account: AccountInfo }

const tokenKey = 'salescout.session';
const reasonText: Record<Reason, string> = { UNDERCUT: 'На шаг ниже конкурента', AT_MIN: 'Минимальная цена', AT_MAX: 'Максимальная цена', NO_COMPETITORS: 'Нет конкурентов' };
const money = (value: number) => `${new Intl.NumberFormat('ru-RU').format(value)} ₸`;

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem(tokenKey);
    if (!raw) { setCheckingSession(false); return; }
    try {
      const saved = JSON.parse(raw) as Session;
      apiRequest<AccountInfo>('/api/account', saved.token).then((account) => setSession({ token: saved.token, account })).catch(() => localStorage.removeItem(tokenKey)).finally(() => setCheckingSession(false));
    } catch { localStorage.removeItem(tokenKey); setCheckingSession(false); }
  }, []);

  const authenticate = (nextSession: Session) => { localStorage.setItem(tokenKey, JSON.stringify(nextSession)); setSession(nextSession); };
  const logout = () => { localStorage.removeItem(tokenKey); setSession(null); };

  if (checkingSession) return <div className="screen-loading"><span className="kaspi-logo">K</span><span>Открываем SaleScout…</span></div>;
  if (!session) return <AuthPage onAuthenticated={authenticate} />;
  return <Dashboard session={session} onAccountChange={(account) => { const updated = { ...session, account }; localStorage.setItem(tokenKey, JSON.stringify(updated)); setSession(updated); }} onLogout={logout} />;
}

function Dashboard({ session, onAccountChange, onLogout }: { session: Session; onAccountChange: (account: AccountInfo) => void; onLogout: () => void }) {
  const { token } = session;
  const [view, setView] = useState<View>('overview');
  const [products, setProducts] = useState<Product[]>([]);
  const [results, setResults] = useState<PriceResult[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [editor, setEditor] = useState<Product | 'new' | null>(null);
  const [toast, setToast] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 3200); };
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [nextProducts, nextHistory] = await Promise.all([
        apiRequest<Product[]>('/api/products', token),
        apiRequest<HistoryEntry[]>('/api/history', token),
      ]);
      setProducts(nextProducts); setHistory(nextHistory);
      setResults(nextHistory[0]?.results ?? []);
    } catch (error) { notify(error instanceof Error ? error.message : 'Не удалось загрузить товары.'); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { void loadData(); }, [loadData]);

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesQuery = !query || `${product.name} ${product.sku}`.toLowerCase().includes(query);
      const result = results.find((item) => item.sku === product.sku);
      const matchesFilter = filter === 'all' || (filter === 'changed' && !!result && result.oldPrice !== result.newPrice) || (filter === 'setup' && product.competitors.length === 0);
      return matchesQuery && matchesFilter;
    });
  }, [products, results, search, filter]);

  const changedCount = results.filter((result) => result.oldPrice !== result.newPrice).length;
  const averageDrop = changedCount ? Math.round(results.reduce((sum, result) => sum + Math.max(0, result.oldPrice - result.newPrice), 0) / changedCount) : 0;

  async function reprice() {
    setSaving(true);
    try {
      const nextResults = await apiRequest<PriceResult[]>('/api/reprice', token, { method: 'POST', body: '{}' });
      setResults(nextResults);
      await loadData();
      notify('Цены пересчитаны и сохранены в демо-магазине.');
    } catch (error) { notify(error instanceof Error ? error.message : 'Не удалось пересчитать цены.'); }
    finally { setSaving(false); }
  }

  async function saveProduct(product: Product, previousSku?: string) {
    setSaving(true);
    try {
      const saved = await apiRequest<Product>(previousSku ? `/api/products/${encodeURIComponent(previousSku)}` : '/api/products', token, {
        method: previousSku ? 'PUT' : 'POST', body: JSON.stringify(product),
      });
      setProducts((current) => previousSku ? current.map((item) => item.sku === previousSku ? saved : item) : [...current, saved]);
      setResults([]); setEditor(null); notify(previousSku ? 'Товар обновлён.' : 'Товар добавлен.');
    } catch (error) { notify(error instanceof Error ? error.message : 'Не удалось сохранить товар.'); }
    finally { setSaving(false); }
  }

  async function deleteProduct(product: Product) {
    if (!window.confirm(`Удалить «${product.name}» из демо-магазина?`)) return;
    try {
      await apiRequest<void>(`/api/products/${encodeURIComponent(product.sku)}`, token, { method: 'DELETE' });
      setProducts((current) => current.filter((item) => item.sku !== product.sku));
      setResults((current) => current.filter((item) => item.sku !== product.sku));
      notify('Товар удалён.');
    } catch (error) { notify(error instanceof Error ? error.message : 'Не удалось удалить товар.'); }
  }

  async function saveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true);
    const form = new FormData(event.currentTarget);
    try {
      const account = await apiRequest<AccountInfo>('/api/account', token, { method: 'PATCH', body: JSON.stringify({ name: form.get('name'), storeName: form.get('storeName') }) });
      onAccountChange(account); notify('Настройки аккаунта сохранены.');
    } catch (error) { notify(error instanceof Error ? error.message : 'Не удалось сохранить настройки.'); }
    finally { setSaving(false); }
  }

  const navItems: Array<{ id: View; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'overview', label: 'Обзор', icon: LayoutDashboard }, { id: 'products', label: 'Мои товары', icon: Package },
    { id: 'competitors', label: 'Конкуренты', icon: Target }, { id: 'analytics', label: 'Аналитика', icon: Activity },
  ];
  const viewTitle: Record<View, string> = { overview: 'Обзор', products: 'Мои товары', competitors: 'Конкуренты', analytics: 'Аналитика', settings: 'Настройки', support: 'Поддержка' };

  return <div className="app-shell">
    <aside className="sidebar">
      <button className="brand" onClick={() => setView('overview')}><span className="kaspi-logo">K</span><span>SaleScout</span><span className="brand-beta">ДЕМО</span></button>
      <div className="workspace"><div className="workspace-icon"><Store size={17} /></div><div><strong>{session.account.storeName}</strong><small>Демо-магазин Kaspi</small></div><ChevronDown size={15} /></div>
      <div className="nav-label">РАБОЧЕЕ ПРОСТРАНСТВО</div>
      <nav>{navItems.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${view === id ? 'active' : ''}`} onClick={() => setView(id)}><Icon size={17} />{label}{id === 'products' && <span className="nav-count">{products.length}</span>}</button>)}</nav>
      <div className="sidebar-bottom">
        <div className="plan-card"><div className="plan-top"><span>ДЕМО-ПРОФИЛЬ</span><span className="plan-live">АКТИВЕН</span></div><div className="plan-bar"><i style={{ width: `${Math.min(products.length / 20 * 100, 100)}%` }} /></div><div className="plan-usage"><span>Товары</span><b>{products.length} <em>/ 20</em></b></div><button onClick={() => notify('Тарифы появятся после подключения настоящего сервиса.')}>О тарифах <ArrowRight size={14} /></button></div>
        <button className={`nav-item muted ${view === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')}><Settings2 size={17} />Настройки</button>
        <button className={`nav-item muted ${view === 'support' ? 'active' : ''}`} onClick={() => setView('support')}><CircleHelp size={17} />Поддержка</button>
        <div className="profile"><div className="avatar">{initials(session.account.name)}</div><div><strong>{session.account.name}</strong><small>{session.account.email}</small></div><button className="logout-button" title="Выйти" onClick={onLogout}><LogOut size={15} /></button></div>
      </div>
    </aside>

    <main className="main-content">
      <header className="topbar"><div className="breadcrumb">{session.account.storeName} <span>/</span> <b>{viewTitle[view]}</b></div><div className="top-actions"><div className="market-pill"><span className="kaspi-mark">K</span>Kaspi Магазин <span className="demo-indicator">ДЕМО</span></div><button className="icon-button" title="Уведомления" onClick={() => notify('Новых уведомлений пока нет.')}><Bell size={17} /></button><button className="top-avatar" title="Выйти" onClick={onLogout}>{initials(session.account.name)}</button></div></header>

      {view === 'overview' && <>
        <section className="hero"><div className="hero-copy"><div className="eyebrow"><span className="live-pulse" />PRICE INTELLIGENCE <span className="eyebrow-line" /> ДЕМО-РЕЖИМ</div><h1>Ваши цены.<br /><span>Всегда под контролем.</span></h1><p>Следите за ценами конкурентов, пересчитывайте свои предложения и защищайте минимальную цену.</p><div className="hero-actions"><button className="primary-button" onClick={() => void reprice()} disabled={saving || loading}>{saving ? <RefreshCw size={16} className="spin" /> : <Zap size={16} />}{saving ? 'Пересчитываем…' : 'Пересчитать цены'}<ArrowRight size={15} /></button><div className="sync-note"><span className="sync-check">✓</span>Минимальная цена защищена</div></div></div><div className="hero-visual" aria-label="Анимированная сфера SaleScout"><div className="hero-red-orbit orbit-one" /><div className="hero-red-orbit orbit-two" /><div className="hero-globe" role="img" aria-label="Глобус с меридианами и континентами"><span className="globe-shine" /><span className="globe-land land-one" /><span className="globe-land land-two" /><span className="globe-land land-three" /><span className="globe-line meridian meridian-one" /><span className="globe-line meridian meridian-two" /><span className="globe-line latitude latitude-one" /><span className="globe-line latitude latitude-two" /></div><div className="hero-float hero-float-one"><TrendingDown size={15} /><span>Позиция магазина<strong>#1 в категории</strong></span></div><div className="hero-float hero-float-two"><ShieldCheck size={15} /><span>Цена под защитой<strong>Минимум соблюдён</strong></span></div></div><div className="hero-index">01 <span>/</span> PRICE CONTROL</div></section>
        <section className="stats-grid"><StatCard label="ТОВАРЫ В МАГАЗИНЕ" value={String(products.length).padStart(2, '0')} sub="Демо-каталог" icon={<Package size={16} />} /><StatCard label="ПОСЛЕДНИЙ ПЕРЕСЧЁТ" value={history[0] ? dateTime(history[0].createdAt) : '—'} sub={history.length ? `${history.length} запуск(а) сохранено` : 'Ещё не запускался'} icon={<RefreshCw size={15} />} /><StatCard label="ЦЕНЫ ИЗМЕНЕНЫ" value={String(changedCount).padStart(2, '0')} sub={changedCount ? `Среднее изменение ${money(averageDrop)}` : 'После пересчёта появятся итоги'} icon={<ArrowDownRight size={16} />} /><StatCard label="ЗАЩИТА МИНИМУМА" value="Активна" sub="Ниже minPrice алгоритм не опустится" icon={<ShieldCheck size={16} />} red /> </section>
        <ProductSection products={visibleProducts.slice(0, 6)} results={results} search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} changedCount={changedCount} onAdd={() => setEditor('new')} onEdit={setEditor} onDelete={(product) => void deleteProduct(product)} onViewAll={() => setView('products')} loading={loading} />
        <div className="demo-note"><ShieldCheck size={15} />Демо-режим: пересчёт изменяет цены только внутри этого аккаунта, Kaspi не подключён.</div>
      </>}

      {view === 'products' && <><PageHeading kicker="КАТАЛОГ" title="Мои товары" description="Добавляйте и редактируйте позиции демо-магазина." action={<button className="primary-button" onClick={() => setEditor('new')}><Plus size={16} />Добавить товар</button>} /><ProductSection products={visibleProducts} results={results} search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} changedCount={changedCount} onAdd={() => setEditor('new')} onEdit={setEditor} onDelete={(product) => void deleteProduct(product)} onViewAll={() => setFilter('all')} loading={loading} /></>}

      {view === 'competitors' && <><PageHeading kicker="МОНИТОРИНГ" title="Цены конкурентов" description="Конкуренты и наличие, сохранённые для каждого демо-товара." action={<button className="secondary-button" onClick={() => setView('products')}><Package size={15} />Управлять товарами</button>} /><div className="content-card"><div className="competitor-list">{products.map((product) => <article className="competitor-product" key={product.sku}><div className="competitor-product-head"><div><strong>{product.name}</strong><small>SKU: {product.sku}</small></div><button className="text-button" onClick={() => setEditor(product)}><Pencil size={14} />Изменить</button></div>{product.competitors.length ? <div className="competitor-rows">{product.competitors.map((competitor, index) => <div className="competitor-row" key={`${product.sku}-${index}`}><span className={`stock-dot ${competitor.inStock ? 'in-stock' : ''}`} />{competitor.seller}<strong>{money(competitor.price)}</strong><em>{competitor.inStock ? 'В наличии' : 'Нет в наличии'}</em></div>)}</div> : <div className="empty-inline">Конкуренты не добавлены. Добавьте их в карточке товара.</div>}</article>)}</div></div></>}

      {view === 'analytics' && <><PageHeading kicker="ОТЧЁТЫ" title="История пересчётов" description="Сохранённые результаты работы алгоритма по вашему демо-каталогу." action={<button className="primary-button" onClick={() => void reprice()} disabled={saving}><RefreshCw size={15} />Пересчитать сейчас</button>} /><div className="stats-grid analytics-stats"><StatCard label="ЗАПУСКОВ" value={String(history.length)} sub="История хранится в аккаунте" icon={<Activity size={16} />} /><StatCard label="ИЗМЕНЕНИЙ В ПОСЛЕДНЕМ ЗАПУСКЕ" value={String(changedCount)} sub="По сохранённому результату" icon={<TrendingDown size={16} />} /><StatCard label="СРЕДНЕЕ СНИЖЕНИЕ" value={changedCount ? money(averageDrop) : '—'} sub="Среди изменённых товаров" icon={<ArrowDownRight size={16} />} red /><StatCard label="ТОВАРОВ" value={String(products.length)} sub="В текущем каталоге" icon={<Package size={16} />} /></div><div className="content-card history-card"><div className="card-title"><div><span className="section-kicker">ЖУРНАЛ СОБЫТИЙ</span><h2>Запуски репрайсера</h2></div></div>{history.length ? history.map((entry, index) => <details className="history-entry" key={entry.createdAt} open={index === 0}><summary><span>{dateTime(entry.createdAt)}</span><b>{entry.results.filter((item) => item.oldPrice !== item.newPrice).length} цен изменено</b><span>{entry.results.length} товаров</span><ChevronDown size={16} /></summary><div className="history-results">{entry.results.map((result) => <div key={`${entry.createdAt}-${result.sku}`}><span>{result.sku}</span><span>{money(result.oldPrice)} → <b>{money(result.newPrice)}</b></span><em>{reasonText[result.reason]}</em></div>)}</div></details>) : <div className="empty-block"><Activity size={24} /><strong>Пересчётов пока нет</strong><span>Запустите пересчёт, чтобы сохранить первый результат.</span><button className="primary-button" onClick={() => void reprice()}><Zap size={15} />Пересчитать цены</button></div>}</div></>}

      {view === 'settings' && <><PageHeading kicker="АККАУНТ" title="Настройки магазина" description="Данные профиля и название вашего демо-магазина." /><form className="settings-card" onSubmit={(event) => void saveAccount(event)}><div className="settings-card-heading"><span className="settings-icon"><Store size={19} /></span><div><h2>Профиль продавца</h2><p>Эти данные используются в вашем рабочем пространстве.</p></div></div><label>Ваше имя<input name="name" defaultValue={session.account.name} required /></label><label>Название магазина<input name="storeName" defaultValue={session.account.storeName} required /></label><label>Электронная почта<input value={session.account.email} readOnly /><small>Для смены почты потребуется восстановление аккаунта.</small></label><div className="settings-warning"><ShieldCheck size={16} />Пароль хранится на сервере в хешированном виде. Смена пароля появится в следующем этапе.</div><button className="primary-button" disabled={saving}>{saving ? 'Сохраняем…' : 'Сохранить настройки'}<ArrowRight size={15} /></button></form></>}

      {view === 'support' && <><PageHeading kicker="ПОМОЩЬ" title="Поддержка и вопросы" description="Ответы о демо-версии SaleScout и её возможностях." /><div className="support-layout"><div className="content-card faq-card"><span className="section-kicker">ЧАСТЫЕ ВОПРОСЫ</span>{['Это подключено к настоящему Kaspi?', 'Как работает пересчёт цены?', 'Где хранятся мои товары?', 'Как удалить аккаунт?'].map((question, index) => <div className="faq-item" key={question}><button onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}><span>{question}</span><ChevronDown size={17} className={expandedFaq === index ? 'faq-open' : ''} /></button>{expandedFaq === index && <p>{['Нет. Это демонстрационная версия с тестовыми товарами и конкурентами. Она ничего не меняет в настоящем магазине Kaspi.', 'Сервер берёт наименьшую цену конкурента в наличии, вычитает шаг и ограничивает результат минимальной и максимальной ценой товара.', 'Данные аккаунта сохраняются локально на сервере проекта в файле .data/accounts.json. Это прототип, для публикации понадобится постоянная база данных.', 'В демо удалите товары и аккаунт можно сбросить, удалив файл .data/accounts.json после остановки сервера.'][index]}</p>}</div>)}</div><div className="support-contact"><span className="support-icon"><CircleHelp size={22} /></span><h2>Нужна помощь?</h2><p>Напиши, что именно не получается, и мы разберём это вместе.</p><button className="secondary-button" onClick={() => notify('Ты можешь написать вопрос прямо в этом чате.')}>Задать вопрос <ArrowRight size={15} /></button></div></div></>}

      <footer><span>© 2026 SaleScout</span><span>DEMO · PRICE INTELLIGENCE FOR KASPI SELLERS</span><button onClick={() => setView('support')}>Помощь <ArrowRight size={13} /></button></footer>
    </main>
    {editor && <ProductEditor product={editor === 'new' ? null : editor} busy={saving} onClose={() => setEditor(null)} onSave={(product) => void saveProduct(product, editor === 'new' ? undefined : editor.sku)} />}
    {toast && <div className="toast" role="status">{toast}<button onClick={() => setToast('')} aria-label="Закрыть"><X size={15} /></button></div>}
  </div>;
}

function ProductSection({ products, results, search, setSearch, filter, setFilter, changedCount, onAdd, onEdit, onDelete, onViewAll, loading }: {
  products: Product[]; results: PriceResult[]; search: string; setSearch: (value: string) => void; filter: Filter; setFilter: (value: Filter) => void;
  changedCount: number; onAdd: () => void; onEdit: (product: Product) => void; onDelete: (product: Product) => void; onViewAll: () => void; loading: boolean;
}) {
  const resultFor = (sku: string) => results.find((result) => result.sku === sku);
  return <section className="products-section"><div className="section-heading"><div><div className="section-kicker">МОНИТОРИНГ <span>·</span> {products.length} ПОЗИЦИЙ</div><h2>Ваши товары</h2><p>Управляйте каталогом и настройками минимальной цены.</p></div><div className="heading-actions"><button className="secondary-button" onClick={onAdd}><Plus size={15} />Добавить товар</button></div></div>
    <div className="table-card"><div className="table-toolbar"><div className="table-tabs"><button className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>Все товары <span>{products.length}</span></button><button className={filter === 'changed' ? 'selected' : ''} onClick={() => setFilter('changed')}>Изменена цена <span>{changedCount}</span></button><button className={filter === 'setup' ? 'selected' : ''} onClick={() => setFilter('setup')}>Нужны конкуренты</button></div><label className="search-box"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Найти товар или SKU" /></label></div>
      <div className="table-wrap"><table><thead><tr><th className="product-col">ТОВАР</th><th>КОНКУРЕНТЫ</th><th>БЫЛО</th><th>СТАЛО</th><th>ПРИЧИНА</th><th>ДЕЙСТВИЯ</th></tr></thead><tbody>{products.map((product, index) => { const result = resultFor(product.sku); const current = product.myPrice; return <tr key={product.sku}><td><div className="product-cell"><div className={`product-thumb thumb-${index % 5}`}><span>{['◉', '◈', '▣', '◖', '✳'][index % 5]}</span></div><div><strong>{product.name}</strong><small>SKU: {product.sku}</small></div></div></td><td><div className="competitor-cell"><strong>{product.competitors.filter((item) => item.inStock).length || '—'}</strong><span>в наличии</span></div></td><td><span className="old-price">{money(result?.oldPrice ?? current)}</span></td><td><div className="new-price-cell"><strong>{money(result?.newPrice ?? current)}</strong>{result && result.oldPrice !== result.newPrice && <span><ArrowDownRight size={12} />{money(Math.abs(result.oldPrice - result.newPrice))}</span>}</div></td><td><span className={`reason-pill ${result ? `reason-${result.reason.toLowerCase()}` : ''}`}>{result ? reasonText[result.reason] : 'Не пересчитано'}</span></td><td><div className="row-actions"><button title="Редактировать" onClick={() => onEdit(product)}><Pencil size={14} /></button><button title="Удалить" onClick={() => onDelete(product)}><Trash2 size={14} /></button></div></td></tr>; })}</tbody></table>{loading ? <div className="empty-state">Загружаем товары…</div> : products.length === 0 && <div className="empty-state"><Package size={22} /><span>{search || filter !== 'all' ? 'Подходящих товаров нет.' : 'Каталог пока пуст.'}</span>{!search && <button className="text-button" onClick={onAdd}><Plus size={14} />Добавить первый товар</button>}</div>}</div>
      <div className="table-footer"><span>Показано <b>{products.length}</b> товаров</span><span className="table-footer-note">Изменения сохранены в демо-аккаунте</span><button className="view-all" onClick={onViewAll}>Открыть раздел <ArrowRight size={14} /></button></div>
    </div>
  </section>;
}

function ProductEditor({ product, busy, onClose, onSave }: { product: Product | null; busy: boolean; onClose: () => void; onSave: (product: Product) => void }) {
  const [error, setError] = useState('');
  const [competitorsText, setCompetitorsText] = useState(product?.competitors.map((item) => `${item.seller} | ${item.price} | ${item.inStock ? 'да' : 'нет'}`).join('\n') ?? '');
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const form = new FormData(event.currentTarget);
    const minPrice = Number(form.get('minPrice')); const maxPrice = Number(form.get('maxPrice'));
    if (minPrice > maxPrice) { setError('Минимальная цена не может быть выше максимальной.'); return; }
    const competitors: Product['competitors'] = [];
    for (const line of competitorsText.split('\n').map((item) => item.trim()).filter(Boolean)) {
      const [seller, priceRaw, stockRaw] = line.split('|').map((item) => item.trim());
      const price = Number(priceRaw);
      if (!seller || !Number.isFinite(price) || price < 0 || !['да', 'нет'].includes((stockRaw ?? '').toLowerCase())) { setError(`Проверь строку конкурента: «${line}». Формат: магазин | цена | да/нет`); return; }
      competitors.push({ seller, price, inStock: stockRaw.toLowerCase() === 'да' });
    }
    onSave({ sku: String(form.get('sku')).trim(), name: String(form.get('name')).trim(), myPrice: Number(form.get('myPrice')), minPrice, maxPrice, step: Number(form.get('step')), competitors });
  }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="product-modal" role="dialog" aria-modal="true" aria-labelledby="product-modal-title"><div className="modal-heading"><div><span className="section-kicker">КАТАЛОГ</span><h2 id="product-modal-title">{product ? 'Изменить товар' : 'Новый товар'}</h2></div><button className="modal-close" onClick={onClose} aria-label="Закрыть"><X size={19} /></button></div><form onSubmit={submit} className="product-form"><label>Название<input name="name" defaultValue={product?.name} placeholder="Например, Samsung Galaxy A55" required /></label><div className="form-row"><label>SKU<input name="sku" defaultValue={product?.sku} placeholder="SM-A556E" required disabled={busy} /></label><label>Текущая цена, ₸<input name="myPrice" type="number" min="0" step="1" defaultValue={product?.myPrice} required /></label></div><div className="form-row three"><label>Минимум, ₸<input name="minPrice" type="number" min="0" step="1" defaultValue={product?.minPrice} required /></label><label>Максимум, ₸<input name="maxPrice" type="number" min="0" step="1" defaultValue={product?.maxPrice} required /></label><label>Шаг, ₸<input name="step" type="number" min="0" step="any" defaultValue={product?.step ?? 1} required /></label></div><label>Конкуренты <small>Один на строку: название | цена | да/нет (в наличии)</small><textarea rows={4} value={competitorsText} onChange={(event) => setCompetitorsText(event.target.value)} placeholder={'Магазин 1 | 100000 | да\nМагазин 2 | 105000 | нет'} /></label>{error && <div className="form-error" role="alert">{error}</div>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Отмена</button><button className="primary-button" disabled={busy}>{busy ? 'Сохраняем…' : product ? 'Сохранить товар' : 'Добавить товар'}<ArrowRight size={15} /></button></div></form></section></div>;
}

function PageHeading({ kicker, title, description, action }: { kicker: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-heading"><div><span className="section-kicker">{kicker}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

function StatCard({ label, value, sub, icon, red = false }: { label: string; value: string; sub: string; icon: ReactNode; red?: boolean }) {
  return <article className={`stat-card ${red ? 'red-stat' : ''}`}><div className="stat-head">{label}{icon}</div><div className="stat-value">{value}</div><div className="stat-foot">{sub}</div></article>;
}

function initials(name: string) { return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'S'; }
function dateTime(value: string) { return new Date(value).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
