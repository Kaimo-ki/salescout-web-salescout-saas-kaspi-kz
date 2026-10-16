import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowDownRight, ArrowRight, Bell, ChevronDown, CircleHelp, LayoutDashboard, Package, RefreshCw, Search, Settings2, ShieldCheck, Sparkles, Target, TrendingDown, Zap } from 'lucide-react';
import type { PriceResult, Product, Reason } from './types';

const products: Product[] = [
  { sku: 'SM-A556E', name: 'Samsung Galaxy A55 5G, 256 ГБ', myPrice: 214990, minPrice: 199000, maxPrice: 239990, step: 100, competitors: [{ seller: 'SmartPoint', price: 212990, inStock: true }, { seller: 'Gadget City', price: 215000, inStock: true }, { seller: 'Mobile Zone', price: 209990, inStock: false }] },
  { sku: 'XIA-REDMI13', name: 'Xiaomi Redmi Note 13 Pro, 8/256 ГБ', myPrice: 164990, minPrice: 154000, maxPrice: 179990, step: 50, competitors: [{ seller: 'TechnoLife', price: 163500, inStock: true }, { seller: 'KZ Mobile', price: 165000, inStock: true }] },
  { sku: 'APP-IP15-128', name: 'Apple iPhone 15, 128 ГБ, чёрный', myPrice: 389990, minPrice: 379000, maxPrice: 429990, step: 100, competitors: [{ seller: 'iStore KZ', price: 388990, inStock: true }, { seller: 'Apple Room', price: 392000, inStock: true }] },
  { sku: 'SONY-WH1000', name: 'Наушники Sony WH-1000XM5', myPrice: 189990, minPrice: 175000, maxPrice: 209990, step: 250, competitors: [{ seller: 'AudioLab', price: 188990, inStock: true }] },
  { sku: 'DYSON-V15', name: 'Пылесос Dyson V15 Detect Absolute', myPrice: 369990, minPrice: 345000, maxPrice: 399990, step: 100, competitors: [] },
];

const reasonText: Record<Reason, string> = { UNDERCUT: 'На шаг ниже', AT_MIN: 'Достигнут минимум', AT_MAX: 'Лимит цены', NO_COMPETITORS: 'Нет конкурентов' };
const money = (value: number) => `${new Intl.NumberFormat('ru-RU').format(value)} ₸`;

export default function App() {
  const [results, setResults] = useState<PriceResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);
  const [search, setSearch] = useState('');
  const [updatedAt, setUpdatedAt] = useState(new Date());

  const reprice = async () => {
    setLoading(true);
    try {
      const response = await fetch('/reprice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(products) });
      if (!response.ok) throw new Error('API error');
      setResults(await response.json() as PriceResult[]);
      setApiError(false);
      setUpdatedAt(new Date());
    } catch {
      setResults([]);
      setApiError(true);
    } finally { setLoading(false); }
  };

  useEffect(() => { void reprice(); }, []);

  const rows = useMemo(() => products.map((product) => ({ product, result: results.find((result) => result.sku === product.sku) })).filter(({ product }) => `${product.name} ${product.sku}`.toLowerCase().includes(search.toLowerCase())), [results, search]);
  const moved = results.filter((result) => result.oldPrice !== result.newPrice).length;
  const averageDrop = results.length ? Math.round(results.reduce((sum, item) => sum + Math.max(0, item.oldPrice - item.newPrice), 0) / Math.max(1, moved)) : 0;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><span /></div><span>sale<span className="brand-light">scout</span></span><span className="brand-beta">BETA</span></div>
      <div className="workspace"><div className="workspace-icon">S</div><div><strong>Smart Store KZ</strong><small>Kaspi Магазин</small></div><ChevronDown size={15} /></div>
      <div className="nav-label">РАБОЧЕЕ ПРОСТРАНСТВО</div>
      <nav><a className="nav-item active"><LayoutDashboard size={17} />Обзор<span className="nav-dot" /></a><a className="nav-item"><Package size={17} />Мои товары<span className="nav-count">128</span></a><a className="nav-item"><Target size={17} />Конкуренты</a><a className="nav-item"><Activity size={17} />Аналитика</a></nav>
      <div className="sidebar-bottom"><div className="plan-card"><div className="plan-top"><span><Sparkles size={14} />ПЛАН START</span><span className="plan-live">АКТИВЕН</span></div><div className="plan-bar"><i /></div><div className="plan-usage"><span>Товары</span><b>128 <em>/ 200</em></b></div><button>Улучшить план <ArrowRight size={14} /></button></div><a className="nav-item muted"><Settings2 size={17} />Настройки</a><a className="nav-item muted"><CircleHelp size={17} />Поддержка</a><div className="profile"><div className="avatar">AK</div><div><strong>Айдар К.</strong><small>Владелец магазина</small></div><ChevronDown size={14} /></div></div>
    </aside>

    <main className="main-content">
      <header className="topbar"><div className="breadcrumb">Рабочее пространство <span>/</span> <b>Обзор</b></div><div className="top-actions"><div className="market-pill"><span className="kaspi-mark">K</span>Kaspi Магазин <i /></div><button className="icon-button"><Bell size={17} /><span /></button><div className="top-avatar">AK</div></div></header>

      <section className="hero">
        <div className="hero-copy"><div className="eyebrow"><span className="live-pulse" />PRICE INTELLIGENCE <span className="eyebrow-line" /> ОБНОВЛЕНО ТОЛЬКО ЧТО</div><h1>Ваши цены.<br /><span>Всегда впереди.</span></h1><p>SaleScout следит за рынком и помогает удерживать первое место — сохраняя вашу маржу.</p><div className="hero-actions"><button className="primary-button" onClick={() => void reprice()} disabled={loading}>{loading ? <RefreshCw size={16} className="spin" /> : <Zap size={16} fill="currentColor" />}{loading ? 'Обновляем цены' : 'Пересчитать цены'}<ArrowRight size={15} /></button><div className="sync-note"><span className="sync-check">✓</span>Защита минимальной цены включена</div></div></div>
        <div className="orb-stage"><div className="orb-halo halo-one" /><div className="orb-halo halo-two" /><div className="orb-grid" /><div className="orb"><div className="orb-shine" /><div className="orb-continent continent-one" /><div className="orb-continent continent-two" /><div className="orb-continent continent-three" /><div className="orb-ring ring-a" /><div className="orb-ring ring-b" /><div className="orb-core" /></div><div className="orbit orbit-a"><span /></div><div className="orbit orbit-b"><span /></div><div className="orb-caption"><span className="caption-bars">▂ ▅ ▇</span><span>MARKET<br /><b>LIVE</b></span></div><div className="float-card float-card-top"><span className="float-icon"><TrendingDown size={14} /></span><span>Цена оптимизирована<strong>− 2 000 ₸</strong></span><i /></div><div className="float-card float-card-bottom"><span className="mini-spark">↗</span><span>ПОЗИЦИЯ В КАТЕГОРИИ<strong>#1 <small>из 18 продавцов</small></strong></span></div></div>
        <div className="hero-index">01 <span>/</span> PRICE CONTROL</div>
      </section>

      <section className="stats-grid">
        <article className="stat-card"><div className="stat-head">ТОВАРЫ ПОД ЗАЩИТОЙ <Package size={16} /></div><div className="stat-value">128 <span className="stat-unit">/ 200</span></div><div className="stat-foot"><span className="stat-bar"><i style={{ width: '64%' }} /></span><span>64% лимита</span></div></article>
        <article className="stat-card"><div className="stat-head">ЦЕНЫ ОБНОВЛЕНЫ <RefreshCw size={15} /></div><div className="stat-value">{updatedAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}<span className="status-chip"><i />LIVE</span></div><div className="stat-foot">Следующая проверка <b>через 4 мин</b></div></article>
        <article className="stat-card"><div className="stat-head">ЦЕНЫ ПЕРЕСЧИТАНЫ <ArrowDownRight size={16} /></div><div className="stat-value">{moved.toString().padStart(2, '0')} <span className="stat-unit">товара</span></div><div className="stat-foot positive"><ArrowDownRight size={14} /> Среднее снижение {money(averageDrop)}</div></article>
        <article className="stat-card accent-card"><div className="stat-head">ЗАЩИТА МАРЖИ <ShieldCheck size={16} /></div><div className="stat-value">Активна <span className="shield-dot"><ShieldCheck size={17} /></span></div><div className="stat-foot">Ниже минимума цена не опустится</div></article>
      </section>

      <section className="products-section"><div className="section-heading"><div><div className="section-kicker">МОНИТОРИНГ <span>·</span> 01</div><h2>Ваши товары</h2><p>Сравнение цен с конкурентами в реальном времени</p></div><div className="heading-actions"><button className="filter-button"><span className="filter-dot" />Все товары <ChevronDown size={14} /></button><button className="more-button">•••</button></div></div>
        {apiError && <div className="api-error">Не удалось связаться с сервером. Запустите API командой <code>npm run dev</code>, затем попробуйте ещё раз.</div>}
        <div className="table-card"><div className="table-toolbar"><div className="table-tabs"><button className="selected">Все товары <span>128</span></button><button>Изменена цена <span>{moved}</span></button><button>Нужна настройка</button></div><label className="search-box"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Найти товар или SKU" /><kbd>⌘ K</kbd></label></div>
          <div className="table-wrap"><table><thead><tr><th className="product-col">ТОВАР</th><th>КОНКУРЕНТЫ</th><th>ВАША ЦЕНА</th><th>НОВАЯ ЦЕНА</th><th>СТАТУС</th><th /></tr></thead><tbody>{rows.map(({ product, result }, index) => <tr key={product.sku}><td><div className="product-cell"><div className={`product-thumb thumb-${index % 5}`}><span>{['◉', '◈', '▣', '◖', '✳'][index % 5]}</span></div><div><strong>{product.name}</strong><small>SKU: {product.sku}</small></div></div></td><td><div className="competitor-cell"><strong>{product.competitors.filter((item) => item.inStock).length || '—'}</strong><span>в наличии</span></div></td><td><span className="old-price">{money(product.myPrice)}</span></td><td><div className="new-price-cell"><strong>{result ? money(result.newPrice) : '—'}</strong>{result && result.newPrice !== result.oldPrice && <span><ArrowDownRight size={12} />{money(result.oldPrice - result.newPrice)}</span>}</div></td><td><span className={`reason-pill reason-${result?.reason.toLowerCase()}`}>{result?.reason === 'UNDERCUT' && <i />}{reasonText[result?.reason ?? 'NO_COMPETITORS']}</span></td><td><button className="row-menu">···</button></td></tr>)}</tbody></table>{rows.length === 0 && <div className="empty-state">Ничего не найдено</div>}{loading && <div className="loading-line" />}</div>
          <div className="table-footer"><span>Показано <b>{rows.length}</b> из <b>128</b> товаров</span><div className="pagination"><button disabled>←</button><button className="page-active">1</button><button>2</button><button>3</button><span>…</span><button>13</button><button>→</button></div><button className="view-all">Все товары <ArrowRight size={14} /></button></div>
        </div>
        <div className="bottom-note"><span><Zap size={14} />SaleScout проверяет цены каждые 5 минут</span><span>Данные обновлены {updatedAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} <span className="note-live" /></span></div>
      </section>
      <footer><span>© 2026 SaleScout</span><span>PRICE INTELLIGENCE FOR KASPI SELLERS</span><a href="#support">Есть вопрос? Напишите нам <ArrowRight size={13} /></a></footer>
    </main>
  </div>;
}
