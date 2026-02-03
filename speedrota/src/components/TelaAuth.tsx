/**
 * @fileoverview Tela de Login/Registro
 */

import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import './TelaAuth.css';

interface TelaAuthProps {
  onSuccess?: () => void;
}

export function TelaAuth({ onSuccess }: TelaAuthProps) {
  const [modo, setModo] = useState<'login' | 'registro'>('login');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  
  const { login, register, isLoading, error, clearError } = useAuthStore();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    
    let success = false;
    
    if (modo === 'login') {
      success = await login(email, senha);
    } else {
      success = await register({ email, senha, nome, telefone: telefone || undefined });
    }
    
    if (success && onSuccess) {
      onSuccess();
    }
  };
  
  const trocarModo = () => {
    setModo(modo === 'login' ? 'registro' : 'login');
    clearError();
  };
  
  return (
    <div className="auth-container">
      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <img src="/logo.png" alt="SpeedRota" />
          <h1>SpeedRota</h1>
          <p>Otimize suas entregas</p>
        </div>
        
        {/* Tabs */}
        <div className="auth-tabs">
          <button 
            className={`auth-tab ${modo === 'login' ? 'active' : ''}`}
            onClick={() => setModo('login')}
          >
            Entrar
          </button>
          <button 
            className={`auth-tab ${modo === 'registro' ? 'active' : ''}`}
            onClick={() => setModo('registro')}
          >
            Criar Conta
          </button>
        </div>
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="auth-form">
          {modo === 'registro' && (
            <div className="form-group">
              <label htmlFor="nome">Nome</label>
              <input
                id="nome"
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome completo"
                required
                autoComplete="name"
              />
            </div>
          )}
          
          <div className="form-group">
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              autoComplete="email"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="senha">Senha</label>
            <input
              id="senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder={modo === 'registro' ? 'Mínimo 6 caracteres' : 'Sua senha'}
              required
              minLength={6}
              autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
            />
          </div>
          
          {modo === 'registro' && (
            <div className="form-group">
              <label htmlFor="telefone">Telefone (opcional)</label>
              <input
                id="telefone"
                type="tel"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(11) 99999-9999"
                autoComplete="tel"
              />
            </div>
          )}
          
          {error && (
            <div className="auth-error">
              <span>⚠️</span> {error}
            </div>
          )}
          
          <button 
            type="submit" 
            className="auth-submit"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="loading-spinner">⏳</span>
            ) : modo === 'login' ? (
              '🚀 Entrar'
            ) : (
              '✨ Criar Conta'
            )}
          </button>
        </form>
        
        {/* Alternar modo */}
        <div className="auth-footer">
          {modo === 'login' ? (
            <p>
              Não tem conta?{' '}
              <button type="button" onClick={trocarModo}>
                Criar agora
              </button>
            </p>
          ) : (
            <p>
              Já tem conta?{' '}
              <button type="button" onClick={trocarModo}>
                Fazer login
              </button>
            </p>
          )}
        </div>
        
        {/* Demo credentials */}
        {modo === 'login' && (
          <div className="auth-demo">
            <p>🧪 Teste grátis:</p>
            <code>free@speedrota.com / 123456</code>
          </div>
        )}
      </div>
    </div>
  );
}

export default TelaAuth;
