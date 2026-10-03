import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ArrowUpRight, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import NotificationBell from '../components/NotificationBell.jsx';

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { isAuthenticated, user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const closeMenu = () => setMenuOpen(false);
  const signOut = () => {
    logout();
    closeMenu();
    toast('You’ve been signed out.');
    navigate('/login');
  };
  return <div className="site-shell min-h-screen">
    <header className="topbar">
      <Link className="brand" to="/" onClick={closeMenu} aria-label="Campus Lost and Found home">
        <span className="brand-mark">c<span>+</span></span><span>campus<span className="brand-light">/found</span></span>
      </Link>
      <button className="menu-toggle" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button>
      <nav className={menuOpen ? 'nav-links nav-open' : 'nav-links'} aria-label="Main navigation">
        {isAuthenticated ? <>
          <NavLink to="/dashboard" onClick={closeMenu}>Dashboard</NavLink>
          <NavLink to="/report/lost" onClick={closeMenu}>Report lost</NavLink>
          <NavLink to="/report/found" onClick={closeMenu}>Report found</NavLink>
          <NavLink to="/items" onClick={closeMenu}>Browse items</NavLink>
          {user?.role === 'admin' && <NavLink to="/admin" onClick={closeMenu}>Admin</NavLink>}
          <NotificationBell />
          <button className="nav-cta nav-logout" type="button" onClick={signOut}>Logout <LogOut size={15} /></button>
        </> : <>
          <NavLink to="/login" onClick={closeMenu}>Login</NavLink>
          <Link className="nav-cta" to="/register" onClick={closeMenu}>Register <ArrowUpRight size={15} /></Link>
        </>}
      </nav>
    </header>
    <main><Outlet /></main>
    <footer className="footer"><Link className="brand footer-brand" to="/"><span className="brand-mark">c<span>+</span></span><span>campus<span className="brand-light">/found</span></span></Link><span>A little closer to finding your way back.</span><span>Made for campus, with care.</span></footer>
  </div>;
}
