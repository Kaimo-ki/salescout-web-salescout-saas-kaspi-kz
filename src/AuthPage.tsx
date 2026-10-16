import { useState, type FormEvent } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, Store } from 'lucide-react';

export interface AccountInfo { id: string; name: string; storeName: string; email: string }
interface AuthResponse { token: string; account: AccountInfo }
interface AuthPageProps { onAuthenticated: (session: AuthResponse) => void }

export default function AuthPage({ onAuthenticated }: AuthPageProps) {
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [name, setName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, storeName, email, password }),
      });
      const payload = await response.json() as AuthResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Не удалось выполнить запрос.');
      onAuthenticated(payload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Сервер недоступен. Проверьте, запущен ли проект.');
    } finally { setBusy(false); }
  }

  return <main className="auth-screen">
    <section className="auth-story">
      <a className="brand auth-brand" href="#home"><span className="kaspi-logo">K</span><span>SaleScout</span></a>
      <div className="auth-story-copy"><span className="auth-eyebrow">УПРАВЛЯЙТЕ ЦЕНАМИ УВЕРЕННО</span><h1>Ваш Kaspi-магазин.<br /><em>Под контролем.</em></h1><p>Следите за ценами конкурентов, защищайте минимальную цену и принимайте решения в одном месте.</p><div className="auth-points"><span><b>01</b> Контроль цен конкурентов</span><span><b>02</b> Защита минимальной цены</span><span><b>03</b> История пересчётов</span></div></div>
      <span className="auth-story-foot">SALESCOUT · ДЕМО-ВЕРСИЯ</span>
    </section>
    <section className="auth-panel-wrap"><div className="auth-panel">
      <div className="auth-mobile-brand"><span className="kaspi-logo">K</span>SaleScout</div>
      <div className="auth-intro"><span className="section-kicker">ЛИЧНЫЙ КАБИНЕТ</span><h2>{mode === 'register' ? 'Создайте аккаунт' : 'С возвращением'}</h2><p>{mode === 'register' ? 'Зарегистрируйте магазин, чтобы начать.' : 'Войдите в свой SaleScout.'}</p></div>
      <div className="auth-switch"><button className={mode === 'register' ? 'chosen' : ''} onClick={() => { setMode('register'); setError(''); }}>Регистрация</button><button className={mode === 'login' ? 'chosen' : ''} onClick={() => { setMode('login'); setError(''); }}>Вход</button></div>
      <form onSubmit={submit} className="auth-form">
        {mode === 'register' && <><label>Ваше имя<input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Введите своё имя" required /></label><label>Название магазина<span className="input-wrap"><Store size={16} /><input value={storeName} onChange={(event) => setStoreName(event.target.value)} placeholder="Мой магазин на Kaspi" required /></span></label></>}
        <label>Электронная почта<span className="input-wrap"><Mail size={16} /><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" required /></span></label>
        <label>Пароль<span className="input-wrap"><LockKeyhole size={16} /><input type={passwordVisible ? 'text' : 'password'} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Не менее 8 символов" required /><button type="button" className="reveal-password" aria-label={passwordVisible ? 'Скрыть пароль' : 'Показать пароль'} onClick={() => setPasswordVisible(!passwordVisible)}>{passwordVisible ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>
        {error && <div role="alert" className="form-error">{error}</div>}
        <button className="auth-submit" disabled={busy}>{busy ? 'Подождите…' : mode === 'register' ? 'Создать аккаунт' : 'Войти'}<ArrowRight size={17} /></button>
      </form>
      <div className="auth-disclaimer">Демо-прототип SaleScout. Kaspi пока не подключён; цены рассчитываются на тестовых данных.</div>
      <p className="auth-terms">{mode === 'register' ? 'Создавая аккаунт, вы сможете управлять демонстрационным магазином.' : 'Ваши данные остаются в аккаунте этого демо-сервера.'}</p>
    </div></section>
  </main>;
}
