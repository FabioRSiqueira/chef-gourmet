import React from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Library } from './pages/Library';
import { Upload } from './pages/Upload';
import { ChefHat, PlusCircle, Book } from 'lucide-react';

const NavLink: React.FC<{ to: string; icon: React.ReactNode; children: React.ReactNode }> = ({ to, icon, children }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  return (
    <Link 
      to={to} 
      className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors font-medium ${
        isActive 
          ? 'bg-chef-red text-white' 
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      {icon}
      <span>{children}</span>
    </Link>
  );
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Navigation */}
      <nav className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center gap-2">
                <div className="bg-chef-red p-1.5 rounded-lg">
                  <ChefHat className="w-6 h-6 text-white" />
                </div>
                <span className="font-serif font-bold text-xl text-gray-900 tracking-tight">ChefShelf</span>
              </Link>
            </div>
            
            <div className="flex items-center gap-2">
              <NavLink to="/" icon={<Book className="w-4 h-4" />}>
                Library
              </NavLink>
              <NavLink to="/upload" icon={<PlusCircle className="w-4 h-4" />}>
                Adicionar receita
              </NavLink>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-auto py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-400 text-sm">
          <p>Fabio Siqueira</p>
        </div>
      </footer>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Library />} />
          <Route path="/upload" element={<Upload />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
};

export default App;
